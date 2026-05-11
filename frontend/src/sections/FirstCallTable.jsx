import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

const DAYS_OPTIONS = [30, 45, 60, 90];

const TIER_COLOR = {
  T1: "text-emerald-400",
  T2: "text-blue-400",
  T3: "text-amber-400",
  T4: "text-gray-500",
};

const STAGE_LABEL = {
  early: "Discovery",
  mid: "Demo/Quote",
  late: "Verbal Commit",
  closed_won: "Won",
  closed_lost: "Lost",
  unknown: "New",
};

const STAGE_COLOR = {
  early: "text-blue-400",
  mid: "text-purple-400",
  late: "text-amber-400",
  closed_won: "text-emerald-400",
  closed_lost: "text-red-400",
  unknown: "text-gray-500",
};

function StatusBadge({ status }) {
  if (!status || status === "—") return <span className="text-gray-600">—</span>;
  const lower = (status || "").toLowerCase().replace(/_/g, " ");
  if (lower === "true" || lower === "1") {
    // Raw boolean — probably means qualified
    return <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-1.5 py-0.5 rounded">Qualified</span>;
  }
  if (lower.includes("qualif") && !lower.includes("dis") && !lower.includes("not")) {
    return <span className="text-xs font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/30 px-1.5 py-0.5 rounded">Qualified</span>;
  }
  if (lower.includes("disqual") || lower.includes("not qualif") || lower === "false" || lower === "0") {
    return <span className="text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/30 px-1.5 py-0.5 rounded">DQ'd</span>;
  }
  if (lower.includes("review") || lower.includes("pending")) {
    return <span className="text-xs font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/30 px-1.5 py-0.5 rounded">Pending</span>;
  }
  // Show whatever raw value it is, truncated
  return <span className="text-xs text-gray-400">{status.slice(0, 20)}</span>;
}

function fmt_date(str) {
  if (!str) return "—";
  return new Date(str.replace(" ", "T")).toLocaleDateString("en-US", {
    month: "short", day: "numeric",
  });
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
  const bantMissing = rows.length > 0 && rows.every(r => r.bant_score == null);

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
                days === d ? "bg-quinn-700 text-white" : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Companies whose <em>first-ever</em> Gong call with Quinn was in the last {days} days.
        BANT scores are written by the N8N qualification workflow after each call.
      </p>

      {bantMissing && (
        <div className="mb-3 flex items-start gap-2 text-xs text-amber-400 bg-amber-400/5 border border-amber-400/20 rounded-lg px-3 py-2">
          <span className="shrink-0 mt-0.5">⚠</span>
          <span>
            BANT scores are empty — the N8N workflow hasn't written scores for these calls yet,
            or the latest HubSpot snapshot hasn't run. Click <strong>↺ Refresh Data</strong> in the
            header to pull the latest data.
          </span>
        </div>
      )}

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
          <p className="text-xs text-gray-500 italic py-4 text-center">
            No first calls found in the last {days} days.
          </p>
        )}
        {!loading && rows.length > 0 && (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-2 pr-3">Company</th>
                <th className="text-left pb-2 pr-3">Tier</th>
                <th className="text-left pb-2 pr-3">Date</th>
                <th className="text-left pb-2 pr-3">Rep</th>
                <th className="text-left pb-2 pr-3 hidden md:table-cell">HubSpot Stage</th>
                <th className="text-left pb-2 pr-3 hidden md:table-cell">Contact</th>
                <th
                  className="text-right pb-2 pr-2"
                  title="Total BANT score out of 100 (Budget 15 + Authority 25 + Need 40 + Timeline 20)"
                >
                  BANT /100
                </th>
                <th className="text-right pb-2 pr-2 hidden lg:table-cell" title="Budget (max 15)">B</th>
                <th className="text-right pb-2 pr-2 hidden lg:table-cell" title="Authority (max 25)">A</th>
                <th className="text-right pb-2 pr-2 hidden lg:table-cell" title="Need (max 40)">N</th>
                <th className="text-right pb-2 pr-3 hidden lg:table-cell" title="Timeline (max 20)">T</th>
                <th
                  className="text-left pb-2 pr-3"
                  title="Qualified = BANT ≥ 50 for T1/T2, ≥ 70 for T3/T4"
                >
                  N8N Result
                </th>
                <th className="text-left pb-2">Links</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.gong_id} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                  <td className="py-1.5 pr-3 font-medium text-gray-200 max-w-[160px] truncate">
                    {r.company}
                  </td>
                  <td className="py-1.5 pr-3">
                    {r.tier && r.tier !== "—"
                      ? <span className={`font-semibold ${TIER_COLOR[r.tier] || "text-gray-500"}`}>{r.tier}</span>
                      : <span className="text-gray-600">—</span>
                    }
                  </td>
                  <td className="py-1.5 pr-3 text-gray-400 whitespace-nowrap">{fmt_date(r.call_date)}</td>
                  <td className="py-1.5 pr-3 text-gray-400">{r.rep}</td>
                  <td className="py-1.5 pr-3 hidden md:table-cell">
                    {r.stage && r.stage !== "—"
                      ? <span className={`${STAGE_COLOR[r.stage] || "text-gray-400"}`}>
                          {STAGE_LABEL[r.stage] || r.stage}
                        </span>
                      : <span className="text-gray-600">No deal yet</span>
                    }
                  </td>
                  <td className="py-1.5 pr-3 text-gray-500 max-w-[120px] truncate hidden md:table-cell">
                    {r.contact_name || <span className="text-gray-700 italic">—</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-right">
                    {r.bant_score != null
                      ? <span className={`font-semibold tabular-nums ${
                          r.bant_score >= 70 ? "text-emerald-400" :
                          r.bant_score >= 50 ? "text-amber-400" : "text-red-400"
                        }`}>{r.bant_score}</span>
                      : <span className="text-gray-700">—</span>
                    }
                  </td>
                  <td className="py-1.5 pr-2 text-right hidden lg:table-cell text-gray-500 tabular-nums">
                    {r.budget_score ?? <span className="text-gray-700">—</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-right hidden lg:table-cell text-gray-500 tabular-nums">
                    {r.authority_score ?? <span className="text-gray-700">—</span>}
                  </td>
                  <td className="py-1.5 pr-2 text-right hidden lg:table-cell text-gray-500 tabular-nums">
                    {r.need_score ?? <span className="text-gray-700">—</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-right hidden lg:table-cell text-gray-500 tabular-nums">
                    {r.timeline_score ?? <span className="text-gray-700">—</span>}
                  </td>
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
          <span className="text-gray-500">BANT breakdown:</span> Budget (max 15) · Authority (max 25) · Need (max 40) · Timeline (max 20) = 100 total. ·
          <span className="text-gray-500 ml-1">Qualification threshold:</span> T1/T2 ≥ 50 &amp; Authority ≥ 10 · T3/T4 ≥ 70.
          · <span className="text-gray-500">N8N Result</span> = lead_qualification_status from HubSpot, set by the N8N workflow after each call.
          · <span className="text-gray-500">HubSpot Stage</span> = current deal stage if a deal exists; "No deal yet" = prospect hasn't been converted to a deal.
        </div>
      </div>
    </div>
  );
}
