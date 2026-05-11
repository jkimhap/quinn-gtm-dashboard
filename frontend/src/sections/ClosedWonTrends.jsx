import React, { useEffect, useState, useCallback } from "react";
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

const ttStyle = {
  background: "#111827",
  border: "1px solid #374151",
  borderRadius: 8,
  fontSize: 12,
  padding: 0,
  boxShadow: "0 4px 24px rgba(0,0,0,0.5)",
};

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

// ── Shared drill-down tooltip ─────────────────────────────────────────────────
function makeDrillTooltip(dealsByMonth, mode, renderDeal) {
  return function DrillTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const pt = payload[0]?.payload;
    const monthKey = pt?.month;
    const label = pt?.label;

    // Deals for this month
    const deals = dealsByMonth?.[monthKey] || [];

    // In by_rep mode, filter + label per rep bar
    const repBars = mode === "by_rep"
      ? payload.filter(p => p.value > 0).map(p => ({
          rep: REP_LABELS[p.dataKey] || p.dataKey,
          value: p.value,
          color: p.fill || p.stroke,
        }))
      : null;

    const total = payload.reduce((s, p) => s + (p.value || 0), 0);

    return (
      <div style={{ ...ttStyle, minWidth: 200, maxWidth: 280 }}>
        <div className="px-3 py-2 border-b border-gray-800">
          <div className="text-xs font-semibold text-white">{label}</div>
          {total > 0 && (
            <div className="text-xs text-gray-400 mt-0.5">
              Total: <span className="text-white font-medium">{renderDeal ? renderDeal(total, "total") : fmt$(total, { compact: true })}</span>
            </div>
          )}
        </div>

        {/* By-rep breakdown */}
        {repBars && repBars.length > 0 && (
          <div className="px-3 py-2 border-b border-gray-800 space-y-1">
            {repBars.map((r) => (
              <div key={r.rep} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                  <span className="text-gray-400">{r.rep}</span>
                </div>
                <span className="text-gray-300 tabular-nums">
                  {renderDeal ? renderDeal(r.value, "rep") : fmt$(r.value, { compact: true })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Individual deals */}
        {deals.length > 0 && (
          <div className="px-3 py-2 space-y-1.5 max-h-52 overflow-y-auto">
            <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">Deals</div>
            {deals.map((d, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-gray-300 leading-tight truncate max-w-[140px]">{d.company}</span>
                <div className="text-right shrink-0">
                  <div className="text-gray-400 tabular-nums">{fmt$(d.tcv, { compact: true })}</div>
                  {d.rep && <div className="text-gray-600 text-[10px]">{d.rep}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
        {deals.length === 0 && mode === "consolidated" && (
          <div className="px-3 py-2 text-xs text-gray-600 italic">No deals this month</div>
        )}
      </div>
    );
  };
}

function makeCountTooltip(dealsByMonth, mode) {
  return function CountTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const pt = payload[0]?.payload;
    const monthKey = pt?.month;
    const label = pt?.label;
    const deals = dealsByMonth?.[monthKey] || [];

    const repBars = mode === "by_rep"
      ? payload.filter(p => p.value > 0).map(p => ({
          rep: REP_LABELS[p.dataKey] || p.dataKey,
          value: p.value,
          color: p.fill,
        }))
      : null;

    const total = payload.reduce((s, p) => s + (p.value || 0), 0);

    return (
      <div style={{ ...ttStyle, minWidth: 200, maxWidth: 280 }}>
        <div className="px-3 py-2 border-b border-gray-800">
          <div className="text-xs font-semibold text-white">{label}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {total} deal{total !== 1 ? "s" : ""} closed
          </div>
        </div>
        {repBars && repBars.length > 0 && (
          <div className="px-3 py-2 border-b border-gray-800 space-y-1">
            {repBars.map((r) => (
              <div key={r.rep} className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: r.color }} />
                  <span className="text-gray-400">{r.rep}</span>
                </div>
                <span className="text-gray-300 tabular-nums">{r.value}</span>
              </div>
            ))}
          </div>
        )}
        {deals.length > 0 && (
          <div className="px-3 py-2 space-y-1.5 max-h-52 overflow-y-auto">
            <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">Deals</div>
            {deals.map((d, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-gray-300 leading-tight truncate max-w-[150px]">{d.company}</span>
                <div className="text-right shrink-0">
                  <div className="text-gray-400 tabular-nums">{fmt$(d.tcv, { compact: true })}</div>
                  {d.rep && <div className="text-gray-600 text-[10px]">{d.rep}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
}

function makeAcvTooltip(dealsByMonth) {
  return function AcvTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const pt = payload[0]?.payload;
    const monthKey = pt?.month;
    const label = pt?.label;
    const avg = payload[0]?.value;
    const deals = dealsByMonth?.[monthKey] || [];

    return (
      <div style={{ ...ttStyle, minWidth: 200, maxWidth: 280 }}>
        <div className="px-3 py-2 border-b border-gray-800">
          <div className="text-xs font-semibold text-white">{label}</div>
          {avg != null && (
            <div className="text-xs text-gray-400 mt-0.5">
              Avg ACV: <span className="text-white font-medium">{fmt$(avg, { compact: true })}</span>
              <span className="text-gray-600 ml-1">({deals.length} deal{deals.length !== 1 ? "s" : ""})</span>
            </div>
          )}
        </div>
        {deals.length > 0 && (
          <div className="px-3 py-2 space-y-1.5 max-h-52 overflow-y-auto">
            <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1">Individual ACV</div>
            {deals.map((d, i) => (
              <div key={i} className="flex items-start justify-between gap-2 text-xs">
                <span className="text-gray-300 leading-tight truncate max-w-[140px]">{d.company}</span>
                <span className="text-gray-400 tabular-nums shrink-0">{fmt$(d.arr || d.tcv, { compact: true })}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };
}

// ─────────────────────────────────────────────────────────────────────────────

export default function ClosedWonTrends() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [mode, setMode] = useState("consolidated");

  useEffect(() => { api.trends(12).then(setData).catch(setErr); }, []);

  const dealsByMonth = data?.deals_by_month || {};

  const TcvTooltip = useCallback(
    makeDrillTooltip(dealsByMonth, mode, null),
    [dealsByMonth, mode]
  );
  const CntTooltip = useCallback(
    makeCountTooltip(dealsByMonth, mode),
    [dealsByMonth, mode]
  );
  const AcvTooltip = useCallback(
    makeAcvTooltip(dealsByMonth),
    [dealsByMonth]
  );

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
                <Tooltip content={<TcvTooltip />} />
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
                <Tooltip content={<CntTooltip />} />
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
                <Tooltip content={<AcvTooltip />} />
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
