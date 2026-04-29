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

export default function PipelineFunnel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [rep, setRep] = useState("");

  useEffect(() => {
    setData(null);
    api.pipeline(rep || null).then(setData).catch(setErr);
  }, [rep]);

  const totalAmt = data?.total_open_pipeline || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Pipeline Funnel</h2>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-xs text-gray-500">
              Win rate (90d): <span className="text-white font-medium">{fmtPct(data.win_rate_90d_pct)}</span>
            </span>
          )}
          <select value={rep} onChange={e => setRep(e.target.value)}
            className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-quinn-500">
            {REPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
          </select>
        </div>
      </div>

      {err && <div className="text-red-400 text-sm mb-3">Error: {err.message}</div>}

      {!data ? (
        <div className="text-gray-600 text-sm">Loading…</div>
      ) : (
        <div className="space-y-3">
          {/* Funnel bars */}
          {(data.funnel || []).map((stage) => {
            const pct = totalAmt > 0 ? (stage.amount / totalAmt) * 100 : 0;
            const color = BUCKET_COLORS[stage.bucket] || "#374151";
            return (
              <div key={stage.bucket} className="card">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ background: color }} />
                    <span className="font-medium text-white">{BUCKET_LABELS[stage.bucket]}</span>
                    {stage.stale_count > 0 && (
                      <span className="badge bg-amber-900/50 text-amber-300 border border-amber-800">
                        {stage.stale_count} stale
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-white font-semibold tabular-nums">{fmt$(stage.amount, { compact: true })}</span>
                    <span className="text-gray-400 tabular-nums">{stage.count} deals</span>
                    <span className="text-gray-500 tabular-nums text-xs">
                      avg {stage.avg_days_in_stage != null ? `${stage.avg_days_in_stage}d` : "—"} in stage
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(pct, 2)}%`, background: color }} />
                </div>
                <div className="text-xs text-gray-600 mt-1">{pct.toFixed(1)}% of open pipeline</div>
              </div>
            );
          })}

          {/* Summary */}
          <div className="card bg-gray-800/40">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Total Open Pipeline</span>
              <span className="text-white font-bold tabular-nums text-lg">{fmt$(totalAmt, { compact: true })}</span>
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-1">
              <span>{data.open_deal_count} open deals</span>
              <span>90-day win rate: <span className="text-gray-300">{fmtPct(data.win_rate_90d_pct)}</span></span>
            </div>
          </div>

          <div className="text-xs text-gray-600 mt-2 space-y-0.5">
            <div><span className="text-gray-500 font-medium">Stage buckets:</span> Early = Discovery Complete · Mid = Demo Complete, Quote Sent · Late = Verbal Commit</div>
            <div><span className="text-gray-500 font-medium">Stale flag:</span> deal has been in its current stage longer than expected — Early &gt;14 days, Mid &gt;21 days, Late &gt;30 days. These deals may need a follow-up or a stage update in HubSpot.</div>
            <div><span className="text-gray-500 font-medium">Win Rate</span> = deals closed won ÷ (deals closed won + deals closed lost), rolling 90 days.</div>
          </div>
        </div>
      )}
    </div>
  );
}
