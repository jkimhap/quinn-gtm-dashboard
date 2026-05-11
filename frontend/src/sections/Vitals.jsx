import React, { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "../lib/api";
import { fmt$, fmtPct } from "../lib/format";

const ttStyle = { background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 11 };

function Sparkline({ data, color = "#2897a8", formatValue }) {
  if (!data?.length) return <div className="h-10" />;
  const gradId = `sg${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5}
          fill={`url(#${gradId})`} dot={false} />
        <Tooltip contentStyle={ttStyle}
          labelFormatter={(_, p) => p?.[0]?.payload?.label || ""}
          formatter={(v) => [v != null ? formatValue(v) : "—"]} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function KpiCard({ label, value, sparkData, color, trend, note, definition, formatValue }) {
  return (
    <div className="card flex flex-col gap-2 min-w-0">
      <div className="flex items-start justify-between">
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wide leading-tight">{label}</span>
        {trend != null && (
          <span className={`text-xs font-semibold shrink-0 ml-1 ${trend >= 0 ? "text-emerald-400" : "text-red-400"}`}>
            {fmtPct(trend, { sign: true })}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-white tabular-nums">{value}</div>
      {note && <div className="text-xs text-gray-500">{note}</div>}
      {definition && <div className="text-xs text-gray-600 border-t border-gray-800 pt-1.5 mt-0.5">{definition}</div>}
      {sparkData && (
        <Sparkline data={sparkData} color={color}
          formatValue={formatValue || ((v) => fmt$(v, { compact: true }))} />
      )}
    </div>
  );
}

export default function Vitals() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => { api.vitals().then(setData).catch(setErr); }, []);

  if (err) return <div className="card text-red-400 text-sm">Failed to load vitals: {err.message}</div>;

  const loading = !data;

  const kpis = [
    {
      label: "ARR",
      value: loading ? "…" : fmt$(data.arr, { compact: true }),
      sparkData: data?.sparklines?.arr,
      color: "#2897a8",
      definition: "Annual Recurring Revenue — reads Current ARR → Initial ARR → Step Up ARR → hs_arr in HubSpot",
    },
    {
      label: "Total Contract Value",
      value: loading ? "…" : fmt$(data.tcv, { compact: true }),
      sparkData: data?.sparklines?.tcv,
      color: "#0e7490",
      definition: "Sum of total contract value across all active customers — includes multi-year deals in full",
    },
    {
      label: "Net New TCV (MTD)",
      value: loading ? "…" : fmt$(data.net_new_arr_mtd, { compact: true }),
      color: "#10b981",
      definition: "Total Contract Value of deals closed won since the 1st of this month — not annualized",
    },
    {
      label: "Active Customers",
      value: loading ? "…" : String(data.active_customer_count),
      sparkData: data?.sparklines?.customer_count,
      color: "#6366f1",
      trend: data?.logo_mom_growth_pct,
      note: loading ? null : `${data.logo_mom_growth_pct > 0 ? "+" : ""}${data.logo_mom_growth_pct}% vs. last month (logo count)`,
      definition: "Unique company logos with at least one active deal",
      formatValue: (v) => String(v),
    },
    {
      label: "Rolling 3-Mo ACV",
      value: loading ? "…" : data?.rolling_3mo_acv != null ? fmt$(data.rolling_3mo_acv, { compact: true }) : "—",
      color: "#f59e0b",
      definition: "Average Total Contract Value of deals closed in the last 3 months",
    },
    {
      label: "Open Pipeline",
      value: loading ? "…" : fmt$(data?.open_pipeline, { compact: true }),
      sparkData: data?.sparklines?.open_pipeline,
      color: "#a78bfa",
      definition: "Sum of TCV for all open deals (Discovery Complete through Verbal Commit)",
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">Vitals</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>
      <div className="mt-3 text-xs text-gray-600">
        Headline values are as of today. Sparklines show end-of-month totals for completed months only.
      </div>
    </div>
  );
}
