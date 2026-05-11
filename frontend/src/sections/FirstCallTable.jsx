import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

const DAYS_OPTIONS = [30, 45, 60, 90];

const TIER_COLOR = {
  T1: "text-emerald-400",
  T2: "text-blue-400",
  T3: "text-amber-400",
  T4: "text-gray-500",
};

function ScorePip({ score, max, color }) {
  if (score == null) return <span className="text-gray-600">—</span>;
  const pct = Math.min(100, Math.round((score / max) * 100));
  return (
    <div className="flex items-center gap-1 min-w-[52px]">
      <span className={`tabular-nums text-xs ${color}`}>{score}</span>
      <div className="flex-1 h-1 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color.replace("text-", "bg-")}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  if (!status || status === "—") return <span className="text-gray-600">—</span>;
  const lower = status.toLowerCase();
  if (lower.includes("qualif") && !lower.includes("dis")) {
    return <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-1.5 py-0.5 rounded">Qualified</span>;
  }
  if (lower.includes("disqual") || lower.includes("not")) {
    return <span className="text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/30 px-1.5 py-0.5 rounded">DQ'd</span>;
  }
  return <span className="text-xs text-gray-400">{status}</span>;
}

function fmt_date(str) {
  if (!str) return "—";
  return new Date(str + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function FirstCallTable() {
  const [days, setDays] = useState(45);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    setLoading(true);
    setData(null);
    api.firstCalls(days)
      .then((d) => { setData(d); setLoading(false); })
      .catch((e) => { setErr(e.message); setLoading(false); });
  }, [days]);

  const rows = data?.data || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold text-white">First Calls</h2>
        <div className="flex items-center gap-1">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`text-xs px-2 py-1 rounded transition-colors ${
                days === d
                  ? "bg-quinn-700 text-white"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Companies whose first-ever Gong call was in the last {days} days. BANT scores from N8N/HubSpot.
      </p>

      <div className="card overflow-x-auto">
        {loading && (
          <div className="space-y-2 py-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-9 bg-gray-800/60 rounded animate-pulse" />
            ))}
          </div>
        )}
        {err && <div className="text-red-400 text-sm py-2">{err}</div>}
        {!loading && !err && rows.length === 0 && (
          <p className="text-xs text-gray-500 italic py-4 text-center">No first calls found in the last {days} days.</p>
        )}
        {!loading && rows.length > 0 && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2 pr-3">Company</th>
                <th className="text-left pb-2 pr-3">Tier</th>
                <th className="text-left pb-2 pr-3">Date</th>
                <th className="text-left pb-2 pr-3">Rep</th>
                <th className="text-left pb-2 pr-3">Contact</th>
                <th className="text-right pb-2 pr-2">BANT</th>
                <th className="text-right pb-2 pr-2 hidden lg:table-cell">B</th>
                <th className="text-right pb-2 pr-2 hidden lg:table-cell">A</th>
                <th className="text-right pb-2 pr-2 hidden lg:table-cell">N</th>
                <th className="text-right pb-2 pr-3 hidden lg:table-cell">T</th>
                <th className="text-left pb-2 pr-3">Status</th>
                <th className="text-left pb-2">Links</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.gong_id} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                  <td className="py-1.5 pr-3 font-medium text-gray-200 max-w-[140px] truncate">{r.company}</td>
                  <td className="py-1.5 pr-3">
                    <span className={`font-semibold ${TIER_COLOR[r.tier] || "text-gray-500"}`}>{r.tier}</span>
                  </td>
                  <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">{fmt_date(r.call_date)}</td>
                  <td className="py-1.5 pr-3 text-gray-400">{r.rep}</td>
                  <td className="py-1.5 pr-3 text-gray-500 max-w-[120px] truncate">{r.contact_name || "—"}</td>
                  <td className="py-1.5 pr-2 text-right">
                    {r.bant_score != null
                      ? <span className={`font-semibold tabular-nums ${r.bant_score >= 50 ? "text-emerald-400" : "text-amber-400"}`}>{r.bant_score}</span>
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                  <td className="py-1.5 pr-2 text-right hidden lg:table-cell text-gray-400 tabular-nums">{r.budget_score ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-right hidden lg:table-cell text-gray-400 tabular-nums">{r.authority_score ?? "—"}</td>
                  <td className="py-1.5 pr-2 text-right hidden lg:table-cell text-gray-400 tabular-nums">{r.need_score ?? "—"}</td>
                  <td className="py-1.5 pr-3 text-right hidden lg:table-cell text-gray-400 tabular-nums">{r.timeline_score ?? "—"}</td>
                  <td className="py-1.5 pr-3">
                    <StatusBadge status={r.qualification_status} />
                  </td>
                  <td className="py-1.5">
                    <div className="flex items-center gap-2">
                      {r.gong_id && (
                        <a
                          href={`https://app.gong.io/call?id=${r.gong_id}`}
                          target="_blank" rel="noreferrer"
                          className="text-quinn-400 hover:text-quinn-300 text-xs underline underline-offset-2"
                        >
                          Gong
                        </a>
                      )}
                      {r.hubspot_deal_id && (
                        <a
                          href={`https://app.hubspot.com/contacts/deals/${r.hubspot_deal_id}`}
                          target="_blank" rel="noreferrer"
                          className="text-orange-400 hover:text-orange-300 text-xs underline underline-offset-2"
                        >
                          HS
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="mt-3 text-xs text-gray-600">
          BANT max: B=15, A=25, N=40, T=20. Qualification threshold: T1/T2 ≥ 50, T3/T4 ≥ 70.
          Rows without BANT scores haven't been analyzed by the N8N workflow yet.
        </div>
      </div>
    </div>
  );
}
