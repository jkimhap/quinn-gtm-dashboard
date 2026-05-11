import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

function Pct({ val }) {
  if (val == null) return <span className="text-gray-600">—</span>;
  const color = val >= 50 ? "text-emerald-600" : val >= 25 ? "text-amber-600" : "text-red-500";
  return <span className={`${color} tabular-nums`}>{val}%</span>;
}

export default function ConversionFunnel() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => { api.conversionFunnel().then(setData).catch(setErr); }, []);

  if (err) return <div className="card text-red-500 text-sm">Failed to load funnel: {err.message}</div>;

  const rows = data?.data || [];

  return (
    <div>
      <h2 className="text-lg font-serif font-medium text-gray-50 tracking-tight mb-1">Conversion Funnel</h2>
      <p className="text-xs text-gray-500 mb-4">
        Deals created each month and how far they've progressed. Percentages are cumulative (e.g. % won = won ÷ created).
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-gray-500 border-b border-gray-800">
              <th className="text-left pb-2 pr-4">Month</th>
              <th className="text-right pb-2 pr-4">Created</th>
              <th className="text-right pb-2 pr-4">
                <span className="text-blue-600">Discovery</span>
              </th>
              <th className="text-right pb-2 pr-4">
                <span className="text-purple-400">Demo / Quote</span>
              </th>
              <th className="text-right pb-2">
                <span className="text-emerald-600">Closed Won</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!data
              ? [1, 2, 3, 4, 5, 6].map((i) => (
                  <tr key={i} className="border-b border-gray-800/40">
                    {[1, 2, 3, 4, 5].map((j) => (
                      <td key={j} className="py-2 pr-4">
                        <div className="h-3.5 bg-gray-800/60 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              : rows.map((r) => (
                  <tr key={r.month} className="border-b border-gray-800/40 hover:bg-gray-800/20">
                    <td className="py-2 pr-4 font-medium text-gray-300">{r.label}</td>
                    <td className="py-2 pr-4 text-right text-gray-400 tabular-nums">{r.total}</td>
                    <td className="py-2 pr-4 text-right">
                      <Pct val={r.pct_mid} />
                      <span className="text-gray-600 ml-1">({r.mid})</span>
                    </td>
                    <td className="py-2 pr-4 text-right">
                      <Pct val={r.pct_late} />
                      <span className="text-gray-600 ml-1">({r.late})</span>
                    </td>
                    <td className="py-2 text-right">
                      <Pct val={r.pct_won} />
                      <span className="text-gray-600 ml-1">({r.won})</span>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        <p className="text-xs text-gray-600 mt-3">
          Stage buckets: Discovery = Discovery Complete; Demo/Quote = Demo Complete + Quote Sent + Verbal Commit.
        </p>
      </div>
    </div>
  );
}
