# Quinn GTM Dashboard

Single-page go-to-market dashboard for Quinn (meetquinn.ai). Daily snapshot from HubSpot + Gong into SQLite, served via FastAPI, displayed in React.

---

## Quickstart

### 1. API credentials

**HubSpot:**
1. Go to HubSpot → Settings → Integrations → Private Apps → Create a private app
2. Name it "Quinn GTM Dashboard"
3. Scopes: `crm.objects.deals.read`, `crm.objects.companies.read`, `crm.objects.contacts.read`, `crm.schemas.deals.read`, `crm.schemas.companies.read`, `settings.users.read`
4. Copy the token (starts with `pat-na1-...`)

**Gong:**
1. Go to Gong → Settings → Ecosystem → API
2. Create an API key → copy the Access Key and Secret

### 2. Configure

```bash
cd quinn-gtm-dashboard
cp .env.example .env
# Edit .env with your API keys + rep emails
```

Also update `backend/config.py`:
- `QUARTERLY_ARR_TARGET` — set your quarterly new-ARR target if you have one
- `REPS` — verify rep email addresses match HubSpot owner emails exactly
- `STAGE_BUCKET_MAP` — confirm with Arlen how HubSpot deal stages map to early/mid/late

### 3. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Run first snapshot (pulls all HubSpot data into snapshots.db)
python snapshot_hubspot.py

# Optional: Gong (skip if not configured)
python snapshot_gong.py

# Start API server
uvicorn main:app --reload --port 8000
```

### 4. Frontend

```bash
cd frontend
npm install
npm run dev
# Opens at http://localhost:3000
```

---

## Daily snapshots

Snapshots run once daily at 6am ET. Run manually at any time:

```bash
cd backend
python snapshot_hubspot.py   # ~1-2 min
python snapshot_gong.py      # ~30s (90-day lookback)
```

**macOS cron setup:**
```bash
crontab -e
# Add:
0 10 * * * cd /path/to/quinn-gtm-dashboard/backend && /path/to/.venv/bin/python snapshot_hubspot.py >> /tmp/quinn_hs.log 2>&1
0 10 * * * cd /path/to/quinn-gtm-dashboard/backend && /path/to/.venv/bin/python snapshot_gong.py >> /tmp/quinn_gong.log 2>&1
```

---

## Configuration reference

### `backend/config.py`

| Variable | Default | Description |
|---|---|---|
| `QUARTERLY_ARR_TARGET` | `None` | Set to show pipeline coverage ratio instead of raw $ |
| `REPS` | see file | Rep name, email, role, start date |
| `ICP_TIER_MAP` | see file | Industry string → tier (1A/1B/2A/2B/3) |
| `STAGE_BUCKET_MAP` | see file | HubSpot stage name → early/mid/late |
| `STAGE_AGING_THRESHOLDS` | 14/21/30d | Days in stage before "stale" flag |
| `AT_RISK_RENEWAL_DAYS` | 90 | Renewal window for at-risk classification |

### Adding a new rep

1. Add entry to `REPS` in `config.py`
2. Add their email to `.env`
3. Add `REP_COLORS[slug]` in `frontend/src/lib/format.js`

### Fixing vertical/industry mapping

If companies show wrong tiers, add their HubSpot industry value (exact string, lowercased) to `ICP_TIER_MAP` and `VERTICAL_CANONICAL` in `config.py`, then re-run the snapshot.

---

## Data quality notes

- **GRR/NRR** are directional until `contract_start_date` and `contract_end_date` are populated on HubSpot deals
- **Multi-location whitespace** requires `num_locations` on HubSpot company records — ask ops to populate
- **Gong meetings** show ⚠ until credentials are configured
- **Vertical/tier** coverage shows in the Customer Master table header — low coverage means industry isn't populated in HubSpot

---

## File structure

```
quinn-gtm-dashboard/
  backend/
    main.py               FastAPI — all API endpoints
    snapshot_hubspot.py   Daily HubSpot ETL
    snapshot_gong.py      Daily Gong ETL
    db.py                 SQLite schema + helpers
    config.py             ICP tiers, rep config, field mappings
    requirements.txt
  frontend/
    src/
      App.jsx             Shell + sidebar nav
      sections/           One file per dashboard section
        Vitals.jsx
        CustomerTable.jsx
        ClosedWonTrends.jsx
        PerRepPerformance.jsx
        PipelineFunnel.jsx
        VerticalExpansion.jsx
        LeadingIndicators.jsx
        CustomerHealth.jsx
        MultiLocationExpansion.jsx
      lib/
        api.js            API client
        format.js         $, %, date formatters + color maps
  .env.example
```

---

## v2 TODO (when Arlen needs access)

- [ ] Add Google OAuth (FastAPI + `python-jose`)
- [ ] Deploy backend to Render (free tier, add cron via Render Cron Jobs)
- [ ] Deploy frontend to Vercel
- [ ] Move `snapshots.db` to Turso or PlanetScale for shared access
