"""
Daily snapshot: Gong → SQLite.

Pulls calls + transcripts for the last LOOKBACK_DAYS days.
Matches calls to deals by extracting company name from call title
(e.g. "Quinn <> Del-Air" → "Del-Air") and fuzzy-matching against
deal company names in the DB.

Run: python snapshot_gong.py
Cron: 0 10 * * *  (6am ET = 10:00 UTC)
"""

import json
import logging
import re
import sys
from datetime import datetime, timedelta, timezone

import requests
from requests.auth import HTTPBasicAuth

import db
from config import GONG_ACCESS_KEY, GONG_SECRET, REPS

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

GONG_BASE = "https://api.gong.io"
LOOKBACK_DAYS = 180


def auth():
    return HTTPBasicAuth(GONG_ACCESS_KEY, GONG_SECRET)


def gong_get(path, params=None):
    r = requests.get(f"{GONG_BASE}{path}", auth=auth(), params=params or {}, timeout=30)
    r.raise_for_status()
    return r.json()


def gong_post(path, body):
    r = requests.post(f"{GONG_BASE}{path}", auth=auth(), json=body, timeout=30)
    r.raise_for_status()
    return r.json()


def paginate_calls(from_dt):
    """GET /v2/calls with cursor pagination."""
    results = []
    cursor = None
    while True:
        params = {"fromDateTime": from_dt, "limit": 100}
        if cursor:
            params["cursor"] = cursor
        data = gong_get("/v2/calls", params)
        batch = data.get("calls", [])
        results.extend(batch)
        cursor = data.get("records", {}).get("cursor")
        if not cursor or not batch:
            break
    return results


def fetch_transcripts(call_ids):
    """POST /v2/calls/transcript in batches of 50. Returns {gong_id: text}."""
    results = {}
    for i in range(0, len(call_ids), 50):
        batch = call_ids[i:i+50]
        try:
            data = gong_post("/v2/calls/transcript", {"filter": {"callIds": batch}})
            for ct in data.get("callTranscripts", []):
                cid = ct["callId"]
                sentences = []
                for speaker_block in ct.get("transcript", []):
                    for s in speaker_block.get("sentences", []):
                        text = s.get("text", "").strip()
                        if text:
                            sentences.append(text)
                results[cid] = " ".join(sentences)
        except Exception as e:
            log.warning("Transcript batch failed: %s", e)
    return results


def extract_company_from_title(title):
    """
    Parse prospect company from call title patterns like:
      'Quinn <> Del-Air'       → 'Del-Air'
      'Quinn <> Burns Pest Followup' → 'Burns Pest'
      'Intro to Quinn'         → None
    """
    title = title or ""
    # Pattern: Quinn <> COMPANY (optional suffix)
    m = re.search(r'(?:Quinn|Luna Park)\s*(?:<>|–|-)\s*(.+?)(?:\s+(?:Followup|Follow[- ]?Up|Check[- ]?In|Demo|Pitch|Call|Meeting|Discussion|Overview|Next Steps|Renewal).*)?$', title, re.IGNORECASE)
    if m:
        company = m.group(1).strip()
        # Remove trailing punctuation/noise
        company = re.sub(r'\s+(followup|follow up|check.?in|demo|pitch|next steps|renewal|touchbase|touch base).*$', '', company, flags=re.IGNORECASE).strip()
        if company and len(company) > 2:
            return company
    return None


def build_company_deal_map():
    """Returns {normalized_company_name: (company_name, deal_id)} from DB."""
    deals = db.q("SELECT hubspot_id, company_name FROM deals WHERE company_name IS NOT NULL")
    result = {}
    for d in deals:
        name = (d["company_name"] or "").strip()
        if name:
            result[name.lower()] = (name, d["hubspot_id"])
            # Also index short versions (first word, first two words)
            words = name.split()
            if len(words) >= 2:
                result[" ".join(words[:2]).lower()] = (name, d["hubspot_id"])
    return result


def match_company(extracted, company_map):
    """Fuzzy match extracted company name against known deal companies."""
    if not extracted:
        return None, None
    key = extracted.lower().strip()

    # Exact match
    if key in company_map:
        return company_map[key]

    # Substring match: extracted is contained in a known company name
    for known_key, val in company_map.items():
        if key in known_key or known_key in key:
            return val

    return None, None


def build_email_to_slug():
    """Build email→slug map. Includes both hubspot_owner_email and gong_email
    (lunapark.com and meetquinn.ai are the same company — legacy domain migration)."""
    mapping = {}
    for slug, r in REPS.items():
        mapping[r["hubspot_owner_email"].lower()] = slug
        if r.get("gong_email"):
            mapping[r["gong_email"].lower()] = slug
    return mapping


def build_gong_user_map(email_to_slug):
    """Returns {gong_user_id: slug}."""
    data = gong_get("/v2/users")
    id_to_slug = {}
    for u in data.get("users", []):
        email = (u.get("emailAddress") or "").lower()
        slug = email_to_slug.get(email, "")
        id_to_slug[u["id"]] = slug
    log.info("Mapped %d Gong users", len(id_to_slug))
    return id_to_slug


def run():
    if not GONG_ACCESS_KEY or not GONG_SECRET:
        log.warning("GONG credentials not set — skipping")
        with db.tx() as conn:
            db.set_snapshot_meta(conn, "gong", "skipped", 0, "Credentials not configured")
        return

    db.init_db()
    rows_written = 0

    try:
        email_to_slug = build_email_to_slug()
        user_map = build_gong_user_map(email_to_slug)
        company_map = build_company_deal_map()

        since = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
        calls = paginate_calls(since)
        log.info("Fetched %d calls from Gong", len(calls))

        # Fetch transcripts for all calls in batches
        call_ids = [str(c["id"]) for c in calls]
        log.info("Fetching transcripts for %d calls...", len(call_ids))
        transcripts = fetch_transcripts(call_ids)
        log.info("Got %d transcripts", len(transcripts))

        with db.tx() as conn:
            for c in calls:
                cid = str(c["id"])
                title = c.get("title") or ""

                # Rep resolution via primaryUserId
                primary_uid = str(c.get("primaryUserId") or "")
                rep_slug = user_map.get(primary_uid, "")

                duration = c.get("duration") or 0
                started_raw = c.get("started") or c.get("scheduled") or ""
                started_at = started_raw[:19].replace("T", " ") if started_raw else None

                # Company matching from title
                extracted = extract_company_from_title(title)
                matched_name, deal_id = match_company(extracted, company_map)

                row = {
                    "gong_id": cid,
                    "title": title,
                    "started_at": started_at,
                    "duration_secs": int(duration),
                    "rep_email": "",
                    "rep_slug": rep_slug,
                    "deal_id": deal_id,
                    "company_name": extracted or "",
                    "matched_company": matched_name or "",
                    "direction": c.get("direction") or "",
                    "raw": json.dumps(c),
                }
                db.upsert_gong_call(conn, row)

                # Store transcript
                if cid in transcripts and transcripts[cid]:
                    db.upsert_gong_transcript(conn, cid, transcripts[cid])

                rows_written += 1

        with db.tx() as conn:
            db.set_snapshot_meta(conn, "gong", "ok", rows_written)

        log.info("Gong snapshot complete — %d calls, %d transcripts", rows_written, len(transcripts))

    except Exception as e:
        log.exception("Gong snapshot failed")
        with db.tx() as conn:
            db.set_snapshot_meta(conn, "gong", "error", rows_written, str(e))
        sys.exit(1)


if __name__ == "__main__":
    run()
