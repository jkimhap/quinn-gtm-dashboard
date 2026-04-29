import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmt$, fmtPct, REP_COLORS } from "../lib/format";

const REP_LABELS = { arlen: "Arlen", derek: "Derek", grant: "Grant", luke: "Luke" };

function Metric({ label, value, sub, unavailable }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="text-xs text-gray-500">{label}</div>
      {unavailable
        ? <span className="unavailable">⚠ no data</span>
        : <div className="text-base font-bold text-white tabular-nums">{value ?? "—"}</div>
      }
      {sub && !unavailable && <div className="text-xs text-gray-600">{sub}</div>}
    </div>
  );
}

export default function LeadingIndicators() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api.leadingIndicators().then(setData).catch(setErr);
  }, []);

  const gongAvailable = data?.gong_available;
  const reps = data?.data ? Object.entries(data.data).filter(([slug]) => slug !== "luke") : [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Leading Indicators</h2>
          <p className="text-xs text-gray-500 mt-0.5">Last 30 days · meetings from Gong · opps from HubSpot</p>
        </div>
        {data && !gongAvailable && (
          <span className="unavailable">⚠ Gong not connected — meetings unavailable</span>
        )}
      </div>

      {err && <div className="text-red-400 text-sm mb-3">Error: {err.message}</div>}

      {!data ? (
        <div className="text-gray-600 text-sm">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {reps.map(([slug, rep]) => (
            <div key={slug} className="card" style={{ borderColor: (REP_COLORS[slug] || "#374151") + "44" }}>
              <div className="text-sm font-semibold mb-4" style={{ color: REP_COLORS[slug] || "#9ca3af" }}>
                {rep.name} · <span className="text-gray-500 font-normal text-xs">{rep.role === "sdr" ? "SDR" : "AE"}</span>
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-4">
                <Metric
                  label="Meetings/Day (7d)"
                  value={rep.meetings_per_day_7d_rolling}
                  sub={`${rep.meetings_30d} total 30d`}
                  unavailable={!gongAvailable}
                />
                <Metric
                  label="Opps Created (30d)"
                  value={rep.opps_created_30d}
                />
                <Metric
                  label="Pipeline Created (30d)"
                  value={fmt$(rep.pipeline_created_30d, { compact: true })}
                />
                <Metric
                  label="Win Rate (90d)"
                  value={fmtPct(rep.win_rate_90d_pct)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 text-xs text-gray-600">
        <span className="text-gray-500 font-medium">Win Rate</span> = deals closed won ÷ (deals closed won + deals closed lost), rolling 90 days.
      </div>
    </div>
  );
}
