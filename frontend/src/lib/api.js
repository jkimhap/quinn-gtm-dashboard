const BASE = "/api";

async function get(path, params = {}) {
  const url = new URL(BASE + path, window.location.origin);
  Object.entries(params).forEach(([k, v]) => v != null && url.searchParams.set(k, v));
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

async function post(path) {
  const res = await fetch(BASE + path, { method: "POST" });
  if (!res.ok) throw new Error(`API ${path} → ${res.status}`);
  return res.json();
}

export const api = {
  health: () => get("/health"),
  refresh: () => post("/refresh"),
  vitals: () => get("/vitals"),
  customers: (params) => get("/customers", params),
  customersExport: (params) => {
    const url = new URL(BASE + "/customers", window.location.origin);
    Object.entries({ ...params, export: true }).forEach(([k, v]) =>
      v != null && url.searchParams.set(k, v)
    );
    return url.toString();
  },
  trends: (months = 12) => get("/trends", { months }),
  repPerformance: (slug) => get(`/reps/${slug}/performance`),
  allReps: () => get("/reps"),
  pipeline: (rep = null) => get("/pipeline", { rep }),
  verticals: () => get("/verticals"),
  leadingIndicators: () => get("/leading-indicators"),
  retention: () => get("/retention"),
  locations: () => get("/locations"),
  calls: (params) => get("/calls", params),
  callTranscript: (gongId) => get(`/calls/${gongId}/transcript`),
  callSummary: (gongId) => get(`/calls/${gongId}/summary`),
  callSummaryRefresh: (gongId) => get(`/calls/${gongId}/summary/refresh`),
  companyCalls: (companyName) => get(`/companies/${encodeURIComponent(companyName)}/calls`),
  // GTM
  icpSummary: () => get("/gtm/icp-summary"),
  conversionFunnel: () => get("/gtm/conversion-funnel"),
  firstCalls: (days = 45) => get("/gtm/first-calls", { days }),
  gtmDeals: (params) => get("/gtm/deals", params),
  // Customer Success
  csAdoption: (search) => get("/cs/adoption", { search }),
};
