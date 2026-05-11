import React, { useEffect, useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RechartsTip,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { api } from "../lib/api";

// ── Constants ──────────────────────────────────────────────────────────────────

const LIFECYCLE = {
  power:            { label: "Power",            color: "bg-violet-500",  text: "text-violet-600",  border: "border-violet-500/40",  dot: "bg-violet-400",  desc: "MAU ≥ 30 · Progressions ≥ 500" },
  engaged:          { label: "Engaged",           color: "bg-emerald-500", text: "text-emerald-600", border: "border-emerald-500/40", dot: "bg-emerald-400", desc: "MAU ≥ 10 · Progressions ≥ 100" },
  active:           { label: "Active",            color: "bg-blue-500",    text: "text-blue-600",    border: "border-blue-500/40",    dot: "bg-blue-400",    desc: "Some MAU or course activity"   },
  dormant:          { label: "Dormant",           color: "bg-orange-500",  text: "text-orange-600",  border: "border-orange-500/40",  dot: "bg-orange-400",  desc: "Had usage · MAU now zero"      },
  new:              { label: "New",               color: "bg-amber-500",   text: "text-amber-600",   border: "border-amber-500/40",   dot: "bg-amber-400",   desc: "Joined in last 45 days"        },
  never_activated:  { label: "Never Activated",  color: "bg-gray-600",    text: "text-gray-500",    border: "border-gray-600/40",    dot: "bg-gray-600",    desc: "No progressions, 45+ days old" },
};

const STAGE_ORDER = ["power", "engaged", "active", "new", "dormant", "never_activated"];

const ACTION_CONFIG = {
  going_cold:      { label: "Going Cold",       color: "text-red-500",    bg: "bg-rose-50 border-rose-200",    icon: "🧊", priority: 0 },
  onboard_needed:  { label: "Needs Onboarding", color: "text-amber-700",  bg: "bg-amber-50 border-amber-200", icon: "🚀", priority: 1 },
  low_adoption:    { label: "Low Adoption",      color: "text-blue-600",   bg: "bg-blue-50 border-blue-200",   icon: "📉", priority: 2 },
};

const SORT_OPTIONS = [
  { key: "progressions",  label: "Progressions" },
  { key: "mau",           label: "MAU" },
  { key: "total_members", label: "Members"      },
  { key: "arr_hs",        label: "ARR"          },
  { key: "org_name",      label: "Name"         },
];

// ── Small helpers ──────────────────────────────────────────────────────────────

function fmt(n) { return n == null ? "—" : Number(n).toLocaleString(); }
function fmtArr(n) {
  if (n == null) return null;
  if (n >= 1000) return `$${(n / 1000).toFixed(0)}k`;
  return `$${n.toLocaleString()}`;
}

function LifecyclePill({ stage }) {
  const cfg = LIFECYCLE[stage] || LIFECYCLE.active;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full border ${cfg.border} ${cfg.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function ActionBadge({ action }) {
  const cfg = ACTION_CONFIG[action] || ACTION_CONFIG.low_adoption;
  return (
    <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border ${cfg.bg} ${cfg.color}`}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Custom tooltip for the trend chart ────────────────────────────────────────

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-800 rounded-lg px-3 py-2 text-xs shadow-md">
      <div className="text-gray-500 mb-1">{label}</div>
      <div className="text-quinn-600 font-semibold">{fmt(payload[0]?.value)} progressions</div>
      {payload[1] && (
        <div className="text-emerald-600 mt-0.5">{fmt(payload[1]?.value)} new activations</div>
      )}
    </div>
  );
}

// ── Summary stat card ──────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-gray-50", badge, badgeColor }) {
  return (
    <div className="card">
      <div className="text-xs text-gray-500 mb-2 flex items-center justify-between">
        {label}
        {badge != null && (
          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${badgeColor || "bg-gray-900 text-gray-500"}`}>
            {badge}
          </span>
        )}
      </div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>
        {value ?? <span className="text-gray-700">—</span>}
      </div>
      {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}

// ── Lifecycle stage card ───────────────────────────────────────────────────────

function StageCard({ stage, data, selected, onClick }) {
  const cfg = LIFECYCLE[stage];
  const isSelected = selected === stage;
  return (
    <button
      onClick={onClick}
      className={`text-left p-3 rounded-lg border transition-all ${
        isSelected
          ? `${cfg.border} bg-white shadow-sm`
          : "border-gray-800 hover:border-gray-700 bg-white/60 hover:bg-white"
      }`}
    >
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-xs font-medium ${cfg.text}`}>{cfg.label}</span>
        <span className={`text-lg font-bold tabular-nums ${isSelected ? cfg.text : "text-gray-50"}`}>
          {data?.count ?? 0}
        </span>
      </div>
      <div className="text-[10px] text-gray-600 mb-2">{cfg.desc}</div>
      <div className="flex gap-3 text-[10px] text-gray-500">
        {(data?.mau > 0) && <span>{fmt(data.mau)} MAU</span>}
        {(data?.progressions > 0) && <span>{fmt(data.progressions)} prog</span>}
        {(data?.arr > 0) && <span className="text-emerald-500/70">{fmtArr(data.arr)}</span>}
      </div>
    </button>
  );
}

// ── Action Required card ───────────────────────────────────────────────────────

function ActionCard({ org }) {
  const primaryAction = org.actions?.[0];
  const cfg = ACTION_CONFIG[primaryAction] || ACTION_CONFIG.low_adoption;
  const lc = LIFECYCLE[org.lifecycle] || LIFECYCLE.active;

  return (
    <div className={`rounded-lg border p-3 ${cfg.bg}`}>
      <div className="flex items-start justify-between gap-2 mb-1.5">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-50 truncate">{org.org_name}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">{org.product_name || "—"}</div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <ActionBadge action={primaryAction} />
          <LifecyclePill stage={org.lifecycle} />
        </div>
      </div>
      <div className="flex gap-4 text-xs mt-2">
        <div>
          <span className="text-gray-600">Prog </span>
          <span className={org.progressions > 0 ? "text-gray-200" : "text-gray-600"}>{fmt(org.progressions)}</span>
        </div>
        <div>
          <span className="text-gray-600">MAU </span>
          <span className={org.mau > 0 ? "text-emerald-600" : "text-red-500"}>{fmt(org.mau)}</span>
        </div>
        <div>
          <span className="text-gray-600">Members </span>
          <span className="text-gray-400">{fmt(org.total_members)}</span>
        </div>
        {org.arr_hs && (
          <div>
            <span className="text-gray-600">ARR </span>
            <span className="text-emerald-600">{fmtArr(org.arr_hs)}</span>
          </div>
        )}
      </div>
      <div className={`mt-2 text-[10px] italic ${cfg.color}`}>
        {primaryAction === "going_cold" &&
          `${fmt(org.progressions)} all-time progressions but MAU dropped to 0 — at risk of churn`}
        {primaryAction === "onboard_needed" &&
          `${org.age_days} days since joining, no courses created or progressions yet`}
        {primaryAction === "low_adoption" &&
          `${fmt(org.total_members)} seats provisioned, only ${org.learner_pct}% are active learners`}
      </div>
    </div>
  );
}

// ── Skeleton loader ────────────────────────────────────────────────────────────

function Skeleton({ className = "h-8" }) {
  return <div className={`${className} bg-gray-800 rounded animate-pulse`} />;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AdoptionMetrics() {
  const [data, setData]               = useState(null);
  const [err, setErr]                 = useState(null);
  const [selectedStage, setSelectedStage] = useState("all");
  const [search, setSearch]           = useState("");
  const [sortKey, setSortKey]         = useState("progressions");
  const [showAllActions, setShowAllActions] = useState(false);

  useEffect(() => {
    api.csAdoption().then(setData).catch(setErr);
  }, []);

  const meta       = data?.meta;
  const configured = !meta || meta.status !== "skipped";
  const summary    = data?.summary;
  const lifecycle  = data?.lifecycle || {};
  const trends     = data?.trends || [];

  const filteredOrgs = useMemo(() => {
    if (!data?.orgs) return [];
    let list = data.orgs;
    if (selectedStage !== "all") list = list.filter(o => o.lifecycle === selectedStage);
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(o => (o.org_name || "").toLowerCase().includes(s));
    }
    return [...list].sort((a, b) => {
      if (sortKey === "org_name") return (a.org_name || "").localeCompare(b.org_name || "");
      if (sortKey === "arr_hs") return ((b.arr_hs || 0) - (a.arr_hs || 0));
      return ((b[sortKey] || 0) - (a[sortKey] || 0));
    });
  }, [data, selectedStage, search, sortKey]);

  const actionItems = data?.action_required || [];
  const visibleActions = showAllActions ? actionItems : actionItems.slice(0, 6);

  // Trend chart: exclude current (partial) month
  const trendData = useMemo(() => {
    if (!trends.length) return [];
    // If last data point looks partial (this month), exclude it for the main line
    return trends.map((t, i) => ({
      ...t,
      partial: i === trends.length - 1,
    }));
  }, [trends]);

  return (
    <div>
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-serif font-medium text-gray-50 tracking-tight">Customer Success</h2>
        {meta?.ran_at && (
          <span className="text-xs text-gray-600">Synced {meta.ran_at.slice(0, 10)}</span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-5">
        Live product usage from Quinn. Customers classified by activation stage — focus on the Action Required section.
      </p>

      {/* Not configured warning */}
      {!configured && (
        <div className="mb-5 flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>
            Quinn product data not configured. Add{" "}
            <code className="text-amber-600">QUINN_API_TOKEN</code> to Render env vars.
          </span>
        </div>
      )}

      {err && (
        <div className="mb-5 text-red-500 text-xs">Failed to load: {err.message}</div>
      )}

      {/* ── Summary metrics ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
        {!data ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card"><Skeleton className="h-10" /></div>
          ))
        ) : (
          <>
            <StatCard
              label="Total Customers"
              value={fmt(summary?.total_orgs)}
              sub="orgs in Quinn"
            />
            <StatCard
              label="Engaged+"
              value={fmt(summary?.engaged_plus)}
              sub="power + engaged"
              color="text-emerald-600"
              badge={summary?.total_orgs ? `${Math.round(summary.engaged_plus / summary.total_orgs * 100)}%` : null}
              badgeColor="bg-emerald-400/10 text-emerald-600"
            />
            <StatCard
              label="Monthly Active"
              value={fmt(summary?.total_mau)}
              sub="users active this month"
              color="text-quinn-600"
            />
            <StatCard
              label="All-time Progressions"
              value={fmt(summary?.total_progressions)}
              sub="course completions"
              color="text-blue-600"
            />
            <StatCard
              label="HRIS Connected"
              value={fmt(summary?.hris_connected)}
              sub={`of ${summary?.total_orgs} customers`}
              color={summary?.hris_connected > 0 ? "text-emerald-600" : "text-gray-500"}
            />
            <StatCard
              label="Need Attention"
              value={fmt(summary?.action_count)}
              sub="action required"
              color={summary?.action_count > 0 ? "text-red-500" : "text-gray-500"}
              badge={summary?.action_count > 0 ? "!" : null}
              badgeColor="bg-red-400/10 text-red-500"
            />
          </>
        )}
      </div>

      {/* ── Lifecycle pipeline ── */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-gray-200">Customer Lifecycle</h3>
          {selectedStage !== "all" && (
            <button
              onClick={() => setSelectedStage("all")}
              className="text-xs text-gray-500 hover:text-gray-300 underline"
            >
              Show all
            </button>
          )}
        </div>
        {!data ? (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
            {STAGE_ORDER.map(stage => (
              <StageCard
                key={stage}
                stage={stage}
                data={lifecycle[stage]}
                selected={selectedStage}
                onClick={() => setSelectedStage(selectedStage === stage ? "all" : stage)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Two-column: Action Required + Momentum ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">

        {/* Action Required */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-200">
              Action Required
              {actionItems.length > 0 && (
                <span className="ml-2 text-xs font-normal text-red-500">
                  {actionItems.length} customer{actionItems.length !== 1 ? "s" : ""}
                </span>
              )}
            </h3>
            <div className="flex gap-3 text-[10px] text-gray-600">
              <span className="flex items-center gap-1"><span className="text-red-500">🧊</span> Going Cold</span>
              <span className="flex items-center gap-1"><span className="text-amber-600">🚀</span> Needs Onboarding</span>
              <span className="flex items-center gap-1"><span className="text-blue-600">📉</span> Low Adoption</span>
            </div>
          </div>
          {!data ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
            </div>
          ) : actionItems.length === 0 ? (
            <div className="card text-center py-8 text-xs text-gray-600">
              {configured ? "✓ No actions required — all customers look healthy." : "No data yet."}
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {visibleActions.map(org => (
                  <ActionCard key={org.org_id} org={org} />
                ))}
              </div>
              {actionItems.length > 6 && (
                <button
                  onClick={() => setShowAllActions(v => !v)}
                  className="mt-2 text-xs text-gray-500 hover:text-gray-300 w-full text-center py-1"
                >
                  {showAllActions
                    ? "Show less"
                    : `Show ${actionItems.length - 6} more…`}
                </button>
              )}
            </>
          )}
        </div>

        {/* Platform Momentum Chart */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-gray-200">Platform Momentum</h3>
            <span className="text-[10px] text-gray-600">Monthly progressions</span>
          </div>
          <div className="card">
            {!data ? (
              <Skeleton className="h-48" />
            ) : trendData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-xs text-gray-600">
                No trend data yet — will populate on next refresh.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="progGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4ddd5" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={{ fill: "#9e9890", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#9e9890", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <RechartsTip content={<TrendTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="progressions"
                    stroke="#7c3aed"
                    strokeWidth={2}
                    fill="url(#progGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "#7c3aed" }}
                  />
                  <Area
                    type="monotone"
                    dataKey="activated_orgs"
                    stroke="#10b981"
                    strokeWidth={1.5}
                    fill="url(#actGrad)"
                    dot={false}
                    activeDot={{ r: 3, fill: "#10b981" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <div className="mt-2 flex gap-4 text-[10px] text-gray-600">
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-violet-500 inline-block rounded" /> Progressions/mo
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-0.5 bg-emerald-500 inline-block rounded" /> New activations/mo
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Customer Table ── */}
      <div>
        <div className="flex flex-wrap gap-2 mb-3 items-center">
          <input
            type="text"
            placeholder="Search customers…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="text-xs px-3 py-1.5 rounded bg-white border border-gray-800 text-gray-200 placeholder-gray-500 focus:outline-none focus:border-quinn-400 w-48"
          />
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-600 mr-1">Stage:</span>
            <button
              onClick={() => setSelectedStage("all")}
              className={`text-xs px-2 py-1 rounded transition-colors ${selectedStage === "all" ? "bg-gray-100 text-white" : "text-gray-500 hover:text-gray-300"}`}
            >
              All
            </button>
            {STAGE_ORDER.map(s => {
              const cfg = LIFECYCLE[s];
              return (
                <button
                  key={s}
                  onClick={() => setSelectedStage(selectedStage === s ? "all" : s)}
                  className={`text-xs px-2 py-1 rounded border transition-colors ${selectedStage === s ? `bg-white border-gray-800 ${cfg.text} font-medium` : "border-transparent text-gray-500 hover:text-gray-300"}`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1 ml-auto">
            <span className="text-xs text-gray-600">Sort:</span>
            {SORT_OPTIONS.map(s => (
              <button
                key={s.key}
                onClick={() => setSortKey(s.key)}
                className={`text-xs px-2 py-1 rounded transition-colors ${sortKey === s.key ? "bg-gray-100 text-white" : "text-gray-500 hover:text-gray-300"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card overflow-x-auto">
          {!data ? (
            <div className="space-y-2 py-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-8" />
              ))}
            </div>
          ) : filteredOrgs.length === 0 ? (
            <p className="text-xs text-gray-500 italic py-8 text-center">
              {configured ? "No customers match your filters." : "No Quinn data yet."}
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-500 border-b border-gray-800">
                  <th className="text-left pb-2 pr-3">Customer</th>
                  <th className="text-left pb-2 pr-3 hidden sm:table-cell">Stage</th>
                  <th className="text-right pb-2 pr-3">MAU</th>
                  <th className="text-right pb-2 pr-3">Progressions</th>
                  <th className="text-right pb-2 pr-3 hidden md:table-cell">Members</th>
                  <th className="text-right pb-2 pr-3 hidden md:table-cell">Learner%</th>
                  <th className="text-right pb-2 pr-3 hidden lg:table-cell">ARR</th>
                  <th className="text-right pb-2 pr-3 hidden lg:table-cell">Courses</th>
                  <th className="text-left pb-2 hidden xl:table-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrgs.map(o => {
                  const lc = LIFECYCLE[o.lifecycle] || LIFECYCLE.active;
                  return (
                    <tr key={o.org_id} className="border-b border-gray-800 hover:bg-gray-900/40 transition-colors">
                      <td className="py-1.5 pr-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${lc.dot}`} />
                          <span className="font-medium text-gray-50 truncate max-w-[140px]">{o.org_name}</span>
                        </div>
                        <div className="text-[10px] text-gray-600 ml-3 truncate max-w-[140px]">{o.product_name || ""}</div>
                      </td>
                      <td className="py-1.5 pr-3 hidden sm:table-cell">
                        <LifecyclePill stage={o.lifecycle} />
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        <span className={o.mau >= 50 ? "text-emerald-600 font-medium" : o.mau > 0 ? "text-gray-200" : "text-gray-600"}>
                          {fmt(o.mau)}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums">
                        <span className={o.progressions > 500 ? "text-quinn-600 font-medium" : o.progressions > 100 ? "text-gray-200" : o.progressions > 0 ? "text-gray-400" : "text-gray-600"}>
                          {fmt(o.progressions)}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-right text-gray-400 tabular-nums hidden md:table-cell">
                        {fmt(o.total_members)}
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums hidden md:table-cell">
                        <span className={o.learner_pct >= 70 ? "text-emerald-600" : o.learner_pct >= 30 ? "text-amber-600" : o.learner_pct > 0 ? "text-red-500" : "text-gray-700"}>
                          {o.learner_pct > 0 ? `${o.learner_pct}%` : "—"}
                        </span>
                      </td>
                      <td className="py-1.5 pr-3 text-right tabular-nums hidden lg:table-cell">
                        {o.arr_hs
                          ? <span className="text-emerald-600/80">{fmtArr(o.arr_hs)}</span>
                          : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-gray-400 tabular-nums hidden lg:table-cell">
                        {o.courses_created > 0 ? o.courses_created : <span className="text-gray-700">—</span>}
                      </td>
                      <td className="py-1.5 hidden xl:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {o.actions?.map(a => <ActionBadge key={a} action={a} />)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}

          {/* Table footer */}
          {data && filteredOrgs.length > 0 && (
            <div className="mt-3 pt-2 border-t border-gray-800 flex flex-wrap gap-4 text-[10px] text-gray-600">
              {STAGE_ORDER.map(s => {
                const cnt = lifecycle[s]?.count || 0;
                if (!cnt) return null;
                return (
                  <span key={s} className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${LIFECYCLE[s].dot}`} />
                    {LIFECYCLE[s].label}: {cnt}
                  </span>
                );
              })}
              <span className="ml-auto">Showing {filteredOrgs.length} of {data?.summary?.total_orgs}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
