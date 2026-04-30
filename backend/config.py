import os
from dotenv import load_dotenv

load_dotenv()

# ── API Credentials ────────────────────────────────────────────────────────────
HUBSPOT_API_KEY = os.getenv("HUBSPOT_API_KEY", "")
GONG_ACCESS_KEY = os.getenv("GONG_ACCESS_KEY", "")
GONG_SECRET = os.getenv("GONG_SECRET", "")

DB_PATH = os.getenv("DB_PATH", "snapshots.db")

# ── Business Targets ───────────────────────────────────────────────────────────
# Set to None to show raw pipeline $ instead of coverage ratio
QUARTERLY_ARR_TARGET = None  # e.g. 150_000.0

# ── Rep Configuration ──────────────────────────────────────────────────────────
# start_date: first day in role (for $ closed since start charts)
# role: "ae" (closing) | "sdr" (outbound/prospecting)
REPS = {
    "arlen": {
        "name": "Arlen Marmel",
        "hubspot_owner_email": "arlen@meetquinn.ai",
        # Gong still uses the legacy lunapark.com domain for this account
        "gong_email": "arlen@lunapark.com",
        "role": "ae",
    },
    "derek": {
        "name": "Derek Goldberg",
        # lunapark.com = meetquinn.ai (legacy domain before company rename)
        "hubspot_owner_email": "derek@lunapark.com",
        "role": "ae",
    },
    "grant": {
        "name": "Grant Amerling",
        "hubspot_owner_email": "grant@lunapark.com",
        "role": "ae",
    },
    "luke": {
        "name": "Luke Adrianzen",
        "hubspot_owner_email": "luke@meetquinn.ai",
        # Gong still uses the legacy lunapark.com domain for this account
        "gong_email": "luke@lunapark.com",
        "role": "sdr",
        "hide_from_rep_tabs": True,  # SDR — shown in leading indicators only
    },
}

# ── ICP Tier Mapping ───────────────────────────────────────────────────────────
# Maps normalized industry string → tier label.
# Add rows as needed when new verticals appear in HubSpot.
ICP_TIER_MAP: dict[str, str] = {
    # Tier 1A — core ICP
    "hvac": "1A",
    "heating and air conditioning": "1A",
    "heating, ventilation & air conditioning": "1A",
    "plumbing": "1A",
    "pest control": "1A",
    "extermination": "1A",
    # Tier 1B — similar but higher friction (safety/cert needs)
    "electrical": "1B",
    "electrician": "1B",
    "electrical_electronic_manufacturing": "1B",
    "roofing": "1B",
    "roofing and waterproofing": "1B",
    # Tier 2A — operationally heavy (actively pursuing)
    "field service": "2A",
    "landscaping": "2A",
    "lawn care": "2A",
    "cleaning services": "2A",
    "janitorial": "2A",
    "facilities management": "2A",
    "facilities_services": "2A",
    "property maintenance": "2A",
    "construction": "2A",
    "building_materials": "2A",
    "home services": "2A",
    "consumer_services": "2A",
    "environmental_services": "2A",
    "automotive": "2A",
    # Tier 2B — uncertain fit
    "manufacturing": "2B",
    "distribution": "2B",
    "wholesale": "2B",
    "warehousing": "2B",
    "logistics": "2B",
    "business_supplies_and_equipment": "2B",
    "packaging_and_containers": "2B",
    "consumer_goods": "2B",
    # Tier 3 — lower priority
    "hospitality": "3",
    "hotel": "3",
    "lodging": "3",
    "food service": "3",
    "restaurant": "3",
    "food and beverage": "3",
    "healthcare": "3",
    "medical": "3",
    "health care": "3",
    "health_wellness_and_fitness": "3",
    "pharmaceuticals": "3",
    "retail": "3",
    "insurance": "3",
    "legal_services": "3",
    "computer_software": "3",
    "online_media": "3",
    "airlines_aviation": "3",
}

# ── Vertical Canonical Names ───────────────────────────────────────────────────
# Maps normalized industry → display name used throughout dashboard
VERTICAL_CANONICAL: dict[str, str] = {
    "hvac": "HVAC",
    "heating and air conditioning": "HVAC",
    "heating, ventilation & air conditioning": "HVAC",
    "plumbing": "Plumbing",
    "pest control": "Pest Control",
    "extermination": "Pest Control",
    "electrical": "Electrical",
    "electrician": "Electrical",
    "electrical_electronic_manufacturing": "Electrical",
    "roofing": "Roofing",
    "roofing and waterproofing": "Roofing",
    "field service": "Field Service",
    "landscaping": "Landscaping",
    "lawn care": "Landscaping",
    "cleaning services": "Cleaning Services",
    "janitorial": "Cleaning Services",
    "facilities management": "Facilities Mgmt",
    "facilities_services": "Facilities Mgmt",
    "property maintenance": "Facilities Mgmt",
    "construction": "Construction",
    "building_materials": "Construction",
    "home services": "Home Services",
    "consumer_services": "Home Services",
    "environmental_services": "Environmental Svcs",
    "automotive": "Automotive",
    "manufacturing": "Manufacturing",
    "distribution": "Distribution",
    "wholesale": "Distribution",
    "warehousing": "Distribution",
    "logistics": "Logistics",
    "business_supplies_and_equipment": "B2B Supply",
    "packaging_and_containers": "Manufacturing",
    "consumer_goods": "Consumer Goods",
    "hospitality": "Hospitality",
    "hotel": "Hospitality",
    "lodging": "Hospitality",
    "food service": "Food Service",
    "restaurant": "Food Service",
    "food and beverage": "Food Service",
    "healthcare": "Healthcare",
    "medical": "Healthcare",
    "health care": "Healthcare",
    "health_wellness_and_fitness": "Healthcare",
    "pharmaceuticals": "Healthcare",
    "retail": "Retail",
    "insurance": "Insurance",
    "legal_services": "Legal",
    "computer_software": "Software",
    "online_media": "Media",
    "airlines_aviation": "Aviation",
}

# ── Deal Source Buckets ────────────────────────────────────────────────────────
# Maps HubSpot hs_analytics_source or custom deal_source values → canonical bucket
DEAL_SOURCE_MAP: dict[str, str] = {
    # Outbound
    "outbound": "outbound",
    "cold outreach": "outbound",
    "cold email": "outbound",
    "cold call": "outbound",
    "prospecting": "outbound",
    "sequencing": "outbound",
    # Inbound
    "inbound": "inbound",
    "organic search": "inbound",
    "website": "inbound",
    "content": "inbound",
    "blog": "inbound",
    "seo": "inbound",
    "paid search": "inbound",
    "paid social": "inbound",
    # Referral
    "referral": "referral",
    "word of mouth": "referral",
    "customer referral": "referral",
    "partner referral": "referral",
    # Events
    "event": "event",
    "conference": "event",
    "trade show": "event",
    "webinar": "event",
    # Partnerships
    "partnership": "partnership",
    "channel": "partnership",
    "reseller": "partnership",
}

# ── Pipeline Stage Buckets ─────────────────────────────────────────────────────
# Maps HubSpot stage labels → early/mid/late.
# Update with actual HubSpot stage names after confirming with Arlen.
STAGE_BUCKET_MAP: dict[str, str] = {
    # Quinn actual stage labels (from HubSpot pipeline "Quinn Sales")
    "discovery complete": "early",
    "demo complete": "mid",
    "quote sent": "mid",
    "verbal commit": "late",
    "closed won": "closed_won",
    "closed lost": "closed_lost",
    # Generic fallbacks
    "appointmentscheduled": "early",
    "appointment scheduled": "early",
    "qualified to buy": "early",
    "qualifiedtobuy": "early",
    "discovery": "early",
    "demo scheduled": "early",
    "demo booked": "early",
    "presentationscheduled": "mid",
    "presentation scheduled": "mid",
    "demo completed": "mid",
    "demo held": "mid",
    "evaluation": "mid",
    "proposal sent": "mid",
    "decisionmakerboughtin": "mid",
    "decision maker bought-in": "mid",
    "contractsent": "late",
    "contract sent": "late",
    "negotiation": "late",
    "closedwon": "closed_won",
    "closedlost": "closed_lost",
}

# ── Aging Thresholds (days) ────────────────────────────────────────────────────
STAGE_AGING_THRESHOLDS = {
    "early": 14,
    "mid": 21,
    "late": 30,
}

# ── At-Risk Renewal Window (days) ─────────────────────────────────────────────
AT_RISK_RENEWAL_DAYS = 90

# ── HubSpot Custom Property Name Hints ────────────────────────────────────────
# These are best-guess names — the snapshot script queries the schema at runtime
# and falls back to these if it can't find the field by common aliases.
# Update these with actual HubSpot custom field names if known.
HUBSPOT_PROPERTY_HINTS = {
    "vertical": ["industry", "vertical", "hs_industry"],
    "number_of_locations": ["num_locations", "number_of_locations", "locations", "num_of_locations"],
    "deal_source": ["deal_source", "hs_analytics_source", "lead_source", "source"],
    "contract_start": ["contract_start_date", "start_date"],
    "contract_end": ["contract_end_date", "renewal_date", "end_date"],
    # hs_arr is HubSpot's native ARR field — 94% populated on Quinn deals
    "arr": ["hs_arr", "current_arr", "initial_arr", "annual_recurring_revenue"],
    "mrr": ["hs_mrr", "mrr", "monthly_recurring_revenue"],
    "acv": ["hs_acv", "acv", "annual_contract_value"],
    "year_1_price": ["year_1_price"],
    "contract_term_months": ["contract_term_months"],
    "products_used": ["products", "products_used", "product_line"],
    "csm": ["csm", "customer_success_manager", "csm_owner"],
    "status": ["customer_status", "account_status"],
}
