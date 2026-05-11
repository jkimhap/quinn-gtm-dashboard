import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
} from "recharts";
import { api } from "../lib/api";
import { fmt$, fmtPct, fmtDate } from "../lib/format";

const ttStyle = { background: "#ffffff", border: "1px solid #e4ddd5", borderRadius: 6, fontSize: 12, color: "#1a1714" };

export default function CustomerHealth() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.retention().then(setData).catch(setErr);
  }, []);

  const hasContractData = data && (data.beginning_arr > 0 || data.churned_arr_ttm > 0);

  return (
    <div>
      <h2 className="text-lg font-serif font-medium text-gray-50 tracking-tight mb-4">Customer Health & Retention</h2>

      {err && <div className="text-red-500 text-sm mb-3">Error: {err.message}</div>}
      {!data ? (
        <div className="text-gray-500 text-sm">Loading…</div>
      ) : (
        <div className="space-y-4">
          {/* GRR / NRR */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "GRR (TTM)", value: data.grr_pct != null ? fmtPct(data.grr_pct) : null,
                note: "gross retention", color: data.grr_pct >= 90 ? "text-emerald-600" : "text-amber-600" },
              { label: "NRR (TTM)", value: data.nrr_pct != null ? fmtPct(data.nrr_pct) : null,
                note: "net revenue retention", color: data.nrr_pct >= 100 ? "text-emerald-600" : "text-amber-600" },
              { label: "Churned ARR (TTM)", value: data.churned_arr_ttm != null ? fmt$(data.churned_arr_ttm, { compact: true }) : "—",
                note: "last 12 months", color: "text-red-500" },
              { label: "At-Risk Accounts", value: String(data.at_risk_accounts?.length || 0),
                note: "renewal <90 days", color: data.at_risk_accounts?.length > 0 ? "text-amber-600" : "text-gray-400" },
            ].map(item => (
              <div key={item.label} className="card">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 mb-2">{item.label}</div>
                {!hasContractData && item.label.includes("GRR") ? (
                  <span className="unavailable">⚠ no contract data</span>
                ) : (
                  <div className={`text-2xl font-bold tabular-nums ${item.color}`}>{item.value ?? "—"}</div>
                )}
                <div className="text-[10px] text-gray-600 mt-1">{item.note}</div>
              </div>
            ))}
          </div>

          {!hasContractData && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              GRR/NRR are directional estimates — contract start/end dates must be populated in HubSpot for full accuracy.
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Expansion ARR */}
            <div className="card">
              <div className="text-[10px] font-medium text-gray-500 mb-3 uppercase tracking-widest">Expansion ARR / Month</div>
              {data.expansion_monthly?.some(m => m.value > 0) ? (
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={data.expansion_monthly} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4ddd5" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9e9890" }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={v => fmt$(v, { compact: true })} tick={{ fontSize: 10, fill: "#9e9890" }} axisLine={false} tickLine={false} width={48} />
                    <Tooltip contentStyle={ttStyle} formatter={v => [fmt$(v, { compact: true })]} />
                    <Bar dataKey="value" name="Expansion ARR" fill="#3d7d5c" radius={[3, 3, 0, 0]} />
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
              <div className="text-[10px] font-medium text-gray-500 mb-3 uppercase tracking-widest">At-Risk Renewals (next 90 days)</div>
              {data.at_risk_accounts?.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {data.at_risk_accounts.map((a, i) => (
                    <div key={i} className="flex items-center justify-between text-xs p-2 bg-amber-50 border border-amber-200 rounded">
                      <div>
                        <span className="text-gray-50 font-medium">{a.company_name}</span>
                        <span className="text-gray-500 ml-2">{a.vertical}</span>
                      </div>
                      <div className="flex items-center gap-3 text-right">
                        <span className="text-amber-600">{fmtDate(a.contract_end)}</span>
                        <span className="text-gray-50 tabular-nums">{fmt$(a.arr, { compact: true })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-32 flex items-center justify-center text-gray-500 text-sm">No at-risk renewals</div>
              )}
            </div>
          </div>

          {/* Churned logos */}
          {data.churned_logos?.length > 0 && (
            <div className="card">
              <div className="text-[10px] font-medium text-gray-500 mb-3 uppercase tracking-widest">Churned Logos (TTM)</div>
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
                        <td className="px-2 py-1.5 text-gray-50">{r.company_name}</td>
                        <td className="px-2 py-1.5 text-gray-400">{r.vertical || "—"}</td>
                        <td className="px-2 py-1.5 text-red-500 text-right tabular-nums">
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
