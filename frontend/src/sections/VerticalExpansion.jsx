import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmt$, fmtPct, fmtDays, TIER_COLORS } from "../lib/format";

const TIER_ORDER = ["1A", "1B", "2A", "2B", "3", "Unknown"];

const TIER_META = {
  "1A": { cls: "badge badge-1a", desc: "Core ICP" },
  "1B": { cls: "badge badge-1b", desc: "High friction" },
  "2A": { cls: "badge badge-2a", desc: "Pursuing" },
  "2B": { cls: "badge badge-2b", desc: "Uncertain fit" },
  "3":  { cls: "badge badge-3",  desc: "Low priority" },
  "Unknown": { cls: "badge bg-gray-800 text-gray-500 border border-gray-700", desc: "" },
};

export default function VerticalExpansion() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [sortKey, setSortKey] = useState("total_arr");
  const [sortDir, setSortDir] = useState("desc");

  useEffect(() => {
    api.verticals().then(setData).catch(setErr);
  }, []);

  const rows = (() => {
    if (!data?.data) return [];
    return [...data.data].sort((a, b) => {
      if (sortKey === "tier") {
        const ai = TIER_ORDER.indexOf(a.tier || "Unknown");
        const bi = TIER_ORDER.indexOf(b.tier || "Unknown");
        return sortDir === "asc" ? ai - bi : bi - ai;
      }
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  })();

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  // Highlight rows: find avg win rate and cycle
  const won_rows = rows.filter(r => r.win_rate_pct != null);
  const avgWinRate = won_rows.length
    ? won_rows.reduce((s, r) => s + r.win_rate_pct, 0) / won_rows.length
    : null;
  const avgCycle = won_rows.filter(r => r.avg_cycle_days).length
    ? won_rows.filter(r => r.avg_cycle_days).reduce((s, r) => s + r.avg_cycle_days, 0) /
      won_rows.filter(r => r.avg_cycle_days).length
    : null;

  const COLS = [
    { key: "vertical",       label: "Vertical" },
    { key: "tier",           label: "Tier" },
    { key: "customers",      label: "Customers" },
    { key: "total_arr",      label: "Total ARR" },
    { key: "avg_acv",        label: "Avg ACV" },
    { key: "win_rate_pct",   label: "Win Rate" },
    { key: "avg_cycle_days", label: "Avg Cycle" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-serif font-medium text-gray-50 tracking-tight">Vertical / ICP Expansion</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Green = above-avg win rate or cycle. Red = dragging performance vs. benchmark.
          </p>
        </div>
      </div>

      {err && <div className="text-red-500 text-sm mb-3">Error: {err.message}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80">
              {COLS.map(col => (
                <th key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-3 py-2.5 text-left text-xs font-medium cursor-pointer select-none whitespace-nowrap hover:text-gray-200 ${sortKey === col.key ? "text-quinn-600" : "text-gray-400"}`}>
                  {col.label}
                  {sortKey === col.key && <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-600">Loading…</td></tr>
            ) : rows.map((row) => {
              const winAbove = row.win_rate_pct != null && avgWinRate != null && row.win_rate_pct > avgWinRate;
              const winBelow = row.win_rate_pct != null && avgWinRate != null && row.win_rate_pct < avgWinRate * 0.8;
              const cycleAbove = row.avg_cycle_days != null && avgCycle != null && row.avg_cycle_days > avgCycle * 1.3;
              const isHighlighted = winAbove || winBelow || cycleAbove;
              return (
                <tr key={row.vertical}
                  className={`border-b border-gray-800/50 transition-colors ${isHighlighted ? "bg-gray-800/20" : "hover:bg-gray-800/20"}`}>
                  <td className="px-3 py-2.5 font-medium text-gray-50">{row.vertical}</td>
                  <td className="px-3 py-2.5">
                    {row.tier && TIER_META[row.tier]
                      ? <span title={TIER_META[row.tier].desc} className={TIER_META[row.tier].cls}>{row.tier}</span>
                      : <span className="text-gray-600">—</span>}
                  </td>
                  <td className="px-3 py-2.5 text-gray-300 tabular-nums text-right">{row.customers}</td>
                  <td className="px-3 py-2.5 text-gray-50 tabular-nums text-right font-medium">
                    {row.total_arr ? fmt$(row.total_arr, { compact: true }) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-gray-300 tabular-nums text-right">
                    {row.avg_acv ? fmt$(row.avg_acv, { compact: true }) : "—"}
                  </td>
                  <td className={`px-3 py-2.5 tabular-nums text-right font-medium ${winAbove ? "text-emerald-600" : winBelow ? "text-red-500" : "text-gray-300"}`}>
                    {row.win_rate_pct != null ? fmtPct(row.win_rate_pct) : "—"}
                  </td>
                  <td className={`px-3 py-2.5 tabular-nums text-right ${cycleAbove ? "text-amber-600" : "text-gray-300"}`}>
                    {row.avg_cycle_days != null ? fmtDays(row.avg_cycle_days) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {avgWinRate != null && (
        <div className="mt-2 text-xs text-gray-600">
          Avg win rate: {fmtPct(avgWinRate)} · Avg cycle: {fmtDays(avgCycle)} · Red = win rate &lt;80% of avg
        </div>
      )}
      <div className="mt-1 text-xs text-gray-600">
        <span className="text-gray-500 font-medium">Win Rate</span> = deals closed won ÷ (deals closed won + deals closed lost), all-time per vertical.
      </div>
    </div>
  );
}
