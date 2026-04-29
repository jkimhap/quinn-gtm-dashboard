import React, { useEffect, useState } from "react";
import {
  ComposedChart, BarChart, Bar,
  XAxis, YAxis, Tooltip, Legend, LabelList,
  ResponsiveContainer, CartesianGrid,
} from "recharts";
import { api } from "../lib/api";
import { fmt$, REP_COLORS } from "../lib/format";

const STACK_MODES = [
  { key: "consolidated", label: "Consolidated" },
  { key: "by_rep",       label: "By Rep" },
];

const REP_LABELS = { arlen: "Arlen M.", derek: "Derek G.", grant: "Grant A." };

const ttStyle = { background: "#111827", border: "1px solid #374151", borderRadius: 6, fontSize: 12 };
const ttFmt = (v) => (v != null ? fmt$(v, { compact: true }) : "—");

const AXIS_PROPS = {
  tick: { fontSize: 10, fill: "#6b7280", dy: 4 },
  angle: -45,
  textAnchor: "end",
  interval: 0,
  axisLine: false,
  tickLine: false,
};

const MARGIN = { top: 20, right: 8, bottom: 45, left: 0 };
const LEGEND_STYLE = { fontSize: 10, paddingBottom: 4 };

function BarLabel({ x, y, width, value }) {
  if (!value) return null;
  return (
    <text x={x + width / 2} y={y - 4} fill="#9ca3af" textAnchor="middle" fontSize={10}>
      {fmt$(value, { compact: true })}
    </text>
  );
}

export default function ClosedWonTrends() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [mode, setMode] = useState("consolidated");

  useEffect(() => { api.trends(12).then(setData).catch(setErr); }, []);

  const stackKeys = (() => {
    if (!data || mode === "consolidated") return [];
    return data.stacked?.by_rep?.keys || [];
  })();

  const tcvData = (() => {
    if (!data) return [];
    if (mode === "consolidated") return data.monthly_arr;
    return data.stacked?.by_rep?.data || [];
  })();

  const countData = (() => {
    if (!data) return [];
    if (mode === "consolidated") return data.monthly_count;
    return data.stacked?.by_rep_count?.data || [];
  })();

  const isStacked = mode === "by_rep" && stackKeys.length > 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Closed-Won Trends (last 12 months)</h2>
        <div className="flex gap-1">
          {STACK_MODES.map(m => (
            <button key={m.key} onClick={() => setMode(m.key)}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${
                mode === m.key ? "bg-quinn-600 text-white" : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {err && <div className="text-red-400 text-sm mb-2">Error: {err.message}</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* New TCV Closed / Mo */}
        <div className="card">
          <div className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">New TCV Closed / Mo</div>
          {!data ? (
            <div className="h-64 flex items-center justify-center text-gray-600">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={tcvData} margin={MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="label" {...AXIS_PROPS} />
                <YAxis tickFormatter={v => fmt$(v, { compact: true })} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip contentStyle={ttStyle} formatter={ttFmt} />
                {isStacked && <Legend verticalAlign="top" wrapperStyle={LEGEND_STYLE} formatter={s => REP_LABELS[s] || s} />}
                {isStacked ? (
                  stackKeys.map(k => (
                    <Bar key={k} dataKey={k} name={REP_LABELS[k] || k} stackId="s" fill={REP_COLORS[k] || "#6b7280"} />
                  ))
                ) : (
                  <Bar dataKey="value" name="New TCV" fill="#2897a8" radius={[3,3,0,0]}>
                    <LabelList content={<BarLabel />} />
                  </Bar>
                )}
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Deals Closed / Mo */}
        <div className="card">
          <div className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">Deals Closed / Mo</div>
          {!data ? (
            <div className="h-64 flex items-center justify-center text-gray-600">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={countData} margin={MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="label" {...AXIS_PROPS} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={24} />
                <Tooltip contentStyle={ttStyle} />
                {isStacked && <Legend verticalAlign="top" wrapperStyle={LEGEND_STYLE} formatter={s => REP_LABELS[s] || s} />}
                {isStacked ? (
                  stackKeys.map(k => (
                    <Bar key={k} dataKey={k} name={REP_LABELS[k] || k} stackId="s" fill={REP_COLORS[k] || "#6b7280"} />
                  ))
                ) : (
                  <Bar dataKey="value" name="Deals" fill="#6366f1" radius={[3,3,0,0]}>
                    <LabelList dataKey="value" position="top" style={{ fontSize: 10, fill: "#9ca3af" }} formatter={v => v > 0 ? v : ""} />
                  </Bar>
                )}
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Avg ACV / Mo */}
        <div className="card">
          <div className="text-xs font-medium text-gray-400 mb-3 uppercase tracking-wide">Avg ACV / Mo</div>
          {!data ? (
            <div className="h-64 flex items-center justify-center text-gray-600">Loading…</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <ComposedChart data={data?.monthly_acv} margin={MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="label" {...AXIS_PROPS} />
                <YAxis tickFormatter={v => fmt$(v, { compact: true })} tick={{ fontSize: 10, fill: "#6b7280" }} axisLine={false} tickLine={false} width={48} />
                <Tooltip contentStyle={ttStyle} formatter={ttFmt} />
                <Bar dataKey="value" name="Avg ACV" fill="#f59e0b" radius={[3,3,0,0]}>
                  <LabelList content={<BarLabel />} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
