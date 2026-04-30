"""
Daily snapshot: HubSpot → SQLite.

Run: python snapshot_hubspot.py
Cron: 0 10 * * *  (6am ET = 10:00 UTC)
"""

import json
import logging
import sys
from datetime import datetime, timedelta, date
from typing import Any

import requests

import db
from config import (
    HUBSPOT_API_KEY, REPS, ICP_TIER_MAP, VERTICAL_CANONICAL,
    DEAL_SOURCE_MAP, STAGE_BUCKET_MAP, HUBSPOT_PROPERTY_HINTS,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

BASE = "https://api.hubapi.com"
HEADERS = {"Authorization": f"Bearer {HUBSPOT_API_KEY}", "Content-Type": "application/json"}


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def hs_get(path: str, params: dict = None) -> dict:
    r = requests.get(f"{BASE}{path}", headers=HEADERS, params=params or {}, timeout=30)
    r.raise_for_status()
    return r.json()


def hs_post(path: str, body: dict) -> dict:
    r = requests.post(f"{BASE}{path}", headers=HEADERS, json=body, timeout=30)
    r.raise_for_status()
    return r.json()


def paginate(path: str, params: dict = None, key: str = "results") -> list[dict]:
    """Cursor-paginate a HubSpot list endpoint."""
    results = []
    after = None
    params = params or {}
    while True:
        p = {**params, "limit": 100}
        if after:
            p["after"] = after
        data = hs_get(path, p)
        results.extend(data.get(key, []))
        paging = data.get("paging", {})
        after = paging.get("next", {}).get("after")
        if not after:
            break
    return results


def search_paginate(path: str, body: dict, key: str = "results") -> list[dict]:
    """Cursor-paginate a HubSpot search endpoint (POST)."""
    results = []
    after = 0
    body = {**body, "limit": 100}
    while True:
        body["after"] = after
        data = hs_post(path, body)
        batch = data.get(key, [])
        results.extend(batch)
        paging = data.get("paging", {})
        next_after = paging.get("next", {}).get("after")
        if not next_after or len(batch) == 0:
            break
        after = next_after
    return results


# ── Schema discovery ──────────────────────────────────────────────────────────

def get_property_names(object_type: str) -> set[str]:
    data = hs_get(f"/crm/v3/properties/{object_type}")
    return {p["name"] for p in data.get("results", [])}


def get_stage_label_map() -> dict:
    """Returns {stage_id: stage_label} across all deal pipelines."""
    mapping = {}
    try:
        data = hs_get("/crm/v3/pipelines/deals")
        for pipeline in data.get("results", []):
            for stage in pipeline.get("stages", []):
                mapping[stage["id"]] = stage["label"]
        log.info("Loaded %d pipeline stages", len(mapping))
    except Exception as e:
        log.warning("Could not fetch pipeline stages: %s", e)
    return mapping


def get_deal_company_associations(deal_ids: list) -> dict:
    """Returns {deal_id: company_id} via v4 batch associations endpoint."""
    result = {}
    if not deal_ids:
        return result
    try:
        for i in range(0, len(deal_ids), 100):
            batch = deal_ids[i:i+100]
            body = {"inputs": [{"id": str(did)} for did in batch]}
            data = hs_post("/crm/v4/associations/deals/companies/batch/read", body)
            for item in data.get("results", []):
                from_id = str(item.get("from", {}).get("id", ""))
                to_list = item.get("to", [])
                if from_id and to_list:
                    result[from_id] = str(to_list[0].get("toObjectId", ""))
        log.info("Resolved company associations for %d deals", len(result))
    except Exception as e:
        log.warning("Could not fetch deal-company associations: %s", e)
    return result


def resolve_field(available: set[str], hints: list[str]) -> "Optional[str]":
    """Return the first hint that exists in available field names."""
    for h in hints:
        if h in available:
            return h
    return None


# ── Normalization helpers ─────────────────────────────────────────────────────

def normalize_industry(raw: "Optional[str]") -> str:
    if not raw:
        return ""
    return raw.strip().lower()


def get_vertical(industry_norm: str) -> str:
    return VERTICAL_CANONICAL.get(industry_norm, industry_norm.title() if industry_norm else "Unknown")


def get_tier(industry_norm: str) -> str:
    return ICP_TIER_MAP.get(industry_norm, "Unknown")


def normalize_deal_source(raw: "Optional[str]") -> str:
    if not raw:
        return "unknown"
    key = raw.strip().lower()
    return DEAL_SOURCE_MAP.get(key, "unknown")


def normalize_stage(stage_raw: "Optional[str]") -> str:
    if not stage_raw:
        return "unknown"
    key = stage_raw.strip().lower().replace("-", "").replace("_", "").replace(" ", "")
    for k, v in STAGE_BUCKET_MAP.items():
        nk = k.lower().replace("-", "").replace("_", "").replace(" ", "")
        if key == nk:
            return v
    return "unknown"


def safe_float(v) -> "Optional[float]":
    try:
        return float(v) if v not in (None, "", "null") else None
    except (TypeError, ValueError):
        return None


def safe_int(v) -> "Optional[int]":
    try:
        return int(float(v)) if v not in (None, "", "null") else None
    except (TypeError, ValueError):
        return None


def parse_date(v) -> "Optional[str]":
    if not v:
        return None
    try:
        # HubSpot dates come as ms timestamps or ISO strings
        if isinstance(v, (int, float)) or (isinstance(v, str) and v.isdigit()):
            return datetime.utcfromtimestamp(int(v) / 1000).strftime("%Y-%m-%d")
        return v[:10]
    except Exception:
        return None


def days_between(start: "Optional[str]", end: "Optional[str]") -> "Optional[int]":
    if not start or not end:
        return None
    try:
        d1 = datetime.strptime(start[:10], "%Y-%m-%d")
        d2 = datetime.strptime(end[:10], "%Y-%m-%d")
        return max(0, (d2 - d1).days)
    except Exception:
        return None


# ── Owner mapping ─────────────────────────────────────────────────────────────

def build_owner_slug_map() -> tuple:
    """Returns ({hubspot_owner_id: slug}, {hubspot_owner_id: full_name})."""
    email_to_slug = {r["hubspot_owner_email"].lower(): slug for slug, r in REPS.items()}
    id_to_slug = {}
    id_to_name = {}

    try:
        owners = hs_get("/crm/v3/owners")
        with db.tx() as conn:
            for o in owners.get("results", []):
                email = o.get("email", "").lower()
                slug = email_to_slug.get(email, "")
                first = o.get("firstName", "")
                last = o.get("lastName", "")
                full_name = f"{first} {last}".strip()
                oid = str(o["id"])
                db.upsert_owner(conn, {
                    "hubspot_owner_id": oid,
                    "email": email,
                    "first_name": first,
                    "last_name": last,
                    "slug": slug,
                })
                id_to_slug[oid] = slug
                id_to_name[oid] = full_name
    except Exception as e:
        log.warning("Could not fetch owners (need crm.objects.owners.read scope): %s", e)

    return id_to_slug, id_to_name


# ── Companies ─────────────────────────────────────────────────────────────────

def snapshot_companies(field_map: dict) -> dict[str, dict]:
    """Pull all companies, return {hubspot_id: row}."""
    props = [
        "name", "domain", "city", "state",
        "numberofemployees", "annualrevenue",
        field_map.get("vertical") or "industry",
        field_map.get("number_of_locations") or "num_locations",
    ]
    props = list(set(p for p in props if p))

    raw_companies = paginate("/crm/v3/objects/companies", {"properties": ",".join(props)})
    log.info("Fetched %d companies from HubSpot", len(raw_companies))

    company_map: dict[str, dict] = {}
    rows_written = 0

    with db.tx() as conn:
        for c in raw_companies:
            p = c.get("properties", {})
            cid = str(c["id"])
            industry_raw = p.get(field_map.get("vertical") or "industry") or p.get("industry") or ""
            industry_norm = normalize_industry(industry_raw)

            row = {
                "hubspot_id": cid,
                "name": p.get("name") or "",
                "industry": industry_raw,
                "vertical": get_vertical(industry_norm),
                "icp_tier": get_tier(industry_norm),
                "employees": safe_int(p.get("numberofemployees")),
                "annual_revenue": safe_float(p.get("annualrevenue")),
                "city": p.get("city") or "",
                "state": p.get("state") or "",
                "num_locations": safe_int(
                    p.get(field_map.get("number_of_locations") or "") or p.get("num_locations")
                ),
                "domain": p.get("domain") or "",
                "raw": json.dumps(p),
            }
            db.upsert_company(conn, row)
            company_map[cid] = row
            rows_written += 1

    log.info("Wrote %d companies to DB", rows_written)
    return company_map


# ── Deals ─────────────────────────────────────────────────────────────────────

def _derive_arr_from_tcv(tcv, term_months):
    """Last-resort ARR estimate: TCV ÷ contract length in years."""
    if not tcv:
        return None
    if term_months and term_months > 0:
        return round(tcv / (term_months / 12), 2)
    return tcv  # assume 1-year if no term info


def snapshot_deals(company_map: dict, owner_map: dict, owner_name_map: dict, field_map: dict,
                   stage_label_map: dict) -> int:
    props = [
        "dealname", "amount", "closedate", "createdate",
        "dealstage", "pipeline", "hubspot_owner_id",
        "hs_closed_won_date", "hs_analytics_source",
        "hs_arr", "hs_mrr", "hs_acv",
        "current_arr", "initial_arr", "step_up_arr",
        field_map.get("arr") or "hs_arr",
        field_map.get("mrr") or "hs_mrr",
        field_map.get("acv") or "hs_acv",
        field_map.get("year_1_price") or "year_1_price",
        field_map.get("contract_term_months") or "contract_term_months",
        field_map.get("deal_source") or "deal_source",
        field_map.get("contract_start") or "contract_start_date",
        field_map.get("contract_end") or "contract_end_date",
        field_map.get("csm") or "csm",
        field_map.get("status") or "customer_status",
        field_map.get("products_used") or "products_used",
    ]
    props = list(set(p for p in props if p))

    body = {
        "properties": props,
        "sorts": [{"propertyName": "createdate", "direction": "DESCENDING"}],
        "filterGroups": [],
    }
    raw_deals = search_paginate("/crm/v3/objects/deals/search", body)
    log.info("Fetched %d deals from HubSpot", len(raw_deals))

    # Batch-fetch company associations via v4 endpoint
    deal_ids = [str(d["id"]) for d in raw_deals]
    deal_company_map = get_deal_company_associations(deal_ids)

    rows_written = 0
    with db.tx() as conn:
        for d in raw_deals:
            p = d.get("properties", {})
            did = str(d["id"])

            # Resolve company via batch association lookup
            cid = deal_company_map.get(did)
            company_row = company_map.get(cid, {}) if cid else {}

            owner_id = str(p.get("hubspot_owner_id") or "")
            owner_slug = owner_map.get(owner_id, "")
            # Prefer REPS name → full name from HubSpot owners → slug fallback
            owner_name = (
                REPS.get(owner_slug, {}).get("name")
                or owner_name_map.get(owner_id)
                or owner_slug
                or ""
            )

            # Resolve stage ID → label → bucket
            stage_raw = p.get("dealstage") or ""
            stage_label = stage_label_map.get(stage_raw, stage_raw)
            stage_bucket = normalize_stage(stage_label)
            is_won = 1 if stage_bucket == "closed_won" else 0
            is_lost = 1 if stage_bucket == "closed_lost" else 0

            tcv = safe_float(p.get("amount"))  # always TCV

            # ARR: current_arr → initial_arr → step_up_arr → hs_arr → year_1_price → TCV÷term → TCV
            arr = (
                safe_float(p.get("current_arr")) or
                safe_float(p.get("initial_arr")) or
                safe_float(p.get("step_up_arr")) or
                safe_float(p.get("hs_arr")) or
                safe_float(p.get(field_map.get("arr") or "")) or
                safe_float(p.get("year_1_price")) or
                _derive_arr_from_tcv(tcv, safe_float(p.get("contract_term_months")))
            )
            mrr = (
                safe_float(p.get("hs_mrr")) or
                safe_float(p.get(field_map.get("mrr") or "")) or
                (arr / 12 if arr else None)
            )
            amount = tcv  # keep amount = TCV for deal record

            close_date = parse_date(p.get("closedate"))
            create_date = parse_date(p.get("createdate"))
            closed_won_date = parse_date(p.get("hs_closed_won_date")) or (close_date if is_won else None)

            # Contract start: explicit field → fall back to close_date for won deals
            contract_start = (
                parse_date(p.get(field_map.get("contract_start") or ""))
                or (close_date if is_won else None)
            )
            # Contract end: explicit field → compute from start + term months
            contract_end = parse_date(p.get(field_map.get("contract_end") or ""))
            if not contract_end and contract_start and is_won:
                term_months = safe_int(p.get(field_map.get("contract_term_months") or "contract_term_months"))
                if term_months and term_months > 0:
                    try:
                        import calendar as _cal
                        from datetime import date as _date
                        cs = _date.fromisoformat(contract_start)
                        m = cs.month - 1 + term_months
                        yr, mo = cs.year + m // 12, m % 12 + 1
                        dy = min(cs.day, _cal.monthrange(yr, mo)[1])
                        contract_end = _date(yr, mo, dy).isoformat()
                    except Exception:
                        pass

            source_raw = (p.get(field_map.get("deal_source") or "") or
                          p.get("hs_analytics_source") or "")
            deal_source = normalize_deal_source(source_raw)

            # Status inference: active if won + not churned/past end
            status_raw = p.get(field_map.get("status") or "customer_status") or ""
            if status_raw.lower() in ("churned", "cancelled", "lost"):
                status = "churned"
            elif is_won:
                today = date.today().isoformat()
                if contract_end and contract_end < today:
                    status = "churned"
                elif contract_end and days_between(today, contract_end) is not None and days_between(today, contract_end) <= 90:
                    status = "at-risk"
                else:
                    status = "active"
            else:
                status = "open"

            # Inherit vertical/tier from company if available
            vertical = company_row.get("vertical") or ""
            icp_tier = company_row.get("icp_tier") or ""

            row = {
                "hubspot_id": did,
                "deal_name": p.get("dealname") or "",
                "company_id": cid,
                "company_name": company_row.get("name") or "",
                "stage": stage_raw,
                "stage_bucket": stage_bucket,
                "pipeline": p.get("pipeline") or "",
                "amount": amount,
                "arr": arr,
                "mrr": mrr,
                "acv": arr,
                "close_date": close_date,
                "create_date": create_date,
                "closed_won_date": closed_won_date,
                "contract_start": contract_start,
                "contract_end": contract_end,
                "owner_id": owner_id,
                "owner_name": owner_name,
                "owner_slug": owner_slug,
                "deal_source": deal_source,
                "deal_source_raw": source_raw,
                "csm": p.get(field_map.get("csm") or "csm") or "",
                "status": status,
                "products_used": p.get(field_map.get("products_used") or "products_used") or "",
                "vertical": vertical,
                "icp_tier": icp_tier,
                "is_closed_won": is_won,
                "is_closed_lost": is_lost,
                "days_to_close": days_between(create_date, closed_won_date or close_date) if is_won else None,
                "raw": json.dumps(p),
            }
            db.upsert_deal(conn, row)
            rows_written += 1

    log.info("Wrote %d deals to DB", rows_written)
    return rows_written


# ── Field map resolution ──────────────────────────────────────────────────────

def build_field_map() -> dict:
    log.info("Discovering HubSpot property schemas...")
    deal_fields = get_property_names("deals")
    company_fields = get_property_names("companies")

    field_map: dict = {}
    for key, hints in HUBSPOT_PROPERTY_HINTS.items():
        if key in ("number_of_locations",):
            found = resolve_field(company_fields, hints)
        else:
            found = resolve_field(deal_fields, hints) or resolve_field(company_fields, hints)
        field_map[key] = found
        if found:
            log.info("  %s → %s", key, found)
        else:
            log.warning("  %s → NOT FOUND (will skip)", key)

    return field_map


# ── Entrypoint ────────────────────────────────────────────────────────────────

def run():
    if not HUBSPOT_API_KEY:
        log.error("HUBSPOT_API_KEY not set — aborting")
        sys.exit(1)

    db.init_db()
    rows_written = 0
    error = ""

    try:
        field_map = build_field_map()
        stage_label_map = get_stage_label_map()
        owner_map, owner_name_map = build_owner_slug_map()
        company_map = snapshot_companies(field_map)
        rows_written = snapshot_deals(company_map, owner_map, owner_name_map, field_map, stage_label_map)

        with db.tx() as conn:
            db.set_snapshot_meta(conn, "hubspot", "ok", rows_written)

        log.info("HubSpot snapshot complete — %d deals written", rows_written)

    except Exception as e:
        error = str(e)
        log.exception("HubSpot snapshot failed")
        with db.tx() as conn:
            db.set_snapshot_meta(conn, "hubspot", "error", rows_written, error)
        sys.exit(1)


if __name__ == "__main__":
    run()
