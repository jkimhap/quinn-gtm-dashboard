export function fmt$( val, opts = {}) {
  if (val == null) return "—";
  const { compact = false, decimals = 0 } = opts;
  if (compact) {
    if (Math.abs(val) >= 1_000_000) return `$${(val / 1_000_000).toFixed(1)}M`;
    if (Math.abs(val) >= 1_000) return `$${(val / 1_000).toFixed(0)}K`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: decimals,
  }).format(val);
}

export function fmtK(val) {
  if (val == null) return "—";
  if (Math.abs(val) >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
  if (Math.abs(val) >= 1_000) return `${(val / 1_000).toFixed(0)}K`;
  return String(val);
}

export function fmtPct(val, { sign = false } = {}) {
  if (val == null) return "—";
  const prefix = sign && val > 0 ? "+" : "";
  return `${prefix}${val.toFixed(1)}%`;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

export function fmtDays(n) {
  if (n == null) return "—";
  return `${Math.round(n)}d`;
}

export const TIER_COLORS = {
  "1A": "#10b981",
  "1B": "#14b8a6",
  "2A": "#3b82f6",
  "2B": "#6b7280",
  "3":  "#f97316",
  "Unknown": "#374151",
};

export const REP_COLORS = {
  arlen: "#6366f1",
  derek: "#f59e0b",
  grant: "#10b981",
  luke:  "#ec4899",
};

export const SOURCE_COLORS = {
  outbound:    "#6366f1",
  inbound:     "#10b981",
  referral:    "#f59e0b",
  event:       "#14b8a6",
  partnership: "#a78bfa",
  unknown:     "#374151",
};

export const VERTICAL_COLORS = {
  "HVAC":            "#2897a8",
  "Plumbing":        "#3b82f6",
  "Pest Control":    "#10b981",
  "Electrical":      "#f59e0b",
  "Roofing":         "#f97316",
  "Construction":    "#8b5cf6",
  "Manufacturing":   "#6b7280",
  "Distribution":    "#9ca3af",
  "Hospitality":     "#ec4899",
  "Food Service":    "#ef4444",
  "Healthcare":      "#14b8a6",
  "Landscaping":     "#84cc16",
  "Home Services":   "#0ea5e9",
  "Cleaning Services": "#a78bfa",
  "Facilities Mgmt": "#fb923c",
};

export function verticalColor(v) {
  return VERTICAL_COLORS[v] || "#374151";
}
