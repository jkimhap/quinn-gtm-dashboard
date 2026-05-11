import React, { useEffect, useState } from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";
import { api } from "../lib/api";
import { fmt$, fmtPct } from "../lib/format";

const ttStyle = { background: "#ffffff", border: "1px solid #e4ddd5", borderRadius: 6, fontSize: 11, color: "#1a1714" };

function Sparkline({ data, color = "#3d7d5c", formatValue }) {
  if (!data?.length) return <div className="h-10" />;
  const gradId = `sg${color.replace("#", "")}`;
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.2} />
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
    <div className="card flex flex-col gap-1.5 min-w-0">
      <div className="flex items-start justify-between gap-1">
        <span className="text-[10px] font-medium text-gray-500 uppercase tracking-widest leading-tight">{label}</span>
        {trend != null && (
          <span className={`text-xs font-semibold shrink-0 ${trend >= 0 ? "text-emerald-600" : "text-red-500"}`}>
            {fmtPct(trend, { sign: true })}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-gray-50 tabular-nums">{value}</div>
      {note && <div className="text-[10px] text-gray-500 leading-snug">{note}</div>}
      {definition && (
        <div className="text-[10px] text-gray-600 border-t border-gray-800 pt-1.5 mt-0.5 leading-relaxed">{definition}</div>
      )}
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

  if (err) return <div className="card text-red-500 text-sm">Failed to load vitals: {err.message}</div>;

  const loading = !data;

  const kpis = [
    {
      label: "ARR",
      value: loading ? "…" : fmt$(data.arr, { compact: true }),
      sparkData: data?.sparklines?.arr,
      color: "#3d7d5c",
      definition: "Annual Recurring Revenue — reads Current ARR → Initial ARR → Step Up ARR → hs_arr in HubSpot",
    },
    {
      label: "Total Contract Value",
      value: loading ? "…" : fmt$(data.tcv, { compact: true }),
      sparkData: data?.sparklines?.tcv,
      color: "#2d6047",
      definition: "Sum of total contract value across all active customers — includes multi-year deals in full",
    },
    {
      label: "Net New TCV (MTD)",
      value: loading ? "…" : fmt$(data.net_new_arr_mtd, { compact: true }),
      color: "#059669",
      definition: "Total Contract Value of deals closed won since the 1st of this month — not annualized",
    },
    {
      label: "Active Customers",
      value: loading ? "…" : String(data.active_customer_count),
      sparkData: data?.sparklines?.customer_count,
      color: "#6366f1",
      trend: data?.logo_mom_growth_pct,
      note: loading ? null : `${data.logo_mom_growth_pct > 0 ? "+" : ""}${data.logo_mom_growth_pct}% vs. last month`,
      definition: "Unique company logos with at least one active deal",
      formatValue: (v) => String(v),
    },
    {
      label: "Rolling 3-Mo ACV",
      value: loading ? "…" : data?.rolling_3mo_acv != null ? fmt$(data.rolling_3mo_acv, { compact: true }) : "—",
      color: "#d97706",
      definition: "Average Total Contract Value of deals closed in the last 3 months",
    },
    {
      label: "Open Pipeline",
      value: loading ? "…" : fmt$(data?.open_pipeline, { compact: true }),
      sparkData: data?.sparklines?.open_pipeline,
      color: "#7c3aed",
      definition: "Sum of TCV for all open deals (Discovery Complete through Verbal Commit)",
    },
  ];

  return (
    <div>
      <h2 className="text-lg font-serif font-medium text-gray-50 tracking-tight mb-5">Vitals</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpis.map((k) => <KpiCard key={k.label} {...k} />)}
      </div>
      <div className="mt-3 text-[10px] text-gray-600 uppercase tracking-wide">
        Headline values as of today · Sparklines show end-of-month totals
      </div>
    </div>
  );
}
