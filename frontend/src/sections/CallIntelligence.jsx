import React, { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import CallSummary from "../components/CallSummary";

const REP_LABELS = { arlen: "Arlen M.", derek: "Derek G.", grant: "Grant A.", luke: "Luke A." };
const REPS = [
  { value: "", label: "All Reps" },
  { value: "arlen", label: "Arlen M." },
  { value: "derek", label: "Derek G." },
  { value: "grant", label: "Grant A." },
];

function fmtDuration(secs) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  return `${m}m`;
}

function fmtDate(str) {
  if (!str) return "—";
  return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function TranscriptPanel({ gongId, onClose }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.callTranscript(gongId).then(d => { setData(d); setLoading(false); });
  }, [gongId]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end" onClick={onClose}>
      <div
        className="h-full w-full max-w-2xl bg-gray-900 border-l border-gray-700 shadow-2xl overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-gray-900 border-b border-gray-800 px-6 py-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-white font-semibold text-sm">{data?.title || "Loading…"}</div>
            {data && (
              <div className="text-xs text-gray-500 mt-0.5">
                {fmtDate(data.started_at)} · {fmtDuration(data.duration_secs)} · {REP_LABELS[data.rep_slug] || data.rep_slug || "—"}
                {data.matched_company && <> · <span className="text-gray-400">{data.matched_company}</span></>}
              </div>
            )}
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-lg shrink-0 mt-0.5">✕</button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 flex-1">
          {loading ? (
            <div className="text-gray-600 text-sm">Loading transcript…</div>
          ) : !data?.transcript ? (
            <div className="text-gray-600 text-sm">No transcript available for this call.</div>
          ) : (
            <>
              <CallSummary gongId={gongId} hasTranscript={!!data.transcript} />
              <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                {data.transcript}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function CallRow({ call, onSelect }) {
  return (
    <tr
      className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors cursor-pointer"
      onClick={() => call.has_transcript && onSelect(call.gong_id)}
    >
      <td className="px-3 py-2.5 text-white text-sm max-w-xs truncate">
        {call.title || "—"}
      </td>
      <td className="px-3 py-2.5 text-gray-400 text-sm whitespace-nowrap">
        {fmtDate(call.started_at)}
      </td>
      <td className="px-3 py-2.5 text-gray-400 text-sm whitespace-nowrap">
        {REP_LABELS[call.rep_slug] || call.rep_slug || "—"}
      </td>
      <td className="px-3 py-2.5 text-gray-400 text-sm whitespace-nowrap">
        {fmtDuration(call.duration_secs)}
      </td>
      <td className="px-3 py-2.5 text-gray-400 text-sm">
        {call.matched_company || <span className="text-gray-700">—</span>}
      </td>
      <td className="px-3 py-2.5 text-sm">
        {call.has_transcript
          ? <span className="text-quinn-400 text-xs">View →</span>
          : <span className="text-gray-700 text-xs">no transcript</span>}
      </td>
    </tr>
  );
}

export default function CallIntelligence() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState("");
  const [filterRep, setFilterRep] = useState("");
  const [activeId, setActiveId] = useState(null);
  const [inputVal, setInputVal] = useState("");

  const load = useCallback((q, rep) => {
    setData(null);
    api.calls({ q: q || undefined, rep: rep || undefined, limit: 100 })
      .then(setData).catch(setErr);
  }, []);

  useEffect(() => { load("", ""); }, [load]);

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(inputVal);
    load(inputVal, filterRep);
  };

  const handleRepChange = (rep) => {
    setFilterRep(rep);
    load(search, rep);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Call Intelligence</h2>
          <p className="text-xs text-gray-500 mt-0.5">Gong call transcripts · last 180 days</p>
        </div>
        {data && (
          <span className="text-xs text-gray-500">{data.count} calls</span>
        )}
      </div>

      {err && <div className="text-red-400 text-sm mb-3">Error: {err.message}</div>}

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search call titles…"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 rounded px-3 py-1.5 w-56 focus:outline-none focus:border-quinn-500"
        />
        <button type="submit"
          className="text-xs px-3 py-1.5 bg-quinn-700 hover:bg-quinn-600 text-white rounded transition-colors">
          Search
        </button>
        <select value={filterRep} onChange={e => handleRepChange(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-quinn-500">
          {REPS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </form>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80">
              {["Title", "Date", "Rep", "Duration", "Company", ""].map(h => (
                <th key={h} className="px-3 py-2.5 text-left text-xs font-medium text-gray-400 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-600">Loading…</td></tr>
            ) : data.data.length === 0 ? (
              <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-600">No calls found</td></tr>
            ) : data.data.map(call => (
              <CallRow key={call.gong_id} call={call} onSelect={setActiveId} />
            ))}
          </tbody>
        </table>
      </div>

      {activeId && <TranscriptPanel gongId={activeId} onClose={() => setActiveId(null)} />}
    </div>
  );
}
