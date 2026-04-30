import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

// ── Loading skeleton ──────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Summary</span>
      </div>
      <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg px-4 py-3 mb-3 flex items-center gap-3">
        <svg className="animate-spin h-3.5 w-3.5 text-quinn-400 shrink-0" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
        <span className="text-xs text-gray-400">Generating AI summary — this takes 5–10 seconds on first load…</span>
      </div>
      <div className="animate-pulse space-y-2">
        <div className="h-14 bg-gray-800/60 rounded-lg" />
        <div className="h-20 bg-gray-800/60 rounded-lg" />
        <div className="h-16 bg-gray-800/60 rounded-lg" />
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <div className="bg-gray-800/40 border border-gray-700/40 rounded-lg px-3 py-2.5">
      <div className="text-xs font-semibold text-gray-400 mb-1.5">{title}</div>
      {children}
    </div>
  );
}

function BulletList({ items, color = "text-quinn-400", icon = "→" }) {
  if (!items?.length) return <p className="text-xs text-gray-600 italic">None noted</p>;
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-1.5 text-xs text-gray-300">
          <span className={`${color} shrink-0 mt-0.5`}>{icon}</span>
          {item}
        </li>
      ))}
    </ul>
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

  const cb = data?.commitments_and_blockers;

  return (
    <div className="mb-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          AI Summary
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

          {/* TL;DR */}
          {data.tldr && (
            <div className="bg-gray-800/60 border border-gray-700/60 rounded-lg px-3 py-2.5">
              <p className="text-xs text-gray-200 leading-relaxed">{data.tldr}</p>
            </div>
          )}

          {/* Key moments */}
          {data.key_moments?.length > 0 && (
            <Section title="Key Moments">
              <BulletList items={data.key_moments} color="text-quinn-400" icon="→" />
            </Section>
          )}

          {/* Commitments & blockers */}
          {cb && (
            <Section title="Commitments & Blockers">
              {cb.rep_committed?.length > 0 && (
                <div className="mb-1.5">
                  <div className="text-xs text-gray-600 mb-0.5">Rep</div>
                  <BulletList items={cb.rep_committed} color="text-emerald-500" icon="✓" />
                </div>
              )}
              {cb.prospect_committed?.length > 0 && (
                <div className="mb-1.5">
                  <div className="text-xs text-gray-600 mb-0.5">Prospect</div>
                  <BulletList items={cb.prospect_committed} color="text-blue-400" icon="✓" />
                </div>
              )}
              {cb.blockers?.length > 0 && (
                <div>
                  <div className="text-xs text-gray-600 mb-0.5">Blockers</div>
                  <BulletList items={cb.blockers} color="text-red-400" icon="!" />
                </div>
              )}
              {!cb.rep_committed?.length && !cb.prospect_committed?.length && !cb.blockers?.length && (
                <p className="text-xs text-gray-600 italic">No commitments or blockers noted</p>
              )}
            </Section>
          )}

          {/* Action items */}
          {data.action_items?.length > 0 && (
            <Section title="Action Items">
              <BulletList items={data.action_items} color="text-quinn-400" icon="→" />
            </Section>
          )}

          {/* Coaching */}
          {data.coaching?.length > 0 && (
            <Section title="Coaching Notes">
              <BulletList items={data.coaching} color="text-amber-500" icon="⚑" />
            </Section>
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
