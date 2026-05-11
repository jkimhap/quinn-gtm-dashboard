import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmt$ } from "../lib/format";

const TIER_COLOR = {
  T1: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  T2: "text-blue-400 bg-blue-400/10 border-blue-400/30",
  T3: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  T4: "text-gray-500 bg-gray-700/30 border-gray-600/30",
  Other: "text-gray-500 bg-gray-700/30 border-gray-600/30",
};

const TIER_DOT = {
  T1: "bg-emerald-400",
  T2: "bg-blue-400",
  T3: "bg-amber-400",
  T4: "bg-gray-500",
  Other: "bg-gray-600",
};

function TierBadge({ tier }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold border ${TIER_COLOR[tier] || TIER_COLOR.Other}`}>
      {tier}
    </span>
  );
}

export default function IcpSummary() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => { api.icpSummary().then(setData).catch(setErr); }, []);

  if (err) return <div className="card text-red-400 text-sm">Failed to load ICP summary: {err.message}</div>;

  const loading = !data;

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-1">ICP Summary</h2>
      <p className="text-xs text-gray-500 mb-4">Market sizing from ICP tier sheet. Quinn's pipeline and customer distribution by tier.</p>

      {/* Market sizing table */}
      <div className="card mb-4">
        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Total Addressable Market</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2 pr-4">Tier</th>
                <th className="text-left pb-2 pr-4 hidden sm:table-cell">Description</th>
                <th className="text-right pb-2 pr-4">Companies</th>
                <th className="text-right pb-2 pr-4">SAM</th>
                <th className="text-right pb-2">SOM</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td colSpan={5} className="py-2">
                        <div className="h-4 bg-gray-800/60 rounded animate-pulse w-full" />
                      </td>
                    </tr>
                  ))
                : data.market.map((row) => (
                    <tr key={row.tier} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                      <td className="py-2 pr-4">
                        <TierBadge tier={row.tier} />
                      </td>
                      <td className="py-2 pr-4 text-gray-400 hidden sm:table-cell max-w-xs">
                        {row.description}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-300 tabular-nums">
                        {row.companies.toLocaleString()}
                      </td>
                      <td className="py-2 pr-4 text-right text-gray-300 tabular-nums">
                        {fmt$(row.sam_m * 1_000_000, { compact: true })}
                      </td>
                      <td className="py-2 text-right text-gray-200 tabular-nums font-medium">
                        {fmt$(row.som_m * 1_000_000, { compact: true })}
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-600 mt-2">Source: ICP Tier Google Sheet, last updated May 2025.</p>
      </div>

      {/* Quinn distribution */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Pipeline */}
        <div className="card">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Open Pipeline by Tier</div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-6 bg-gray-800/60 rounded animate-pulse" />)}
            </div>
          ) : (
            <TierDistribution data={data.pipeline_by_tier} valueKey="pipeline" format={(v) => fmt$(v, { compact: true })} />
          )}
        </div>

        {/* Customers */}
        <div className="card">
          <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Active Customers by Tier</div>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-6 bg-gray-800/60 rounded animate-pulse" />)}
            </div>
          ) : (
            <TierDistribution data={data.customers_by_tier} valueKey="logos" format={(v) => `${v} logo${v !== 1 ? "s" : ""}`} />
          )}
        </div>
      </div>
    </div>
  );
}

function TierDistribution({ data, valueKey, format }) {
  const tiers = ["T1", "T2", "T3", "T4", "Other"];
  const entries = tiers
    .map((t) => ({ tier: t, value: (data[t] || {})[valueKey] || 0 }))
    .filter((e) => e.value > 0);

  if (entries.length === 0) {
    return <p className="text-xs text-gray-600 italic">No data available</p>;
  }

  const total = entries.reduce((s, e) => s + e.value, 0);

  return (
    <div className="space-y-2">
      {entries.map(({ tier, value }) => {
        const pct = total > 0 ? Math.round((value / total) * 100) : 0;
        return (
          <div key={tier}>
            <div className="flex items-center justify-between mb-0.5">
              <div className="flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${TIER_DOT[tier]}`} />
                <TierBadge tier={tier} />
              </div>
              <div className="text-xs text-gray-300 tabular-nums">{format(value)}</div>
            </div>
            <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  tier === "T1" ? "bg-emerald-400" :
                  tier === "T2" ? "bg-blue-400" :
                  tier === "T3" ? "bg-amber-400" :
                  "bg-gray-500"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
