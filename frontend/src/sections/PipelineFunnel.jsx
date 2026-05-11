import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmt$, fmtPct } from "../lib/format";

const BUCKET_LABELS = { early: "Early", mid: "Mid", late: "Late" };
const BUCKET_COLORS = { early: "#6366f1", mid: "#f59e0b", late: "#10b981" };

const REPS = [
  { value: "", label: "All Reps" },
  { value: "arlen", label: "Arlen" },
  { value: "derek", label: "Derek" },
  { value: "grant", label: "Grant" },
  { value: "luke",  label: "Luke" },
];

function DealsList({ deals }) {
  if (!deals?.length) return <p className="text-xs text-gray-600 italic mt-2">No deals in this stage.</p>;
  return (
    <div className="mt-3 pt-3 border-t border-gray-800 space-y-1.5">
      <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-wider mb-1.5">
        {deals.length} deal{deals.length !== 1 ? "s" : ""}
      </div>
      {deals.map((d, i) => (
        <div key={i} className="flex items-center justify-between text-xs gap-3">
          <span className="text-gray-300 truncate">{d.company}</span>
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-gray-400 tabular-nums">{fmt$(d.amount, { compact: true })}</span>
            <span className="text-gray-600">{d.owner}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PipelineFunnel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [rep, setRep] = useState("");
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    setData(null);
    setExpanded({});
    api.pipeline(rep || null).then(setData).catch(setErr);
  }, [rep]);

  const toggleExpand = (bucket) =>
    setExpanded(prev => ({ ...prev, [bucket]: !prev[bucket] }));

  const totalAmt = data?.total_open_pipeline || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-serif font-medium text-gray-50 tracking-tight">Pipeline Funnel</h2>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-xs text-gray-500">
              Win rate (90d): <span className="text-gray-50 font-medium">{fmtPct(data.win_rate_90d_pct)}</span>
            </span>
          )}
          <select value={rep} onChange={e => setRep(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-quinn-500">
            {REPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {err && <div className="text-red-500 text-sm mb-3">Error: {err.message}</div>}

      {!data ? (
        <div className="text-gray-600 text-sm">Loading…</div>
      ) : (
        <div className="space-y-3">
          {/* Funnel bars */}
          {(data.funnel || []).map((stage) => {
            const pct = totalAmt > 0 ? (stage.amount / totalAmt) * 100 : 0;
            const color = BUCKET_COLORS[stage.bucket] || "#374151";
            const isOpen = expanded[stage.bucket];
            return (
              <div key={stage.bucket} className="card">
                <div
                  className="flex items-center justify-between mb-2 cursor-pointer select-none"
                  onClick={() => toggleExpand(stage.bucket)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                    <span className="font-medium text-gray-50">{BUCKET_LABELS[stage.bucket]}</span>
                    {stage.stale_count > 0 && (
                      <span className="badge bg-amber-900/50 text-amber-600 border border-amber-800">
                        {stage.stale_count} stale
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-gray-50 font-semibold tabular-nums">{fmt$(stage.amount, { compact: true })}</span>
                    <span className="text-gray-400 tabular-nums">{stage.count} deals</span>
                    <span className="text-gray-500 tabular-nums text-xs">
                      avg {stage.avg_days_in_stage != null ? `${stage.avg_days_in_stage}d` : "—"} in stage
                    </span>
                    <span className="text-gray-600 text-xs ml-1">
                      {isOpen ? "▲" : "▼"}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
                </div>
                <div className="text-xs text-gray-600 mt-1">{pct.toFixed(1)}% of open pipeline</div>

                {/* Expandable deal list */}
                {isOpen && <DealsList deals={stage.deals} />}
              </div>
            );
          })}

          {/* Summary */}
          <div className="card bg-gray-800/40">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Total Open Pipeline</span>
              <span className="text-gray-50 font-bold tabular-nums text-lg">{fmt$(totalAmt, { compact: true })}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
              <span>{data.open_deal_count} open deals</span>
              <span>90-day win rate: <span className="text-gray-300">{fmtPct(data.win_rate_90d_pct)}</span></span>
            </div>
          </div>

          <div className="text-xs text-gray-600 mt-2 space-y-0.5">
            <div><span className="text-gray-500 font-medium">Stage buckets:</span> Early = Discovery Complete · Mid = Demo Complete, Quote Sent · Late = Verbal Commit</div>
            <div><span className="text-gray-500 font-medium">Stale flag:</span> deal has been in its current stage longer than expected — Early &gt;14 days, Mid &gt;21 days, Late &gt;30 days.</div>
            <div><span className="text-gray-500 font-medium">Click any stage</span> to expand the individual deal list.</div>
          </div>
        </div>
      )}
    </div>
  );
}
