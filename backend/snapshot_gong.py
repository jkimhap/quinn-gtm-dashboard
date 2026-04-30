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
LOOKBACK_DAYS = 365


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


def fetch_speaker_map(call_ids, user_map):
    """
    POST /v2/calls/extensive in batches of 50.
    Returns {call_id: {speaker_id: label_string}}.

    The transcript API uses a per-call `speakerId` that is DIFFERENT from the
    Gong user ID returned by /v2/users.  The extensive endpoint's `parties`
    array bridges them:  party.speakerId ↔ party.userId (= Gong user ID).

    Internal (Quinn) parties are labelled with their first name; external
    parties get their real name so the AI summary knows who said what.
    """
    from config import REPS as _REPS
    result = {}

    for i in range(0, len(call_ids), 50):
        batch = call_ids[i:i+50]
        try:
            data = gong_post("/v2/calls/extensive", {
                "filter": {"callIds": batch},
                "contentSelector": {
                    "exposedFields": {"parties": True}
                },
            })
            for call in data.get("calls", []):
                cid = str(call.get("metaData", {}).get("id") or "")
                speaker_labels = {}
                for p in call.get("parties", []):
                    sid = str(p.get("speakerId") or "")
                    if not sid:
                        continue
                    uid = str(p.get("userId") or "")
                    affiliation = p.get("affiliation", "")
                    name = (p.get("name") or "").strip()

                    if affiliation == "Internal":
                        # Map via userId → slug → REPS name
                        slug = user_map.get(uid, "")
                        if slug and slug in _REPS:
                            label = _REPS[slug]["name"].split()[0]  # first name only
                        else:
                            label = name.split()[0] if name else "Quinn Team"
                    else:
                        # Use the prospect's real name for richer AI context
                        label = name or "Prospect"

                    speaker_labels[sid] = label
                if cid:
                    result[cid] = speaker_labels
        except Exception as e:
            log.warning("Extensive batch failed (speaker map): %s", e)

    return result


def fetch_transcripts(call_ids, speaker_map=None):
    """POST /v2/calls/transcript in batches of 50. Returns {gong_id: labeled_text}.

    Each line is "[Speaker Name]: sentence".  speaker_map is {call_id: {speaker_id: label}}
    built by fetch_speaker_map(); falls back to "Prospect" if not available.
    """
    speaker_map = speaker_map or {}
    results = {}

    for i in range(0, len(call_ids), 50):
        batch = call_ids[i:i+50]
        try:
            data = gong_post("/v2/calls/transcript", {"filter": {"callIds": batch}})
            for ct in data.get("callTranscripts", []):
                cid = ct["callId"]
                call_speakers = speaker_map.get(cid, {})
                lines = []
                for speaker_block in ct.get("transcript", []):
                    sid = str(speaker_block.get("speakerId") or "")
                    label = call_speakers.get(sid, "Prospect")
                    for s in speaker_block.get("sentences", []):
                        text = s.get("text", "").strip()
                        if text:
                            lines.append(f"[{label}]: {text}")
                results[cid] = "\n".join(lines)
        except Exception as e:
            log.warning("Transcript batch failed: %s", e)

    return results


def extract_company_from_title(title):
    """
    Parse prospect company from call title patterns like:
      'Quinn <> Del-Air'              → 'Del-Air'
      'Quinn <> Burns Pest Followup'  → 'Burns Pest'
      'Del-Air <> Quinn'              → 'Del-Air'  (reversed)
      'Spartan x Quinn'               → 'Spartan'  (x separator)
      'Intro to Quinn'                → None
    """
    title = title or ""
    NOISE = r'(?:followup|follow[\s-]?up|check[\s-]?in|demo|pitch|call|meeting|discussion|overview|next steps|renewal|touchbase|touch base|reconnect|sync|intro|training|kickoff|alignment)'

    # Pattern 1: Quinn/Luna Park <> COMPANY [optional suffix]
    m = re.search(
        r'(?:Quinn|Luna Park)\s*(?:<>|x|–|-)\s*(.+?)(?:\s+' + NOISE + r'.*)?$',
        title, re.IGNORECASE
    )
    if m:
        company = m.group(1).strip()
        company = re.sub(r'\s+' + NOISE + r'.*$', '', company, flags=re.IGNORECASE).strip()
        if company and len(company) > 2 and not re.match(r'^(?:discussion|followup|follow.?up|intro|call|sync|update)$', company, re.IGNORECASE):
            return company

    # Pattern 2: COMPANY <> Quinn [optional suffix] (reversed)
    m2 = re.search(
        r'^(.+?)\s*(?:<>|x)\s*(?:Quinn|Luna Park)(?:\s+' + NOISE + r'.*)?$',
        title, re.IGNORECASE
    )
    if m2:
        company = m2.group(1).strip()
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


def normalize(s):
    """Normalize for fuzzy matching: lowercase, collapse hyphen/space."""
    return re.sub(r'[-\s]+', ' ', s.lower()).strip()


def match_company(extracted, company_map):
    """Fuzzy match extracted company name against known deal companies."""
    if not extracted:
        return None, None
    key = extracted.lower().strip()
    key_norm = normalize(extracted)

    # Exact match (raw)
    if key in company_map:
        return company_map[key]

    # Exact match (normalized — e.g. "Del Air" matches "Del-Air")
    for known_key, val in company_map.items():
        if normalize(known_key) == key_norm:
            return val

    # Substring match (raw)
    for known_key, val in company_map.items():
        if key in known_key or known_key in key:
            return val

    # Substring match (normalized)
    for known_key, val in company_map.items():
        nk = normalize(known_key)
        if key_norm in nk or nk in key_norm:
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
    """Returns ({gong_user_id: slug_or_firstname}, {gong_user_id: slug_only}).

    For users in REPS, value is the slug (e.g. "arlen").
    For all other internal Gong users, value is their first name (e.g. "Ben")
    so the rep column is never blank for internal calls.
    """
    data = gong_get("/v2/users")
    id_to_slug = {}      # slug for REPS, first name for others
    id_to_slug_only = {} # slug for REPS only (used for speaker attribution)
    for u in data.get("users", []):
        email = (u.get("emailAddress") or "").lower()
        slug = email_to_slug.get(email, "")
        first_name = (u.get("firstName") or "").strip()
        uid = u["id"]
        id_to_slug[uid] = slug if slug else first_name
        id_to_slug_only[uid] = slug
    log.info("Mapped %d Gong users", len(id_to_slug))
    return id_to_slug, id_to_slug_only


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
        # user_map: gong_id → slug (REPS) or first name (everyone else)
        # slug_map: gong_id → slug (REPS only, for speaker attribution logic)
        user_map, slug_only_map = build_gong_user_map(email_to_slug)
        company_map = build_company_deal_map()

        since = (datetime.now(timezone.utc) - timedelta(days=LOOKBACK_DAYS)).strftime("%Y-%m-%dT%H:%M:%SZ")
        calls = paginate_calls(since)
        log.info("Fetched %d calls from Gong", len(calls))

        # Build speakerId→label map via /v2/calls/extensive (parties)
        call_ids = [str(c["id"]) for c in calls]
        log.info("Fetching speaker parties for %d calls...", len(call_ids))
        speaker_map = fetch_speaker_map(call_ids, slug_only_map)
        log.info("Speaker map built for %d calls", len(speaker_map))

        # Fetch transcripts with correct speaker labels
        log.info("Fetching transcripts for %d calls...", len(call_ids))
        transcripts = fetch_transcripts(call_ids, speaker_map=speaker_map)
        log.info("Got %d transcripts", len(transcripts))

        with db.tx() as conn:
            for c in calls:
                cid = str(c["id"])
                title = c.get("title") or ""

                # Rep resolution via primaryUserId: slug for REPS, first name for others
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
