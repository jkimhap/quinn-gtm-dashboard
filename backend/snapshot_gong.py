"""
Daily snapshot: Gong → SQLite.

Gong uses HTTP Basic auth: access_key as user, secret as password.
Run: python snapshot_gong.py
Cron: 0 10 * * *  (6am ET = 10:00 UTC)
"""

import json
import logging
import sys
from datetime import datetime, timedelta, timezone
from typing import Any

import requests
from requests.auth import HTTPBasicAuth

import db
from config import GONG_ACCESS_KEY, GONG_SECRET, REPS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

GONG_BASE = "https://api.gong.io"
LOOKBACK_DAYS = 90  # how many days back to pull calls on each run


def auth() -> HTTPBasicAuth:
    return HTTPBasicAuth(GONG_ACCESS_KEY, GONG_SECRET)


def gong_get(path: str, params: dict = None) -> dict:
    r = requests.get(f"{GONG_BASE}{path}", auth=auth(), params=params or {}, timeout=30)
    r.raise_for_status()
    return r.json()


def gong_post(path: str, body: dict) -> dict:
    r = requests.post(f"{GONG_BASE}{path}", auth=auth(), json=body, timeout=30)
    r.raise_for_status()
    return r.json()


def paginate_calls(body: dict) -> list[dict]:
    """POST /v2/calls with cursor pagination."""
    results = []
    cursor = None
    while True:
        if cursor:
            body["cursor"] = cursor
        data = gong_post("/v2/calls", body)
        batch = data.get("calls", [])
        results.extend(batch)
        records = data.get("records", {})
        cursor = records.get("cursor")
        if not cursor or len(batch) == 0:
            break
    return results


def build_email_to_slug() -> dict[str, str]:
    return {r["hubspot_owner_email"].lower(): slug for slug, r in REPS.items()}


def build_gong_user_map(email_to_slug: dict[str, str]) -> dict[str, str]:
    """Returns {gong_user_id: slug}."""
    data = gong_get("/v2/users")
    id_to_slug: dict[str, str] = {}
    for u in data.get("users", []):
        email = (u.get("emailAddress") or "").lower()
        slug = email_to_slug.get(email, "")
        if slug:
            id_to_slug[u["id"]] = slug
        else:
            # Still index by id so we can store unmatched calls
            id_to_slug[u["id"]] = ""
    log.info("Mapped %d Gong users", len(id_to_slug))
    return id_to_slug


def run():
    if not GONG_ACCESS_KEY or not GONG_SECRET:
        log.warning("GONG_ACCESS_KEY or GONG_SECRET not set — skipping Gong snapshot")
        with db.tx() as conn:
            db.set_snapshot_meta(conn, "gong", "skipped", 0, "Credentials not configured")
        return

    db.init_db()
    rows_written = 0
    error = ""

    try:
        email_to_slug = build_email_to_slug()
        user_map = build_gong_user_map(email_to_slug)

        # Pull calls from last LOOKBACK_DAYS days
        since = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).strftime(
            "%Y-%m-%dT%H:%M:%SZ"
        )
        body = {
            "filter": {
                "fromDateTime": since,
            }
        }

        calls = paginate_calls(body)
        log.info("Fetched %d calls from Gong", len(calls))

        with db.tx() as conn:
            for c in calls:
                # Each call has a "parties" list — find rep party
                parties = c.get("parties", [])
                rep_slug = ""
                rep_email = ""
                for party in parties:
                    if party.get("speakerRole") == "rep" or party.get("affiliation") == "Internal":
                        uid = party.get("userId") or party.get("id") or ""
                        rep_slug = user_map.get(uid, "")
                        rep_email = (party.get("emailAddress") or "").lower()
                        if rep_slug:
                            break

                # Also try primaryUserId at call level
                if not rep_slug:
                    primary_uid = c.get("primaryUserId") or ""
                    rep_slug = user_map.get(primary_uid, "")

                duration = c.get("duration") or 0
                started_at_raw = c.get("started") or c.get("startTime") or ""
                started_at = started_at_raw[:19].replace("T", " ") if started_at_raw else None

                # CRM context (optional)
                crm = c.get("crmContext") or []
                deal_id = None
                company_name = ""
                for ctx in crm:
                    if ctx.get("objectType") == "deal":
                        deal_id = str(ctx.get("objectId", ""))
                    if ctx.get("objectType") == "company":
                        company_name = ctx.get("name") or ""

                row = {
                    "gong_id": str(c["id"]),
                    "title": c.get("title") or "",
                    "started_at": started_at,
                    "duration_secs": int(duration),
                    "rep_email": rep_email,
                    "rep_slug": rep_slug,
                    "deal_id": deal_id,
                    "company_name": company_name,
                    "direction": c.get("direction") or "",
                    "raw": json.dumps(c),
                }
                db.upsert_gong_call(conn, row)
                rows_written += 1

        with db.tx() as conn:
            db.set_snapshot_meta(conn, "gong", "ok", rows_written)

        log.info("Gong snapshot complete — %d calls written", rows_written)

    except Exception as e:
        error = str(e)
        log.exception("Gong snapshot failed")
        with db.tx() as conn:
            db.set_snapshot_meta(conn, "gong", "error", rows_written, error)
        sys.exit(1)


if __name__ == "__main__":
    run()
