import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmt$ } from "../lib/format";

const BUCKET_LABEL = {
  early: "Discovery",
  mid: "Demo / Quote",
  late: "Verbal Commit",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
  unknown: "Unknown",
};

const BUCKET_COLOR = {
  early: "text-blue-600",
  mid: "text-purple-400",
  late: "text-amber-600",
  closed_won: "text-emerald-600",
  closed_lost: "text-red-500",
  unknown: "text-gray-500",
};

const TIER_COLOR = {
  // New naming
  "T1": "text-emerald-600", "T2": "text-blue-600",
  "T3": "text-amber-600", "T4": "text-gray-500",
  // Legacy fallback (old DB rows)
  "1A": "text-emerald-600", "1B": "text-emerald-700",
  "2A": "text-blue-600", "2B": "text-blue-600",
  "3": "text-amber-600",
};

const TIER_DISPLAY = {
  "1A": "T1", "1B": "T1", "2A": "T2", "2B": "T3", "3": "T3",
  "T1": "T1", "T2": "T2", "T3": "T3", "T4": "T4",
};

function fmt_date(str) {
  if (!str) return "—";
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
}

export default function DealSummary() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [filter, setFilter] = useState("open");

  useEffect(() => {
    api.gtmDeals()
      .then(setData)
      .catch(setErr);
  }, []);

  if (err) return <div className="card text-red-500 text-sm">Failed to load deals: {err.message}</div>;

  const allRows = data?.data || [];

  const rows = allRows.filter((r) => {
    if (filter === "open") return !r.is_closed_won && !r.is_closed_lost;
    if (filter === "won") return r.is_closed_won;
    if (filter === "lost") return r.is_closed_lost;
    return true;
  });

  const openCount = allRows.filter((r) => !r.is_closed_won && !r.is_closed_lost).length;
  const wonCount = allRows.filter((r) => r.is_closed_won).length;
  const lostCount = allRows.filter((r) => r.is_closed_lost).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-serif font-medium text-gray-50 tracking-tight">Deal Summary</h2>
        <div className="flex items-center gap-1">
          {[
            { key: "open", label: `Open (${openCount})` },
            { key: "won", label: `Won (${wonCount})` },
            { key: "lost", label: `Lost (${lostCount})` },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                filter === key ? "bg-gray-100 text-gray-50" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Live HubSpot deals. Open + deals closed/lost in the last 90 days.
      </p>

      <div className="card overflow-x-auto">
        {!data ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-9 bg-gray-800/60 rounded animate-pulse" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="text-xs text-gray-500 italic py-4 text-center">No deals in this view.</p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2 pr-3">Company</th>
                <th className="text-left pb-2 pr-3 hidden sm:table-cell">Owner</th>
                <th className="text-left pb-2 pr-3">Stage</th>
                <th className="text-left pb-2 pr-3 hidden md:table-cell">Tier</th>
                <th className="text-right pb-2 pr-3">TCV</th>
                <th className="text-right pb-2 pr-3 hidden lg:table-cell">ARR</th>
                <th className="text-right pb-2 pr-3 hidden md:table-cell">Created</th>
                <th className="text-right pb-2">Close Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.hubspot_id} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                  <td className="py-1.5 pr-3 max-w-[150px]">
                    <div className="truncate font-medium text-gray-200">{r.company_name || r.deal_name}</div>
                  </td>
                  <td className="py-1.5 pr-3 text-gray-400 hidden sm:table-cell whitespace-nowrap">
                    {(r.owner_name || "").split(" ")[0] || "—"}
                  </td>
                  <td className="py-1.5 pr-3">
                    <span className={`font-medium ${BUCKET_COLOR[r.stage_bucket] || "text-gray-400"}`}>
                      {BUCKET_LABEL[r.stage_bucket] || r.stage_bucket || "—"}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 hidden md:table-cell">
                    <span className={`font-medium ${TIER_COLOR[r.icp_tier] || "text-gray-500"}`}>
                      {TIER_DISPLAY[r.icp_tier] || r.icp_tier || "—"}
                    </span>
                  </td>
                  <td className="py-1.5 pr-3 text-right text-gray-300 tabular-nums">
                    {r.tcv ? fmt$(r.tcv, { compact: true }) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-gray-400 tabular-nums hidden lg:table-cell">
                    {r.arr ? fmt$(r.arr, { compact: true }) : "—"}
                  </td>
                  <td className="py-1.5 pr-3 text-right text-gray-500 hidden md:table-cell">
                    {fmt_date(r.create_date)}
                  </td>
                  <td className="py-1.5 text-right text-gray-400">
                    {r.is_closed_won
                      ? <span className="text-emerald-600">{fmt_date(r.closed_won_date)}</span>
                      : fmt_date(r.close_date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {data && rows.length > 0 && (
          <div className="mt-3 pt-2 border-t border-gray-800 flex gap-6 text-xs text-gray-500">
            <span>
              Total TCV:{" "}
              <span className="text-gray-300">
                {fmt$(rows.reduce((s, r) => s + (r.tcv || 0), 0), { compact: true })}
              </span>
            </span>
            <span>
              Avg TCV:{" "}
              <span className="text-gray-300">
                {rows.length > 0
                  ? fmt$(rows.reduce((s, r) => s + (r.tcv || 0), 0) / rows.filter((r) => r.tcv).length, { compact: true })
                  : "—"}
              </span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
