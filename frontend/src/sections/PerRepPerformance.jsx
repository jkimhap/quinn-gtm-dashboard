import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, Legend, LabelList,
} from "recharts";
import { api } from "../lib/api";
import { fmt$, fmtPct, fmtDays, REP_COLORS } from "../lib/format";

// AEs only — Luke is SDR and lives in Leading Indicators
const AE_SLUGS = ["arlen", "derek", "grant"];
const REP_LABELS = { arlen: "Arlen Marmel", derek: "Derek Goldberg", grant: "Grant Amerling" };
const REP_SHORT  = { arlen: "Arlen", derek: "Derek", grant: "Grant" };

const ttStyle = { background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 12 };

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-gray-800/50 rounded-lg p-3 flex flex-col gap-1">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-lg font-bold text-white tabular-nums">{value}</div>
      {sub && <div className="text-xs text-gray-500">{sub}</div>}
    </div>
  );
}

function PipelineSummary({ data }) {
  const buckets = [
    { key: "early", label: "Early", color: "#6366f1" },
    { key: "mid",   label: "Mid",   color: "#f59e0b" },
    { key: "late",  label: "Late",  color: "#10b981" },
  ];
  return (
    <div>
      <div className="text-xs text-gray-400 mb-2">Current Pipeline by Stage</div>
      <div className="flex flex-wrap gap-3">
        {buckets.map(b => (
          <div key={b.key} className="flex items-center gap-1.5 text-xs">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: b.color }} />
            <span className="text-gray-400">{b.label}:</span>
            <span className="text-white font-medium">{fmt$(data?.[b.key]?.amount || 0, { compact: true })}</span>
            <span className="text-gray-600">({data?.[b.key]?.count || 0})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function AEView({ slug, perf }) {
  const color = REP_COLORS[slug] || "#6366f1";
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Total TCV Closed (12mo)" value={fmt$(perf.summary?.total_tcv_closed, { compact: true })} />
        <StatCard label="Win Rate (90d)" value={fmtPct(perf.summary?.win_rate_90d_pct)} />
        <StatCard label="Avg Sales Cycle" value={fmtDays(perf.summary?.avg_cycle_days)} sub="opp created → closed won" />
        <StatCard label="Avg ACV" value={fmt$(perf.summary?.avg_acv, { compact: true })} sub="last 12 months" />
      </div>
      <div className="card">
        <div className="text-xs text-gray-400 mb-3">New TCV Closed per Month</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={(perf.monthly_arr || []).slice(-12)} margin={{ top: 20, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => fmt$(v, { compact: true })} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={52} />
            <Tooltip contentStyle={ttStyle} formatter={v => [fmt$(v, { compact: true })]} />
            <Bar dataKey="value" name="TCV" fill={color} radius={[3,3,0,0]}>
              <LabelList dataKey="value" position="top" style={{ fontSize: 9, fill: "#9ca3af" }}
                formatter={v => v > 0 ? fmt$(v, { compact: true }) : ""} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <PipelineSummary data={perf.pipeline_by_stage} />
    </div>
  );
}

function CompareView({ allPerf }) {
  const data = (allPerf?.arlen?.monthly_arr || []).slice(-12).map((m, i) => {
    const row = { label: m.label };
    AE_SLUGS.forEach(s => { row[s] = allPerf[s]?.monthly_arr?.[i]?.value || 0; });
    return row;
  });

  return (
    <div className="space-y-4">
      <div className="card">
        <div className="text-xs text-gray-400 mb-3">New TCV Closed per Month — All AEs</div>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <YAxis tickFormatter={v => fmt$(v, { compact: true })} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={52} />
            <Tooltip contentStyle={ttStyle} formatter={v => [fmt$(v, { compact: true })]} />
            <Legend wrapperStyle={{ fontSize: 11 }} formatter={s => REP_SHORT[s] || s} />
            {AE_SLUGS.map(s => (
              <Line key={s} type="monotone" dataKey={s} stroke={REP_COLORS[s]} strokeWidth={2} dot={false} connectNulls />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {AE_SLUGS.map(s => {
          const p = allPerf?.[s];
          return (
            <div key={s} className="card" style={{ borderColor: (REP_COLORS[s] || "#374151") + "55" }}>
              <div className="text-sm font-semibold mb-3" style={{ color: REP_COLORS[s] }}>{REP_LABELS[s]}</div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-gray-500">TCV Closed (12mo)</span><span className="text-white">{fmt$(p?.summary?.total_tcv_closed, { compact: true })}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Deals Closed</span><span className="text-white">{p?.summary?.total_deals_closed ?? "—"}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Win Rate (90d)</span><span className="text-white">{fmtPct(p?.summary?.win_rate_90d_pct)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Avg Cycle</span><span className="text-white">{fmtDays(p?.summary?.avg_cycle_days)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Avg ACV</span><span className="text-white">{fmt$(p?.summary?.avg_acv, { compact: true })}</span></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function PerRepPerformance() {
  const [allPerf, setAllPerf] = useState(null);
  const [err, setErr] = useState(null);
  const [activeTab, setActiveTab] = useState("compare");

  useEffect(() => { api.allReps().then(setAllPerf).catch(setErr); }, []);

  const TABS = [
    { key: "compare", label: "All AEs" },
    ...AE_SLUGS.map(s => ({ key: s, label: REP_SHORT[s] })),
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Rep Performance</h2>
      <div className="flex gap-1 mb-5 border-b border-gray-800">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.key ? "text-quinn-300 border-quinn-400" : "text-gray-400 border-transparent hover:text-gray-200"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {err && <div className="text-red-400 text-sm mb-3">Error: {err.message}</div>}
      {!allPerf && !err && <div className="text-gray-600 text-sm">Loading…</div>}

      {allPerf && (
        activeTab === "compare"
          ? <CompareView allPerf={allPerf} />
          : allPerf[activeTab] && <AEView slug={activeTab} perf={allPerf[activeTab]} />
      )}

      <div className="mt-4 text-xs text-gray-600">
        <span className="text-gray-500 font-medium">Win Rate</span> = deals closed won ÷ (deals closed won + deals closed lost), rolling 90 days.
      </div>
    </div>
  );
}
