import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { api } from "../lib/api";
import { fmt$, fmtPct, fmtDate } from "../lib/format";

const ttStyle = { background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 12 };

export default function CustomerHealth() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.retention().then(setData).catch(setErr);
  }, []);

  const hasContractData = data && (data.beginning_arr > 0 || data.churned_arr_ttm > 0);

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Customer Health & Retention</h2>

      {err && <div className="text-red-400 text-sm mb-3">Error: {err.message}</div>}
      {!data ? (
        <div className="text-gray-600 text-sm">Loading…</div>
      ) : (
        <div className="space-y-4">
          {/* GRR / NRR */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "GRR (TTM)", value: data.grr_pct != null ? fmtPct(data.grr_pct) : null,
                note: "gross retention", color: data.grr_pct >= 90 ? "text-emerald-400" : "text-amber-400" },
              { label: "NRR (TTM)", value: data.nrr_pct != null ? fmtPct(data.nrr_pct) : null,
                note: "net revenue retention", color: data.nrr_pct >= 100 ? "text-emerald-400" : "text-amber-400" },
              { label: "Churned ARR (TTM)", value: data.churned_arr_ttm != null ? fmt$(data.churned_arr_ttm, { compact: true }) : "—",
                note: "last 12 months", color: "text-red-400" },
              { label: "At-Risk Accounts", value: String(data.at_risk_accounts?.length || 0),
                note: "renewal <90 days", color: data.at_risk_accounts?.length > 0 ? "text-amber-400" : "text-gray-400" },
            ].map(item => (
              <div key={item.label} className="card">
                <div className="text-xs text-gray-400 mb-2">{item.label}</div>
                {!hasContractData && item.label.includes("GRR") ? (
                  <span className="unavailable">⚠ no contract data</span>
                ) : (
                  <div className={`text-2xl font-bold tabular-nums ${item.color}`}>{item.value ?? "—"}</div>
                )}
                <div className="text-xs text-gray-600 mt-1">{item.note}</div>
              </div>
            ))}
          </div>

          {!hasContractData && (
            <div className="text-xs text-amber-600 bg-amber-900/20 border border-amber-900/40 rounded px-3 py-2">
              GRR/NRR are directional estimates — contract start/end dates must be populated in HubSpot for full accuracy.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Expansion ARR */}
            <div className="card">
              <div className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">Expansion ARR / Month</div>
              {data.expansion_monthly?.some(m => m.value > 0) ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={data.expansion_monthly} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => fmt$(v, { compact: true })} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip contentStyle={ttStyle} formatter={v => [fmt$(v, { compact: true })]} />
                    <Bar dataKey="value" name="Expansion ARR" fill="#10b981" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-32 flex items-center justify-center">
                  <span className="unavailable">⚠ no expansion deals tagged in HubSpot</span>
                </div>
              )}
            </div>

            {/* At-risk accounts */}
            <div className="card">
              <div className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">At-Risk Renewals (next 90 days)</div>
              {data.at_risk_accounts?.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {data.at_risk_accounts.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2 bg-amber-900/10 border border-amber-900/30 rounded">
                      <div>
                        <span className="text-white font-medium">{a.company_name}</span>
                        <span className="text-gray-500 ml-2">{a.vertical}</span>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <span className="text-amber-300">{fmtDate(a.contract_end)}</span>
                        <span className="text-white tabular-nums">{fmt$(a.arr, { compact: true })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-600 text-sm">No at-risk renewals</div>
              )}
            </div>
          </div>

          {/* Churned logos */}
          {data.churned_logos?.length > 0 && (
            <div className="card">
              <div className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">Churned Logos (TTM)</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-800">
                      <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Company</th>
                      <th className="text-left px-2 py-1.5 text-gray-500 font-medium">Vertical</th>
                      <th className="text-right px-2 py-1.5 text-gray-500 font-medium">ARR Lost</th>
                      <th className="text-right px-2 py-1.5 text-gray-500 font-medium">End Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.churned_logos.map((r, i) => (
                      <tr key={i} className="border-b border-gray-800/50">
                        <td className="px-2 py-1.5 text-white">{r.company_name}</td>
                        <td className="px-2 py-1.5 text-gray-400">{r.vertical || "—"}</td>
                        <td className="px-2 py-1.5 text-red-400 text-right tabular-nums">
                          {r.arr ? fmt$(r.arr, { compact: true }) : "—"}
                        </td>
                        <td className="px-2 py-1.5 text-gray-400 text-right">{fmtDate(r.contract_end)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
