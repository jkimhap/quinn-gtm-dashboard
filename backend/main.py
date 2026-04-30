"""
FastAPI app — serves the Quinn GTM dashboard frontend.
Reads from snapshots.db (populated by snapshot_hubspot.py + snapshot_gong.py).

Run: uvicorn main:app --reload --port 8000
"""

import io
import csv
import json
import os
import re
from datetime import date, timedelta, datetime
from typing import Any

from fastapi import FastAPI, Query, Response, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import db
from config import REPS, QUARTERLY_ARR_TARGET, STAGE_BUCKET_MAP, AT_RISK_RENEWAL_DAYS

db.init_db()

app = FastAPI(title="Quinn GTM Dashboard API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Helpers ────────────────────────────────────────────────────────────────────

def months_ago(n: int) -> str:
    """ISO date string n months before today (approximate)."""
    d = date.today() - timedelta(days=n * 30)
    return d.isoformat()


def month_label(iso_date: str) -> str:
    """'2024-03-15' → 'Mar 24'"""
    try:
        d = datetime.strptime(iso_date[:7], "%Y-%m")
        return d.strftime("%b %y")
    except Exception:
        return iso_date[:7]


def build_monthly_series(rows: list[dict], date_col: str, value_col: str,
                          n_months: int = 12) -> list[dict]:
    """Aggregate rows into monthly totals for the past n_months."""
    from collections import defaultdict
    by_month: dict[str, float] = defaultdict(float)
    for r in rows:
        d = (r.get(date_col) or "")[:7]
        if d:
            by_month[d] += r.get(value_col) or 0

    months = []
    today = date.today()
    for i in range(n_months - 1, -1, -1):
        m = (today.replace(day=1) - timedelta(days=i * 28))
        key = m.strftime("%Y-%m")
        months.append({"month": key, "label": month_label(key + "-01"), "value": round(by_month.get(key, 0), 2)})
    return months


def build_monthly_count(rows: list[dict], date_col: str, n_months: int = 12) -> list[dict]:
    from collections import defaultdict
    by_month: dict[str, int] = defaultdict(int)
    for r in rows:
        d = (r.get(date_col) or "")[:7]
        if d:
            by_month[d] += 1

    months = []
    today = date.today()
    for i in range(n_months - 1, -1, -1):
        m = (today.replace(day=1) - timedelta(days=i * 28))
        key = m.strftime("%Y-%m")
        months.append({"month": key, "label": month_label(key + "-01"), "value": by_month.get(key, 0)})
    return months


def data_available(rows) -> bool:
    if rows is None:
        return False
    if isinstance(rows, list):
        return len(rows) > 0
    return bool(rows)


# ── /api/health ────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    meta = db.q("SELECT * FROM snapshot_meta")
    return {
        "status": "ok",
        "snapshots": {r["source"]: {"ran_at": r["ran_at"], "status": r["status"],
                                     "rows": r["rows_written"], "error": r["error"]}
                      for r in meta},
    }


# ── /api/vitals ────────────────────────────────────────────────────────────────

@app.get("/api/vitals")
def vitals():
    today = date.today().isoformat()
    first_of_month = date.today().replace(day=1).isoformat()
    six_months_ago = months_ago(6)
    three_months_ago = months_ago(3)

    # All won deals
    won = db.q("SELECT * FROM deals WHERE is_closed_won=1")

    # Active customers (unique companies with at least one active/at-risk won deal)
    active_deals = db.q(
        "SELECT DISTINCT company_id FROM deals WHERE is_closed_won=1 AND status IN ('active','at-risk')"
    )
    active_count = len(active_deals)

    # ARR = sum of hs_arr on active/at-risk deals
    arr_row = db.q1("SELECT SUM(arr) as total FROM deals WHERE is_closed_won=1 AND status IN ('active','at-risk')")
    arr = (arr_row["total"] or 0) if arr_row else 0

    # TCV = sum of amount (total contract value) on active/at-risk deals
    tcv_row = db.q1("SELECT SUM(amount) as total FROM deals WHERE is_closed_won=1 AND status IN ('active','at-risk')")
    tcv = (tcv_row["total"] or 0) if tcv_row else 0

    # Net new ARR this month (deals closed won this month)
    net_new_mtd = db.q1(
        "SELECT SUM(arr) as total FROM deals WHERE is_closed_won=1 AND closed_won_date >= ?",
        (first_of_month,)
    )
    net_new_arr_mtd = (net_new_mtd["total"] or 0) if net_new_mtd else 0

    # Rolling 3-month ACV
    acv_rows = db.q(
        "SELECT acv FROM deals WHERE is_closed_won=1 AND closed_won_date >= ? AND acv > 0",
        (three_months_ago,)
    )
    rolling_acv = sum(r["acv"] for r in acv_rows) / max(len(acv_rows), 1) if acv_rows else None

    # Pipeline coverage
    open_pipeline = db.q1(
        "SELECT SUM(amount) as total FROM deals WHERE is_closed_won=0 AND is_closed_lost=0 AND stage_bucket NOT IN ('closed_won','closed_lost')"
    )
    open_pipeline_val = (open_pipeline["total"] or 0) if open_pipeline else 0
    if QUARTERLY_ARR_TARGET:
        pipeline_coverage = round(open_pipeline_val / QUARTERLY_ARR_TARGET, 2)
        pipeline_coverage_label = f"{pipeline_coverage:.1f}x"
    else:
        pipeline_coverage = open_pipeline_val
        pipeline_coverage_label = None

    # Logo MoM growth
    prev_month_start = (date.today().replace(day=1) - timedelta(days=1)).replace(day=1).isoformat()
    prev_month_count_row = db.q1(
        "SELECT COUNT(DISTINCT company_id) as cnt FROM deals WHERE is_closed_won=1 AND status IN ('active','at-risk') AND closed_won_date < ?",
        (first_of_month,)
    )
    prev_count = (prev_month_count_row["cnt"] or 1) if prev_month_count_row else 1
    logo_mom = round(((active_count - prev_count) / max(prev_count, 1)) * 100, 1)

    # Sparklines — running totals, one point per completed month (last day < today)
    all_won = db.q(
        "SELECT closed_won_date, arr, amount, company_id FROM deals WHERE is_closed_won=1 AND status IN ('active','at-risk')"
    )
    all_open = db.q(
        "SELECT create_date, amount, closed_won_date, close_date, is_closed_lost FROM deals"
    )

    spark_arr, spark_tcv, spark_customers, spark_pipeline = [], [], [], []
    today_dt = date.today()

    # Walk back up to 12 months, keep only fully completed months
    for i in range(11, -1, -1):
        first = (today_dt.replace(day=1) - timedelta(days=i * 28)).replace(day=1)
        if first.month == 12:
            last = first.replace(year=first.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            last = first.replace(month=first.month + 1, day=1) - timedelta(days=1)

        # Only include months that have fully ended
        if last >= today_dt:
            continue

        end_str = last.isoformat()
        next_day_str = (last + timedelta(days=1)).isoformat()
        label = first.strftime("%b %y")

        # Totals as of last day of the completed month
        month_arr = sum(r["arr"] or 0 for r in all_won if (r.get("closed_won_date") or "") <= end_str)
        month_tcv = sum(r["amount"] or 0 for r in all_won if (r.get("closed_won_date") or "") <= end_str)
        month_customers = len(set(
            r["company_id"] for r in all_won
            if r.get("company_id") and (r.get("closed_won_date") or "") <= end_str
        ))

        # Open pipeline as of last day of month
        month_pipeline = sum(
            r["amount"] or 0 for r in all_open
            if (r.get("create_date") or "") <= end_str
            and ((r.get("closed_won_date") or "9999") >= next_day_str)
            and (r.get("is_closed_lost") == 0 or (r.get("close_date") or "9999") >= next_day_str)
        )

        spark_arr.append({"month": first.strftime("%Y-%m"), "label": label, "value": round(month_arr, 2)})
        spark_tcv.append({"month": first.strftime("%Y-%m"), "label": label, "value": round(month_tcv, 2)})
        spark_customers.append({"month": first.strftime("%Y-%m"), "label": label, "value": month_customers})
        spark_pipeline.append({"month": first.strftime("%Y-%m"), "label": label, "value": round(month_pipeline, 2)})

    return {
        "arr": round(arr, 2),
        "tcv": round(tcv, 2),
        "net_new_arr_mtd": round(net_new_arr_mtd, 2),
        "active_customer_count": active_count,
        "rolling_3mo_acv": round(rolling_acv, 2) if rolling_acv else None,
        "pipeline_coverage": pipeline_coverage,
        "pipeline_coverage_label": pipeline_coverage_label,
        "open_pipeline": round(open_pipeline_val, 2),
        "logo_mom_growth_pct": logo_mom,
        "quarterly_target": QUARTERLY_ARR_TARGET,
        "sparklines": {
            "arr": spark_arr,
            "tcv": spark_tcv,
            "customer_count": spark_customers,
            "open_pipeline": spark_pipeline,
        },
    }


# ── /api/customers ─────────────────────────────────────────────────────────────

@app.get("/api/customers")
def customers(
    status: str = Query("active,at-risk", description="Comma-separated statuses"),
    vertical: str = Query(None),
    tier: str = Query(None),
    owner: str = Query(None),
    q: str = Query(None, description="Search company name"),
    export: bool = Query(False),
):
    statuses = [s.strip() for s in status.split(",")]
    placeholders = ",".join("?" for _ in statuses)
    params: list[Any] = list(statuses)

    where_clauses = [f"d.status IN ({placeholders})"]
    if vertical:
        where_clauses.append("d.vertical = ?")
        params.append(vertical)
    if tier:
        where_clauses.append("d.icp_tier = ?")
        params.append(tier)
    if owner:
        where_clauses.append("d.owner_name = ?")
        params.append(owner)
    if q:
        where_clauses.append("(d.company_name LIKE ? OR d.deal_name LIKE ?)")
        params.extend([f"%{q}%", f"%{q}%"])

    # One row per company: pick the max-ARR active deal per company
    sql = f"""
        SELECT
            d.company_id,
            d.company_name          AS company,
            d.vertical,
            d.icp_tier              AS tier,
            c.employees,
            c.annual_revenue        AS est_annual_revenue,
            c.num_locations         AS locations,
            d.amount                AS tcv,
            d.arr,
            d.mrr,
            d.contract_start,
            d.contract_end,
            d.deal_source           AS source,
            d.owner_name            AS owner,
            d.csm,
            d.status,
            d.products_used         AS products,
            d.hubspot_id            AS deal_id
        FROM deals d
        LEFT JOIN companies c ON c.hubspot_id = d.company_id
        WHERE {' AND '.join(where_clauses)}
        GROUP BY d.company_id
        HAVING d.arr = MAX(d.arr)
        ORDER BY d.arr DESC NULLS LAST
    """

    rows = db.q(sql, tuple(params))

    if export:
        output = io.StringIO()
        if rows:
            writer = csv.DictWriter(output, fieldnames=rows[0].keys())
            writer.writeheader()
            writer.writerows(rows)
        return Response(
            content=output.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=quinn_customers.csv"},
        )

    return {
        "data": rows,
        "count": len(rows),
        "data_quality": {
            "vertical_coverage": _pct_non_null(rows, "vertical"),
            "arr_coverage": _pct_non_null(rows, "arr"),
            "contract_dates_coverage": _pct_non_null(rows, "contract_end"),
        },
    }


def _pct_non_null(rows: list[dict], field: str) -> float:
    if not rows:
        return 0.0
    return round(sum(1 for r in rows if r.get(field)) / len(rows) * 100, 1)


# ── /api/trends ────────────────────────────────────────────────────────────────

@app.get("/api/trends")
def trends(months: int = Query(12, ge=3, le=24)):
    since = months_ago(months)
    won = db.q(
        "SELECT closed_won_date, arr, vertical, deal_source, owner_slug FROM deals WHERE is_closed_won=1 AND closed_won_date >= ?",
        (since,)
    )

    monthly_arr = build_monthly_series(won, "closed_won_date", "arr", months)
    monthly_count = build_monthly_count(won, "closed_won_date", months)

    # Monthly ACV
    from collections import defaultdict
    acv_by_month: dict[str, list] = defaultdict(list)
    for r in won:
        m = (r.get("closed_won_date") or "")[:7]
        if m and r.get("arr"):
            acv_by_month[m].append(r["arr"])

    monthly_acv = []
    today = date.today()
    for i in range(months - 1, -1, -1):
        m = (today.replace(day=1) - timedelta(days=i * 28))
        key = m.strftime("%Y-%m")
        vals = acv_by_month.get(key, [])
        avg = round(sum(vals) / len(vals), 2) if vals else None
        monthly_acv.append({"month": key, "label": month_label(key + "-01"), "value": avg})

    # Stacked by vertical
    verticals = sorted(set(r.get("vertical") or "Unknown" for r in won))
    stacked_vertical: list[dict] = []
    for m_row in monthly_arr:
        entry = {"month": m_row["month"], "label": m_row["label"]}
        for v in verticals:
            entry[v] = round(sum(r["arr"] for r in won
                                 if (r.get("closed_won_date") or "")[:7] == m_row["month"]
                                 and (r.get("vertical") or "Unknown") == v), 2)
        stacked_vertical.append(entry)

    # Stacked by rep — TCV
    rep_slugs = [s for s in REPS if not REPS[s].get("hide_from_rep_tabs")]
    stacked_rep: list[dict] = []
    for m_row in monthly_arr:
        entry = {"month": m_row["month"], "label": m_row["label"]}
        for slug in rep_slugs:
            entry[slug] = round(sum(r["arr"] for r in won
                                    if (r.get("closed_won_date") or "")[:7] == m_row["month"]
                                    and r.get("owner_slug") == slug), 2)
        stacked_rep.append(entry)

    # Stacked by rep — deal count
    stacked_rep_count: list[dict] = []
    for m_row in monthly_arr:
        entry = {"month": m_row["month"], "label": m_row["label"]}
        for slug in rep_slugs:
            entry[slug] = sum(1 for r in won
                              if (r.get("closed_won_date") or "")[:7] == m_row["month"]
                              and r.get("owner_slug") == slug)
        stacked_rep_count.append(entry)

    return {
        "monthly_arr": monthly_arr,
        "monthly_count": monthly_count,
        "monthly_acv": monthly_acv,
        "stacked": {
            "by_rep": {"keys": rep_slugs, "data": stacked_rep},
            "by_rep_count": {"keys": rep_slugs, "data": stacked_rep_count},
        },
    }


# ── /api/reps/{slug}/performance ───────────────────────────────────────────────

@app.get("/api/reps/{slug}/performance")
def rep_performance(slug: str):
    if slug not in REPS:
        return {"error": f"Unknown rep: {slug}"}

    cfg = REPS[slug]
    ninety_days_ago = (date.today() - timedelta(days=90)).isoformat()

    # All won deals for this rep (last 12 months)
    twelve_months_ago = months_ago(12)
    won = db.q(
        "SELECT * FROM deals WHERE owner_slug=? AND is_closed_won=1 AND closed_won_date >= ?",
        (slug, twelve_months_ago)
    )
    # Deals worked in last 90d (won + lost)
    worked_90d = db.q(
        "SELECT * FROM deals WHERE owner_slug=? AND (is_closed_won=1 OR is_closed_lost=1) AND (closed_won_date >= ? OR close_date >= ?)",
        (slug, ninety_days_ago, ninety_days_ago)
    )
    won_90d = [d for d in worked_90d if d["is_closed_won"]]
    win_rate = round(len(won_90d) / max(len(worked_90d), 1) * 100, 1)

    # Average sales cycle
    cycles = [d["days_to_close"] for d in won if d.get("days_to_close")]
    avg_cycle = round(sum(cycles) / len(cycles), 1) if cycles else None

    # Avg ACV = total TCV ÷ deals closed
    total_tcv = sum(d.get("amount") or 0 for d in won)
    avg_acv = round(total_tcv / len(won), 2) if won else None

    # Monthly closed TCV — last 12 months
    monthly_arr = build_monthly_series(won, "closed_won_date", "amount", 12)
    monthly_count = build_monthly_count(won, "closed_won_date", 12)

    # Current pipeline by bucket
    pipeline = db.q(
        "SELECT stage_bucket, SUM(amount) as total_amt, COUNT(*) as cnt FROM deals WHERE owner_slug=? AND is_closed_won=0 AND is_closed_lost=0 AND stage_bucket NOT IN ('closed_won','closed_lost','unknown') GROUP BY stage_bucket",
        (slug,)
    )

    # SDR-specific metrics (Luke)
    sdr_metrics = None
    if cfg["role"] == "sdr":
        outbound = db.q(
            "SELECT COUNT(*) as cnt, SUM(amount) as total FROM deals WHERE owner_slug=? AND deal_source='outbound' AND create_date >= ?",
            (slug, ninety_days_ago)
        )
        sdr_metrics = {
            "opps_created_90d": outbound[0]["cnt"] if outbound else 0,
            "pipeline_created_90d": (outbound[0]["total"] or 0) if outbound else 0,
        }

    # Gong meetings (last 30 days rolling per day)
    thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()
    gong_rows = db.q(
        "SELECT started_at FROM gong_calls WHERE rep_slug=? AND started_at >= ?",
        (slug, thirty_days_ago)
    )
    meetings_last_30d = len(gong_rows)
    meetings_per_day = round(meetings_last_30d / 30, 2)

    return {
        "slug": slug,
        "name": cfg["name"],
        "role": cfg["role"],
        "summary": {
            "total_tcv_closed": round(total_tcv, 2),
            "total_deals_closed": len(won),
            "win_rate_90d_pct": win_rate,
            "avg_cycle_days": avg_cycle,
            "avg_acv": avg_acv,
            "meetings_per_day_30d": meetings_per_day,
        },
        "monthly_arr": monthly_arr,
        "monthly_count": monthly_count,
        "pipeline_by_stage": {r["stage_bucket"]: {"amount": r["total_amt"], "count": r["cnt"]}
                               for r in pipeline},
        "sdr_metrics": sdr_metrics,
    }


@app.get("/api/reps")
def all_reps():
    return {slug: rep_performance(slug) for slug in REPS}


# ── /api/pipeline ──────────────────────────────────────────────────────────────

@app.get("/api/pipeline")
def pipeline(rep: str = Query(None)):
    ninety_days_ago = (date.today() - timedelta(days=90)).isoformat()

    # Open pipeline
    base_where = "is_closed_won=0 AND is_closed_lost=0 AND stage_bucket NOT IN ('closed_won','closed_lost','unknown')"
    base_params = []
    if rep:
        base_where += " AND owner_slug=?"
        base_params.append(rep)

    open_deals = db.q(f"SELECT * FROM deals WHERE {base_where}", tuple(base_params))

    # Group by bucket
    from collections import defaultdict
    by_bucket: dict[str, list] = defaultdict(list)
    for d in open_deals:
        by_bucket[d["stage_bucket"]].append(d)

    today_str = date.today().isoformat()
    funnel = []
    for bucket in ["early", "mid", "late"]:
        deals = by_bucket[bucket]
        amt = sum(d.get("amount") or 0 for d in deals)
        # Avg days in stage (rough: create_date to now)
        days_in = []
        stale = 0
        for d in deals:
            cd = d.get("create_date")
            if cd:
                age = (datetime.strptime(today_str, "%Y-%m-%d") -
                       datetime.strptime(cd[:10], "%Y-%m-%d")).days
                days_in.append(age)
                from config import STAGE_AGING_THRESHOLDS
                threshold = STAGE_AGING_THRESHOLDS.get(bucket, 30)
                if age > threshold:
                    stale += 1
        avg_days = round(sum(days_in) / len(days_in), 1) if days_in else None

        funnel.append({
            "bucket": bucket,
            "amount": round(amt, 2),
            "count": len(deals),
            "avg_days_in_stage": avg_days,
            "stale_count": stale,
        })

    # Stage-to-stage conversion (last 90 days closed deals)
    closed_90d_won = db.q(
        "SELECT * FROM deals WHERE is_closed_won=1 AND closed_won_date >= ?",
        (ninety_days_ago,)
    )
    closed_90d_lost = db.q(
        "SELECT * FROM deals WHERE is_closed_lost=1 AND close_date >= ?",
        (ninety_days_ago,)
    )
    total_closed = len(closed_90d_won) + len(closed_90d_lost)
    win_rate_90d = round(len(closed_90d_won) / max(total_closed, 1) * 100, 1)

    return {
        "funnel": funnel,
        "win_rate_90d_pct": win_rate_90d,
        "total_open_pipeline": round(sum(d.get("amount") or 0 for d in open_deals), 2),
        "open_deal_count": len(open_deals),
    }


# ── /api/verticals ─────────────────────────────────────────────────────────────

@app.get("/api/verticals")
def verticals():
    from config import ICP_TIER_MAP, VERTICAL_CANONICAL

    # All deals (won + open)
    all_deals = db.q("SELECT * FROM deals WHERE stage_bucket != 'closed_lost'")
    won_all = [d for d in all_deals if d["is_closed_won"]]
    worked_all = [d for d in all_deals if d["is_closed_won"] or d["is_closed_lost"]]

    from collections import defaultdict
    verticals_data: dict[str, dict] = defaultdict(lambda: {
        "vertical": "", "tier": "", "customers": set(), "arr": 0,
        "acvs": [], "cycles": [], "won": 0, "worked": 0,
    })

    for d in won_all:
        v = d.get("vertical") or "Unknown"
        vd = verticals_data[v]
        vd["vertical"] = v
        vd["tier"] = d.get("icp_tier") or ""
        if d.get("company_id"):
            vd["customers"].add(d["company_id"])
        vd["arr"] += d.get("arr") or 0
        if d.get("acv"):
            vd["acvs"].append(d["acv"])
        if d.get("days_to_close"):
            vd["cycles"].append(d["days_to_close"])

    for d in worked_all:
        v = d.get("vertical") or "Unknown"
        verticals_data[v]["worked"] += 1
        if d["is_closed_won"]:
            verticals_data[v]["won"] += 1

    result = []
    for v, vd in verticals_data.items():
        result.append({
            "vertical": v,
            "tier": vd["tier"],
            "customers": len(vd["customers"]),
            "total_arr": round(vd["arr"], 2),
            "avg_acv": round(sum(vd["acvs"]) / len(vd["acvs"]), 2) if vd["acvs"] else None,
            "win_rate_pct": round(vd["won"] / max(vd["worked"], 1) * 100, 1),
            "avg_cycle_days": round(sum(vd["cycles"]) / len(vd["cycles"]), 1) if vd["cycles"] else None,
        })

    result.sort(key=lambda x: (x["tier"] or "9", -x["total_arr"]))
    return {"data": result}


# ── /api/leading-indicators ────────────────────────────────────────────────────

@app.get("/api/leading-indicators")
def leading_indicators():
    thirty_days_ago = (date.today() - timedelta(days=30)).isoformat()
    seven_days_ago = (date.today() - timedelta(days=7)).isoformat()

    result = {}
    gong_available = bool(db.q1("SELECT ran_at FROM snapshot_meta WHERE source='gong' AND status='ok'"))

    for slug, cfg in REPS.items():
        # Gong: meetings held per day (7-day rolling)
        meetings_7d = db.q(
            "SELECT started_at FROM gong_calls WHERE rep_slug=? AND started_at >= ?",
            (slug, seven_days_ago)
        )
        meetings_per_day_7d = round(len(meetings_7d) / 7, 2)

        meetings_30d = db.q(
            "SELECT started_at FROM gong_calls WHERE rep_slug=? AND started_at >= ?",
            (slug, thirty_days_ago)
        )

        # HubSpot: new opps created
        new_opps = db.q(
            "SELECT COUNT(*) as cnt, SUM(amount) as amt FROM deals WHERE owner_slug=? AND create_date >= ?",
            (slug, thirty_days_ago)
        )
        opps_30d = new_opps[0]["cnt"] if new_opps else 0
        pipeline_30d = (new_opps[0]["amt"] or 0) if new_opps else 0

        # Demo → close conversion (last 90 days, rough)
        ninety_days_ago = (date.today() - timedelta(days=90)).isoformat()
        closed_90d = db.q(
            "SELECT is_closed_won FROM deals WHERE owner_slug=? AND (is_closed_won=1 OR is_closed_lost=1) AND (closed_won_date >= ? OR close_date >= ?)",
            (slug, ninety_days_ago, ninety_days_ago)
        )
        won_90d = sum(1 for d in closed_90d if d["is_closed_won"])
        close_rate = round(won_90d / max(len(closed_90d), 1) * 100, 1)

        result[slug] = {
            "name": cfg["name"],
            "role": cfg["role"],
            "meetings_per_day_7d_rolling": meetings_per_day_7d,
            "meetings_30d": len(meetings_30d),
            "opps_created_30d": opps_30d,
            "pipeline_created_30d": round(pipeline_30d, 2),
            "win_rate_90d_pct": close_rate,
            "gong_data_available": gong_available,
        }

    return {"data": result, "gong_available": gong_available}


# ── /api/retention ─────────────────────────────────────────────────────────────

@app.get("/api/retention")
def retention():
    today = date.today().isoformat()
    twelve_months_ago = months_ago(12)

    # Churned this period
    churned = db.q(
        "SELECT company_name, arr, contract_end, vertical FROM deals WHERE status='churned' AND contract_end >= ? ORDER BY arr DESC",
        (twelve_months_ago,)
    )

    # At-risk
    at_risk_date = (date.today() + timedelta(days=AT_RISK_RENEWAL_DAYS)).isoformat()
    at_risk = db.q(
        "SELECT company_name, arr, contract_end, vertical, owner_name FROM deals WHERE status='at-risk' AND contract_end <= ? AND contract_end >= ? ORDER BY contract_end ASC",
        (at_risk_date, today)
    )

    # GRR (gross retention): 1 - (churned ARR / beginning ARR)
    beginning_arr = db.q1(
        "SELECT SUM(arr) as total FROM deals WHERE is_closed_won=1 AND contract_start < ?",
        (twelve_months_ago,)
    )
    beg_arr = (beginning_arr["total"] or 0) if beginning_arr else 0
    churned_arr = sum(r.get("arr") or 0 for r in churned)
    grr = round((1 - churned_arr / max(beg_arr, 1)) * 100, 1) if beg_arr else None

    # Current ARR
    current_arr = db.q1("SELECT SUM(arr) as total FROM deals WHERE status IN ('active','at-risk') AND is_closed_won=1")
    curr_arr = (current_arr["total"] or 0) if current_arr else 0

    # NRR = (current ARR including expansions) / beginning ARR
    nrr = round(curr_arr / max(beg_arr, 1) * 100, 1) if beg_arr else None

    # Expansion ARR by month (deals with arr > original amount — rough proxy)
    expansion = db.q(
        "SELECT closed_won_date, arr FROM deals WHERE is_closed_won=1 AND deal_name LIKE '%expansion%' OR deal_name LIKE '%upsell%' OR deal_name LIKE '%upgrade%'"
    )
    expansion_monthly = build_monthly_series(expansion, "closed_won_date", "arr", 12)

    return {
        "grr_pct": grr,
        "nrr_pct": nrr,
        "churned_arr_ttm": round(churned_arr, 2),
        "beginning_arr": round(beg_arr, 2),
        "churned_logos": churned,
        "at_risk_accounts": at_risk,
        "expansion_monthly": expansion_monthly,
        "data_quality": {
            "note": "GRR/NRR are directional — contract dates must be populated in HubSpot for accuracy."
                    if not beg_arr else None
        },
    }


# ── /api/locations ─────────────────────────────────────────────────────────────

@app.get("/api/locations")
def locations():
    rows = db.q(
        """
        SELECT
            c.name as company,
            c.num_locations as total_locations,
            COUNT(d.hubspot_id) as deals_count,
            SUM(d.arr) as arr,
            d.vertical,
            d.icp_tier as tier,
            d.owner_name as owner,
            d.contract_end
        FROM deals d
        JOIN companies c ON c.hubspot_id = d.company_id
        WHERE d.is_closed_won=1 AND d.status IN ('active','at-risk') AND c.num_locations > 1
        GROUP BY d.company_id
        ORDER BY c.num_locations DESC
        """
    )

    result = []
    for r in rows:
        total = r.get("total_locations") or 1
        sold_to = r.get("deals_count") or 1
        whitespace = max(0, total - sold_to)
        result.append({**r, "sold_to_locations": sold_to, "whitespace": whitespace})

    has_data = any(r.get("total_locations") for r in result)
    return {
        "data": result,
        "data_available": has_data,
        "note": None if has_data else "num_locations field not found in HubSpot — contact data not populated",
    }


# ── /api/calls ─────────────────────────────────────────────────────────────────

@app.get("/api/calls")
def calls_list(
    company: str = Query(None),
    rep: str = Query(None),
    q: str = Query(None),
    limit: int = Query(50, le=200),
):
    where, params = ["1=1"], []
    if company:
        where.append("(matched_company LIKE ? OR company_name LIKE ? OR title LIKE ?)")
        params += [f"%{company}%", f"%{company}%", f"%{company}%"]
    if rep:
        where.append("rep_slug = ?")
        params.append(rep)
    if q:
        where.append("title LIKE ?")
        params.append(f"%{q}%")
    sql = f"""
        SELECT g.gong_id, g.title, g.started_at, g.duration_secs,
               g.rep_slug, g.matched_company, g.company_name,
               CASE WHEN t.transcript_text IS NOT NULL AND length(t.transcript_text) > 10
                    THEN 1 ELSE 0 END as has_transcript
        FROM gong_calls g
        LEFT JOIN gong_transcripts t ON t.gong_id = g.gong_id
        WHERE {' AND '.join(where)}
        ORDER BY g.started_at DESC
        LIMIT ?
    """
    params.append(limit)
    rows = db.q(sql, tuple(params))
    return {"data": rows, "count": len(rows)}


@app.get("/api/calls/{gong_id}/transcript")
def call_transcript(gong_id: str):
    row = db.q1("SELECT * FROM gong_calls WHERE gong_id = ?", (gong_id,))
    transcript = db.q1("SELECT transcript_text FROM gong_transcripts WHERE gong_id = ?", (gong_id,))
    if not row:
        return {"error": "Call not found"}
    return {
        "gong_id": gong_id,
        "title": row.get("title"),
        "started_at": row.get("started_at"),
        "duration_secs": row.get("duration_secs"),
        "rep_slug": row.get("rep_slug"),
        "matched_company": row.get("matched_company"),
        "transcript": transcript.get("transcript_text") if transcript else None,
    }


MODEL = "claude-haiku-4-5-20251001"

_SUMMARY_PROMPT = """\
You are a sales call analyst for Quinn, a B2B AI voice agent platform that helps \
field-service companies (HVAC, plumbing, pest control, roofing, etc.) never miss a customer call.

{prior_context_block}
Analyse the CURRENT CALL below and return ONLY a valid JSON object — no markdown fences, \
no explanation, just the JSON.

Required structure:
{{
  "tldr": "<2-3 sentences: what happened on THIS call and what it means for the deal, \
written in light of the full relationship history above>",
  "key_moments": [
    "<most important thing said, decided, or revealed on this call — quote directly if useful>",
    "..."
  ],
  "commitments_and_blockers": {{
    "rep_committed": ["<thing the rep promised to do>"],
    "prospect_committed": ["<thing the prospect agreed to do>"],
    "blockers": ["<objection, concern, or obstacle — empty array if none>"]
  }},
  "action_items": [
    "<specific next step, e.g. 'Rep: send pricing deck by Friday'>",
    "..."
  ],
  "coaching": [
    "<specific, actionable thing the rep could have done better, with an example from the call>",
    "..."
  ]
}}

Rules:
- tldr must reflect where the deal stands OVERALL, not just this call in isolation
- key_moments: 3-5 bullets, highest signal only
- coaching: 2-4 honest, direct notes referencing actual transcript moments
- Use empty arrays [] for sections with nothing to report; never omit a key

Current call — {call_context}

Transcript:
{transcript}
"""


def _build_prior_context(company: str, before_date: str) -> str:
    """
    Return a prose block summarising all prior calls with this company
    that happened before `before_date`, most recent first.
    Uses cached summaries where available; falls back to call title + date.
    """
    if not company:
        return ""

    prior_calls = db.q("""
        SELECT g.gong_id, g.title, g.started_at, g.rep_slug,
               s.summary_json
        FROM gong_calls g
        LEFT JOIN gong_summaries s ON s.gong_id = g.gong_id
        WHERE (g.matched_company = ? OR g.company_name LIKE ?)
          AND g.started_at < ?
        ORDER BY g.started_at ASC
    """, (company, f"%{company.split()[0]}%", before_date))

    if not prior_calls:
        return ""

    lines = [
        f"=== RELATIONSHIP HISTORY WITH {company.upper()} ===",
        f"({len(prior_calls)} prior call(s) on record — oldest to newest)\n",
    ]
    for i, c in enumerate(prior_calls, 1):
        date_str = (c.get("started_at") or "")[:10]
        rep = REPS.get(c.get("rep_slug") or "", {}).get("name") or c.get("rep_slug") or "Unknown"
        title = c.get("title") or "Untitled"
        tldr = ""
        if c.get("summary_json"):
            try:
                tldr = json.loads(c["summary_json"]).get("tldr", "")
            except Exception:
                pass
        entry = f"Call {i} — {date_str} ({rep}): {title}"
        if tldr:
            entry += f"\n  Summary: {tldr}"
        lines.append(entry)

    lines.append("\n=== END OF HISTORY — CURRENT CALL FOLLOWS ===\n")
    return "\n".join(lines) + "\n"


@app.get("/api/calls/{gong_id}/summary")
def call_summary(gong_id: str):
    try:
        # Ensure gong_summaries table exists (defensive, in case of schema drift)
        with db.tx() as conn:
            conn.execute("""CREATE TABLE IF NOT EXISTS gong_summaries (
                gong_id TEXT PRIMARY KEY, summary_json TEXT,
                model TEXT, created_at TEXT DEFAULT (datetime('now')))""")

        # ── Serve from cache ────────────────────────────────────────────────────
        cached = db.q1("SELECT summary_json FROM gong_summaries WHERE gong_id = ?", (gong_id,))
        if cached and cached.get("summary_json"):
            return json.loads(cached["summary_json"])

        # ── Fetch transcript ────────────────────────────────────────────────────
        transcript_row = db.q1(
            "SELECT transcript_text FROM gong_transcripts WHERE gong_id = ?", (gong_id,)
        )
        if not transcript_row or not (transcript_row.get("transcript_text") or "").strip():
            return {"error": "No transcript available for this call."}

        transcript_text = transcript_row["transcript_text"].strip()
        if len(transcript_text) < 100:
            return {"error": "Transcript is too short to analyse."}

        # ── Call metadata ───────────────────────────────────────────────────────
        call = db.q1(
            "SELECT title, rep_slug, matched_company, started_at FROM gong_calls WHERE gong_id = ?",
            (gong_id,),
        )
        if not call:
            return {"error": "Call not found."}

        company = (call.get("matched_company") or "").strip()
        rep_name = REPS.get(call.get("rep_slug") or "", {}).get("name") or call.get("rep_slug") or "Unknown"
        started_at = call.get("started_at") or ""
        call_context = (
            f"Company: {company or 'Unknown'} | Rep: {rep_name} | "
            f"Date: {started_at[:10]} | Title: {call.get('title') or ''}"
        )

        # ── Build prior-call context ────────────────────────────────────────────
        prior_block = _build_prior_context(company, started_at) if company else ""

        # ── Check API key ───────────────────────────────────────────────────────
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        if not api_key:
            return {"error": "ANTHROPIC_API_KEY is not configured on this server."}

        # ── Generate with Claude ────────────────────────────────────────────────
        import anthropic as _anthropic
        client = _anthropic.Anthropic(api_key=api_key)
        prompt = _SUMMARY_PROMPT.format(
            prior_context_block=prior_block,
            call_context=call_context,
            transcript=transcript_text[:12000],
        )
        message = client.messages.create(
            model=MODEL,
            max_tokens=1200,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = message.content[0].text.strip()
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
        summary = json.loads(raw)

        # ── Cache and return ────────────────────────────────────────────────────
        with db.tx() as conn:
            db.upsert_gong_summary(conn, gong_id, json.dumps(summary), MODEL)

        return summary

    except json.JSONDecodeError as e:
        return {"error": f"AI returned invalid JSON: {e}"}
    except Exception as e:
        import traceback
        return {"error": f"Summary failed: {type(e).__name__}: {e}", "detail": traceback.format_exc()}


@app.get("/api/calls/{gong_id}/summary/refresh")
def call_summary_refresh(gong_id: str):
    """Force-regenerate the cached summary."""
    with db.tx() as conn:
        conn.execute("DELETE FROM gong_summaries WHERE gong_id = ?", (gong_id,))
    return call_summary(gong_id)


@app.get("/api/companies/{company_name}/calls")
def company_calls(company_name: str):
    # company_name may be the full HubSpot name (e.g. "Del-Air Heating, Air Conditioning...")
    # but gong_calls.company_name only has the short extracted name (e.g. "Del-Air").
    # Also search by deal_id to catch calls matched via deal linkage.
    # And generate short-name tokens for fuzzy matching.

    # Short name = first meaningful token(s) before a comma or dash-word boundary
    import re as _re
    short = _re.split(r'[,\(]', company_name)[0].strip()  # "Del-Air Heating..." → "Del-Air"
    short_words = short.split()
    short2 = " ".join(short_words[:2]) if len(short_words) >= 2 else short  # first two words

    # Get deal IDs associated with this company
    deal_rows = db.q(
        "SELECT hubspot_id FROM deals WHERE company_name = ? OR company_name LIKE ?",
        (company_name, f"%{short2}%")
    )
    deal_ids = [r["hubspot_id"] for r in deal_rows]

    params: list = [f"%{company_name}%", f"%{company_name}%", f"%{short}%", f"%{short}%"]
    deal_clause = ""
    if deal_ids:
        placeholders = ",".join("?" * len(deal_ids))
        deal_clause = f"OR g.deal_id IN ({placeholders})"
        params.extend(deal_ids)

    rows = db.q(f"""
        SELECT g.gong_id, g.title, g.started_at, g.duration_secs, g.rep_slug,
               g.matched_company,
               CASE WHEN t.transcript_text IS NOT NULL AND length(t.transcript_text) > 10
                    THEN 1 ELSE 0 END as has_transcript
        FROM gong_calls g
        LEFT JOIN gong_transcripts t ON t.gong_id = g.gong_id
        WHERE g.matched_company LIKE ? OR g.company_name LIKE ?
           OR g.matched_company LIKE ? OR g.company_name LIKE ?
           {deal_clause}
        ORDER BY g.started_at DESC
    """, params)
    return {"data": rows, "count": len(rows)}


# ── Serve built frontend (production) ──────────────────────────────────────────
import os
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from fastapi import Request

_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.isdir(_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(_dist, "assets")), name="assets")

    # Use a 404 exception handler instead of a catch-all route.
    # A /{full_path:path} catch-all intercepts API routes in Starlette before
    # specific routes can match; the exception handler only fires for true 404s.
    @app.exception_handler(404)
    async def spa_fallback(request: Request, exc):
        if request.url.path.startswith("/api/"):
            return JSONResponse(status_code=404, content={"detail": "Not found"})
        index = os.path.join(_dist, "index.html")
        if os.path.isfile(index):
            return FileResponse(index)
        return JSONResponse(status_code=404, content={"detail": "Not found"})
