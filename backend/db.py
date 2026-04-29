"""SQLite schema + query helpers."""

import sqlite3
import json
from contextlib import contextmanager
from config import DB_PATH


# ── Schema ─────────────────────────────────────────────────────────────────────

SCHEMA = """
CREATE TABLE IF NOT EXISTS companies (
    hubspot_id      TEXT PRIMARY KEY,
    name            TEXT,
    industry        TEXT,
    vertical        TEXT,
    icp_tier        TEXT,
    employees       INTEGER,
    annual_revenue  REAL,
    city            TEXT,
    state           TEXT,
    num_locations   INTEGER,
    domain          TEXT,
    raw             TEXT,  -- full JSON blob
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deals (
    hubspot_id          TEXT PRIMARY KEY,
    deal_name           TEXT,
    company_id          TEXT,
    company_name        TEXT,
    stage               TEXT,
    stage_bucket        TEXT,   -- early/mid/late/closed_won/closed_lost
    pipeline            TEXT,
    amount              REAL,   -- TCV
    arr                 REAL,
    mrr                 REAL,
    acv                 REAL,
    close_date          TEXT,
    create_date         TEXT,
    closed_won_date     TEXT,
    contract_start      TEXT,
    contract_end        TEXT,
    owner_id            TEXT,
    owner_name          TEXT,
    owner_slug          TEXT,
    deal_source         TEXT,   -- outbound/inbound/referral/event/partnership/unknown
    deal_source_raw     TEXT,
    csm                 TEXT,
    status              TEXT,   -- active/at-risk/churned
    products_used       TEXT,
    vertical            TEXT,
    icp_tier            TEXT,
    is_closed_won       INTEGER DEFAULT 0,
    is_closed_lost      INTEGER DEFAULT 0,
    days_to_close       INTEGER,
    raw                 TEXT,
    updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS deal_stage_history (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    deal_id         TEXT,
    stage           TEXT,
    stage_bucket    TEXT,
    entered_at      TEXT,
    exited_at       TEXT,
    days_in_stage   INTEGER
);

CREATE TABLE IF NOT EXISTS gong_calls (
    gong_id         TEXT PRIMARY KEY,
    title           TEXT,
    started_at      TEXT,
    duration_secs   INTEGER,
    rep_email       TEXT,
    rep_slug        TEXT,
    deal_id         TEXT,
    company_name    TEXT,
    direction       TEXT,
    raw             TEXT,
    updated_at      TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS owners (
    hubspot_owner_id    TEXT PRIMARY KEY,
    email               TEXT,
    first_name          TEXT,
    last_name           TEXT,
    slug                TEXT,
    updated_at          TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS snapshot_meta (
    source      TEXT PRIMARY KEY,  -- "hubspot" | "gong"
    ran_at      TEXT,
    status      TEXT,
    rows_written INTEGER,
    error       TEXT
);
"""

INDEXES = """
CREATE INDEX IF NOT EXISTS idx_deals_company       ON deals(company_id);
CREATE INDEX IF NOT EXISTS idx_deals_owner         ON deals(owner_slug);
CREATE INDEX IF NOT EXISTS idx_deals_close_date    ON deals(close_date);
CREATE INDEX IF NOT EXISTS idx_deals_stage_bucket  ON deals(stage_bucket);
CREATE INDEX IF NOT EXISTS idx_deals_is_won        ON deals(is_closed_won);
CREATE INDEX IF NOT EXISTS idx_gong_rep            ON gong_calls(rep_slug);
CREATE INDEX IF NOT EXISTS idx_gong_started        ON gong_calls(started_at);
"""


def get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


@contextmanager
def tx():
    conn = get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    with tx() as conn:
        conn.executescript(SCHEMA)
        conn.executescript(INDEXES)


# ── Upsert helpers ─────────────────────────────────────────────────────────────

def upsert_company(conn: sqlite3.Connection, row: dict):
    conn.execute("""
        INSERT INTO companies
            (hubspot_id, name, industry, vertical, icp_tier, employees,
             annual_revenue, city, state, num_locations, domain, raw, updated_at)
        VALUES
            (:hubspot_id,:name,:industry,:vertical,:icp_tier,:employees,
             :annual_revenue,:city,:state,:num_locations,:domain,:raw, datetime('now'))
        ON CONFLICT(hubspot_id) DO UPDATE SET
            name=excluded.name, industry=excluded.industry, vertical=excluded.vertical,
            icp_tier=excluded.icp_tier, employees=excluded.employees,
            annual_revenue=excluded.annual_revenue, city=excluded.city, state=excluded.state,
            num_locations=excluded.num_locations, domain=excluded.domain,
            raw=excluded.raw, updated_at=datetime('now')
    """, row)


def upsert_deal(conn: sqlite3.Connection, row: dict):
    conn.execute("""
        INSERT INTO deals
            (hubspot_id, deal_name, company_id, company_name, stage, stage_bucket,
             pipeline, amount, arr, mrr, acv, close_date, create_date,
             closed_won_date, contract_start, contract_end, owner_id, owner_name,
             owner_slug, deal_source, deal_source_raw, csm, status, products_used,
             vertical, icp_tier, is_closed_won, is_closed_lost, days_to_close,
             raw, updated_at)
        VALUES
            (:hubspot_id,:deal_name,:company_id,:company_name,:stage,:stage_bucket,
             :pipeline,:amount,:arr,:mrr,:acv,:close_date,:create_date,
             :closed_won_date,:contract_start,:contract_end,:owner_id,:owner_name,
             :owner_slug,:deal_source,:deal_source_raw,:csm,:status,:products_used,
             :vertical,:icp_tier,:is_closed_won,:is_closed_lost,:days_to_close,
             :raw, datetime('now'))
        ON CONFLICT(hubspot_id) DO UPDATE SET
            deal_name=excluded.deal_name, company_id=excluded.company_id,
            company_name=excluded.company_name, stage=excluded.stage,
            stage_bucket=excluded.stage_bucket, pipeline=excluded.pipeline,
            amount=excluded.amount, arr=excluded.arr, mrr=excluded.mrr,
            acv=excluded.acv, close_date=excluded.close_date, create_date=excluded.create_date,
            closed_won_date=excluded.closed_won_date, contract_start=excluded.contract_start,
            contract_end=excluded.contract_end, owner_id=excluded.owner_id,
            owner_name=excluded.owner_name, owner_slug=excluded.owner_slug,
            deal_source=excluded.deal_source, deal_source_raw=excluded.deal_source_raw,
            csm=excluded.csm, status=excluded.status, products_used=excluded.products_used,
            vertical=excluded.vertical, icp_tier=excluded.icp_tier,
            is_closed_won=excluded.is_closed_won, is_closed_lost=excluded.is_closed_lost,
            days_to_close=excluded.days_to_close, raw=excluded.raw,
            updated_at=datetime('now')
    """, row)


def upsert_owner(conn: sqlite3.Connection, row: dict):
    conn.execute("""
        INSERT INTO owners (hubspot_owner_id, email, first_name, last_name, slug, updated_at)
        VALUES (:hubspot_owner_id, :email, :first_name, :last_name, :slug, datetime('now'))
        ON CONFLICT(hubspot_owner_id) DO UPDATE SET
            email=excluded.email, first_name=excluded.first_name,
            last_name=excluded.last_name, slug=excluded.slug, updated_at=datetime('now')
    """, row)


def upsert_gong_call(conn: sqlite3.Connection, row: dict):
    conn.execute("""
        INSERT INTO gong_calls
            (gong_id, title, started_at, duration_secs, rep_email, rep_slug,
             deal_id, company_name, direction, raw, updated_at)
        VALUES
            (:gong_id,:title,:started_at,:duration_secs,:rep_email,:rep_slug,
             :deal_id,:company_name,:direction,:raw, datetime('now'))
        ON CONFLICT(gong_id) DO UPDATE SET
            title=excluded.title, started_at=excluded.started_at,
            duration_secs=excluded.duration_secs, rep_email=excluded.rep_email,
            rep_slug=excluded.rep_slug, deal_id=excluded.deal_id,
            company_name=excluded.company_name, direction=excluded.direction,
            raw=excluded.raw, updated_at=datetime('now')
    """, row)


def set_snapshot_meta(conn: sqlite3.Connection, source: str, status: str,
                       rows: int = 0, error: str = ""):
    conn.execute("""
        INSERT INTO snapshot_meta (source, ran_at, status, rows_written, error)
        VALUES (?, datetime('now'), ?, ?, ?)
        ON CONFLICT(source) DO UPDATE SET
            ran_at=datetime('now'), status=excluded.status,
            rows_written=excluded.rows_written, error=excluded.error
    """, (source, status, rows, error))


# ── Query helpers used by main.py ─────────────────────────────────────────────

def q(sql: str, params=()) -> list[dict]:
    conn = get_conn()
    try:
        rows = conn.execute(sql, params).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def q1(sql: str, params=()) -> "dict | None":
    rows = q(sql, params)
    return rows[0] if rows else None
