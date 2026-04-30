import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

// ── Verdict styles ────────────────────────────────────────────────────────────
const VERDICT = {
  qualify: {
    bg: "bg-emerald-950/60",
    border: "border-emerald-700",
    badge: "bg-emerald-800 text-emerald-200",
    label: "Qualify",
    dot: "bg-emerald-400",
  },
  disqualify: {
    bg: "bg-red-950/60",
    border: "border-red-700",
    badge: "bg-red-800 text-red-200",
    label: "Disqualify",
    dot: "bg-red-400",
  },
  nurture: {
    bg: "bg-amber-950/50",
    border: "border-amber-700",
    badge: "bg-amber-800 text-amber-200",
    label: "Nurture",
    dot: "bg-amber-400",
  },
};

const BANT = [
  { key: "budget",    label: "Budget",    icon: "💰" },
  { key: "authority", label: "Authority", icon: "👤" },
  { key: "need",      label: "Need",      icon: "🎯" },
  { key: "timeline",  label: "Timeline",  icon: "📅" },
];

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="animate-pulse space-y-2 mb-5">
      <div className="h-3 w-24 bg-gray-800 rounded" />
      <div className="grid grid-cols-2 gap-2">
        {[0,1,2,3].map(i => (
          <div key={i} className="h-14 bg-gray-800 rounded-lg" />
        ))}
      </div>
      <div className="h-8 bg-gray-800 rounded-lg" />
      <div className="h-12 bg-gray-800 rounded-lg" />
      <div className="h-12 bg-gray-800 rounded-lg" />
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function CallSummary({ gongId, hasTranscript }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = (refresh = false) => {
    setLoading(true);
    setError(null);
    const fn = refresh ? api.callSummaryRefresh : api.callSummary;
    fn(gongId)
      .then(d => {
        if (d?.error) setError(d.error);
        else setData(d);
        setLoading(false);
        setRefreshing(false);
      })
      .catch(e => {
        setError(e.message);
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    if (!hasTranscript) return;
    setData(null);
    load();
  }, [gongId, hasTranscript]);

  if (!hasTranscript) return null;
  if (loading) return <Skeleton />;

  const v = VERDICT[data?.verdict] || null;

  return (
    <div className="mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          AI Analysis
        </span>
        {data && !error && (
          <button
            onClick={() => { setRefreshing(true); load(true); }}
            disabled={refreshing}
            className="text-xs text-gray-600 hover:text-gray-400 transition-colors disabled:opacity-50"
          >
            {refreshing ? "Refreshing…" : "↺ Refresh"}
          </button>
        )}
      </div>

      {error ? (
        <div className="text-xs text-gray-600 italic mb-4">{error}</div>
      ) : data ? (
        <div className="space-y-2">
          {/* BANT 2×2 grid */}
          <div className="grid grid-cols-2 gap-2">
            {BANT.map(({ key, label, icon }) => (
              <div
                key={key}
                className="bg-gray-800/50 border border-gray-700/60 rounded-lg px-3 py-2"
              >
                <div className="text-xs text-gray-500 mb-0.5 font-medium">
                  {icon} {label}
                </div>
                <div className="text-xs text-gray-300 leading-snug">
                  {data.bant?.[key] ?? (
                    <span className="text-gray-600 italic">not discussed</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Verdict */}
          {v && (
            <div className={`${v.bg} border ${v.border} rounded-lg px-3 py-2 flex items-start gap-2.5`}>
              <span className={`${v.badge} text-xs font-bold px-1.5 py-0.5 rounded shrink-0 mt-0.5`}>
                {v.label}
              </span>
              <span className="text-xs text-gray-300 leading-snug">
                {data.verdict_reason}
              </span>
            </div>
          )}

          {/* Action items */}
          {data.action_items?.length > 0 && (
            <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg px-3 py-2">
              <div className="text-xs font-semibold text-gray-400 mb-1.5">Next Steps</div>
              <ul className="space-y-1">
                {data.action_items.map((item, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
                    <span className="text-quinn-400 shrink-0 mt-0.5">→</span>
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Coaching */}
          {data.coaching?.length > 0 && (
            <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg px-3 py-2">
              <div className="text-xs font-semibold text-gray-400 mb-1.5">Coaching Notes</div>
              <ul className="space-y-1">
                {data.coaching.map((note, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-400">
                    <span className="text-amber-500 shrink-0 mt-0.5">⚑</span>
                    {note}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : null}

      {/* Divider before transcript */}
      <div className="mt-4 pt-3 border-t border-gray-800">
        <div className="text-xs font-semibold text-gray-500">Full Transcript</div>
      </div>
    </div>
  );
}
