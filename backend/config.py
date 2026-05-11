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
# Maps normalized HubSpot industry string → tier label (T1–T4).
# HubSpot sends industry in CAPS_UNDERSCORE format — all keys are lowercased
# at runtime via normalize_industry() before lookup.
# T1 = core ICP (HVAC, Plumbing, Pest Control, Electrical, Roofing — 50+ emp)
# T2 = strong fit (Landscaping, Cleaning, Facilities, Construction, Home Svcs)
# T3 = possible fit (Healthcare, Hospitality, Manufacturing, etc.)
# T4 = non-core / low priority
ICP_TIER_MAP: dict[str, str] = {
    # ── T1: Core ICP ──────────────────────────────────────────────────────────
    # HVAC
    "hvac": "T1",
    "heating and air conditioning": "T1",
    "heating, ventilation & air conditioning": "T1",
    # Plumbing
    "plumbing": "T1",
    # Pest Control
    "pest control": "T1",
    "extermination": "T1",
    # Electrical
    "electrical": "T1",
    "electrician": "T1",
    "electrical_electronic_manufacturing": "T1",
    # Roofing
    "roofing": "T1",
    "roofing and waterproofing": "T1",

    # ── T2: Strong Fit ────────────────────────────────────────────────────────
    # Facilities / Field Service
    "field service": "T2",
    "facilities management": "T2",
    "facilities_services": "T2",
    "property maintenance": "T2",
    # Landscaping / Lawn Care
    "landscaping": "T2",
    "lawn care": "T2",
    # Cleaning / Janitorial
    "cleaning services": "T2",
    "janitorial": "T2",
    # Construction / Building
    "construction": "T2",
    "building_materials": "T2",
    # Home Services / Consumer Services
    "home services": "T2",
    "consumer_services": "T2",
    # Environmental / Industrial Automation / Utilities (field-heavy)
    "environmental_services": "T2",
    "renewables_environment": "T2",
    "utilities": "T2",
    # Automotive
    "automotive": "T2",
    # Security / Surveillance
    "security_and_investigations": "T2",
    # Machinery / Industrial Engineering (field techs on-site)
    "machinery": "T2",
    "mechanical_or_industrial_engineering": "T2",
    "industrial_automation": "T2",

    # ── T3: Possible Fit ──────────────────────────────────────────────────────
    # Manufacturing / Distribution
    "manufacturing": "T3",
    "distribution": "T3",
    "wholesale": "T3",
    "warehousing": "T3",
    "logistics": "T3",
    "logistics_and_supply_chain": "T3",
    "transportation_trucking_railroad": "T3",
    "business_supplies_and_equipment": "T3",
    "packaging_and_containers": "T3",
    "consumer_goods": "T3",
    # Healthcare / Medical
    "healthcare": "T3",
    "medical": "T3",
    "health care": "T3",
    "health_wellness_and_fitness": "T3",
    "hospital_health_care": "T3",
    "medical_devices": "T3",
    "pharmaceuticals": "T3",
    "biotechnology": "T3",
    # Food / Hospitality
    "hospitality": "T3",
    "hotel": "T3",
    "lodging": "T3",
    "food service": "T3",
    "restaurant": "T3",
    "restaurants": "T3",
    "food and beverage": "T3",
    "food_beverages": "T3",
    "food_production": "T3",
    # Retail
    "retail": "T3",
    # Real Estate / Property Management
    "real_estate": "T3",
    # Farming / Agriculture
    "farming": "T3",
    # Other operationally complex
    "printing": "T3",
    "chemicals": "T3",
    "plastics": "T3",
    "mining_metals": "T3",
    "shipbuilding": "T3",
    "furniture": "T3",

    # ── T4: Non-core / Low Priority ───────────────────────────────────────────
    "insurance": "T4",
    "legal_services": "T4",
    "computer_software": "T4",
    "information_technology_and_services": "T4",
    "online_media": "T4",
    "airlines_aviation": "T4",
    "aviation_aerospace": "T4",
    "defense_space": "T4",
    "telecommunications": "T4",
    "consumer_electronics": "T4",
    "capital_markets": "T4",
    "management_consulting": "T4",
    "professional_training_coaching": "T4",
    "events_services": "T4",
    "non_profit_organization_management": "T4",
    "religious_institutions": "T4",
    "research": "T4",
    "textiles": "T4",
    "oil_energy": "T4",
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
