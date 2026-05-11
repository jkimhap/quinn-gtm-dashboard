import React, { useEffect, useState, useMemo } from "react";
import { api } from "../lib/api";

// ── Health badge ───────────────────────────────────────────────────────────────

function HealthDot({ health }) {
  const cfg = {
    green:  { dot: "bg-emerald-400", label: "Engaged",       text: "text-emerald-400" },
    yellow: { dot: "bg-amber-400",   label: "Low engagement", text: "text-amber-400"  },
    red:    { dot: "bg-red-500",     label: "Inactive",       text: "text-red-400"    },
  }[health] || { dot: "bg-gray-600", label: "—", text: "text-gray-500" };

  return (
    <span className="flex items-center gap-1.5" title={cfg.label}>
      <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
    </span>
  );
}

// ── Feature pills ──────────────────────────────────────────────────────────────

const FEATURE_LABEL = {
  course_creation: "Courses",
  lms: "LMS",
  wfi: "WFI",
};

function FeaturePills({ features }) {
  if (!features?.length) return <span className="text-gray-700">—</span>;
  return (
    <div className="flex gap-1 flex-wrap">
      {features.map((f) => (
        <span
          key={f}
          className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 border border-gray-700"
        >
          {FEATURE_LABEL[f] || f}
        </span>
      ))}
    </div>
  );
}

// ── Summary card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color = "text-white" }) {
  return (
    <div className="card">
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className={`text-2xl font-bold tabular-nums ${color}`}>
        {value ?? <span className="text-gray-700">—</span>}
      </div>
      {sub && <div className="text-xs text-gray-600 mt-1">{sub}</div>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

const SORT_OPTIONS = [
  { key: "progressions", label: "Progressions" },
  { key: "mau",          label: "MAU" },
  { key: "total_members", label: "Members" },
  { key: "courses_created", label: "Courses" },
  { key: "org_name",     label: "Name (A-Z)" },
];

const HEALTH_FILTERS = [
  { key: "all",    label: "All" },
  { key: "green",  label: "Engaged" },
  { key: "yellow", label: "Low" },
  { key: "red",    label: "Inactive" },
];

export default function AdoptionMetrics() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState("progressions");
  const [healthFilter, setHealthFilter] = useState("all");

  useEffect(() => {
    api.csAdoption().then(setData).catch(setErr);
  }, []);

  const summary = data?.summary;
  const meta    = data?.meta;
  const configured = !meta || meta.status !== "skipped";

  const orgs = useMemo(() => {
    if (!data?.orgs) return [];
    let list = data.orgs;

    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(o => o.org_name?.toLowerCase().includes(s));
    }
    if (healthFilter !== "all") {
      list = list.filter(o => o.health === healthFilter);
    }

    return [...list].sort((a, b) => {
      if (sortKey === "org_name") return (a.org_name || "").localeCompare(b.org_name || "");
      return (b[sortKey] || 0) - (a[sortKey] || 0);
    });
  }, [data, search, sortKey, healthFilter]);

  const greenCount  = summary?.green_count  ?? 0;
  const yellowCount = summary?.yellow_count ?? 0;
  const redCount    = summary?.red_count    ?? 0;
  const total       = summary?.total_orgs   ?? 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-white">Product Adoption</h2>
        {meta?.ran_at && (
          <span className="text-xs text-gray-600">
            Last synced {meta.ran_at.slice(0, 10)}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Live product usage from the Quinn platform. Updates every 6 hours with the global refresh.
      </p>

      {/* Not configured warning */}
      {!configured && (
        <div className="mb-4 flex items-start gap-2 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>
            Quinn product data not yet configured. Add <code className="text-amber-300">QUINN_API_TOKEN</code> as an
            environment variable on Render to enable live product metrics.
          </span>
        </div>
      )}

      {err && (
        <div className="mb-4 text-red-400 text-xs">Failed to load adoption data: {err.message}</div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3 mb-5">
        <StatCard
          label="Live Customers"
          value={total ? total.toLocaleString() : "—"}
          sub="real paying orgs"
        />
        <StatCard
          label="Total MAU"
          value={summary?.total_mau?.toLocaleString()}
          sub="monthly active users"
          color="text-quinn-300"
        />
        <StatCard
          label="Total Members"
          value={summary?.total_members?.toLocaleString()}
          sub="seats provisioned"
        />
        <StatCard
          label="Progressions"
          value={summary?.total_progressions?.toLocaleString()}
          sub="all time"
          color="text-blue-400"
        />
        <StatCard
          label="HRIS Connected"
          value={summary?.hris_connected ?? "—"}
          sub={`of ${total} orgs`}
          color={summary?.hris_connected > 0 ? "text-emerald-400" : "text-gray-500"}
        />
        <div className="card">
          <div className="text-xs text-gray-500 mb-2">Health Breakdown</div>
          {total > 0 ? (
            <>
              {/* Stacked bar */}
              <div className="flex h-2 rounded-full overflow-hidden mb-2">
                <div
                  className="bg-emerald-400 transition-all"
                  style={{ width: `${(greenCount / total) * 100}%` }}
                  title={`Engaged: ${greenCount}`}
                />
                <div
                  className="bg-amber-400 transition-all"
                  style={{ width: `${(yellowCount / total) * 100}%` }}
                  title={`Low engagement: ${yellowCount}`}
                />
                <div
                  className="bg-red-500 transition-all"
                  style={{ width: `${(redCount / total) * 100}%` }}
                  title={`Inactive: ${redCount}`}
                />
              </div>
              <div className="flex gap-3 text-[10px]">
                <span className="text-emerald-400">{greenCount} engaged</span>
                <span className="text-amber-400">{yellowCount} low</span>
                <span className="text-red-400">{redCount} inactive</span>
              </div>
            </>
          ) : (
            <div className="text-gray-700 text-xs">No data</div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-2 mb-3 items-center">
        <input
          type="text"
          placeholder="Search customers…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="text-xs px-3 py-1.5 rounded bg-gray-900 border border-gray-700 text-gray-300 placeholder-gray-600 focus:outline-none focus:border-quinn-500 w-48"
        />
        <div className="flex items-center gap-1">
          {HEALTH_FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setHealthFilter(f.key)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                healthFilter === f.key ? "bg-quinn-700 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-xs text-gray-600">Sort:</span>
          {SORT_OPTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => setSortKey(s.key)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                sortKey === s.key ? "bg-quinn-700 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card overflow-x-auto">
        {!data ? (
          <div className="space-y-2 py-2">
            {[1,2,3,4,5,6].map(i => (
              <div key={i} className="h-8 bg-gray-800/60 rounded animate-pulse" />
            ))}
          </div>
        ) : orgs.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-6 text-center">
            {configured ? "No customers match your filters." : "No Quinn data available yet."}
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2 pr-2 w-4"></th>
                <th className="text-left pb-2 pr-3">Customer</th>
                <th className="text-left pb-2 pr-3 hidden sm:table-cell">Product</th>
                <th className="text-right pb-2 pr-3">Progressions</th>
                <th className="text-right pb-2 pr-3">MAU</th>
                <th className="text-right pb-2 pr-3 hidden md:table-cell">Members</th>
                <th className="text-right pb-2 pr-3 hidden md:table-cell">Learner%</th>
                <th className="text-right pb-2 pr-3 hidden lg:table-cell">Courses</th>
                <th className="text-left pb-2 pr-3 hidden lg:table-cell">Features</th>
                <th className="text-center pb-2 hidden xl:table-cell">HRIS</th>
              </tr>
            </thead>
            <tbody>
              {orgs.map(o => (
                <tr key={o.org_id} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                  <td className="py-1.5 pr-2">
                    <HealthDot health={o.health} />
                  </td>
                  <td className="py-1.5 pr-3 font-medium text-gray-200 max-w-[160px] truncate">
                    {o.org_name}
                  </td>
                  <td className="py-1.5 pr-3 text-gray-500 max-w-[120px] truncate hidden sm:table-cell">
                    {o.product_name || "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    <span className={o.progressions > 500 ? "text-quinn-300 font-medium" : o.progressions > 100 ? "text-gray-300" : "text-gray-600"}>
                      {o.progressions.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums">
                    <span className={o.mau >= 50 ? "text-emerald-400 font-medium" : o.mau > 0 ? "text-gray-300" : "text-gray-700"}>
                      {o.mau.toLocaleString()}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right text-gray-400 tabular-nums hidden md:table-cell">
                    {o.total_members.toLocaleString()}
                  </td>
                  <td className="py-1.5 pr-3 text-right tabular-nums hidden md:table-cell">
                    <span className={
                      o.learner_pct >= 70 ? "text-emerald-400" :
                      o.learner_pct >= 30 ? "text-amber-400" : "text-red-400"
                    }>
                      {o.learner_pct}%
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right text-gray-400 tabular-nums hidden lg:table-cell">
                    {o.courses_created}
                  </td>
                  <td className="py-1.5 pr-3 hidden lg:table-cell">
                    <FeaturePills features={o.features} />
                  </td>
                  <td className="py-1.5 text-center hidden xl:table-cell">
                    {o.hris_connected ? (
                      <span className="text-emerald-400 font-medium">✓</span>
                    ) : (
                      <span className="text-gray-700">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Legend */}
        {data && orgs.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-800 flex flex-wrap gap-4 text-xs text-gray-600">
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 mr-1" />
              <span className="text-gray-500">Engaged</span> — MAU ≥ 10 &amp; Progressions ≥ 100
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1" />
              <span className="text-gray-500">Low engagement</span> — some activity
            </span>
            <span>
              <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1" />
              <span className="text-gray-500">Inactive</span> — no recent usage
            </span>
            <span className="ml-auto">
              Showing {orgs.length} of {total} customers
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
