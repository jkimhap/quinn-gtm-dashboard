import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { fmt$, fmtDate } from "../lib/format";

export default function MultiLocationExpansion() {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [sort, setSort] = useState({ key: "whitespace", dir: "desc" });

  useEffect(() => {
    api.locations().then(setData).catch(setErr);
  }, []);

  const rows = (() => {
    if (!data?.data) return [];
    return [...data.data].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sort.dir === "asc" ? cmp : -cmp;
    });
  })();

  const handleSort = (key) => {
    setSort(s => s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" });
  };

  const COLS = [
    { key: "company",           label: "Company" },
    { key: "vertical",          label: "Vertical" },
    { key: "total_locations",   label: "Total Locations" },
    { key: "sold_to_locations", label: "Sold To" },
    { key: "whitespace",        label: "Whitespace" },
    { key: "arr",               label: "ARR" },
    { key: "owner",             label: "Owner" },
    { key: "contract_end",      label: "Renewal" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-serif font-medium text-gray-50 tracking-tight">Multi-Location Expansion</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Customers with multiple locations — sort by Whitespace to find fastest upsell candidates
          </p>
        </div>
      </div>

      {err && <div className="text-red-500 text-sm mb-3">Error: {err.message}</div>}

      {data && !data.data_available && (
        <div className="card text-center py-8">
          <span className="unavailable text-sm">⚠ {data.note || "num_locations not populated in HubSpot"}</span>
          <p className="text-xs text-gray-600 mt-2">
            Ask Arlen/ops to populate the <code className="bg-gray-800 px-1 rounded">num_locations</code> field on company records in HubSpot.
          </p>
        </div>
      )}

      {data?.data_available && (
        <div className="overflow-x-auto rounded-xl border border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 bg-gray-900/80">
                {COLS.map(col => (
                  <th key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-3 py-2.5 text-left text-xs font-medium cursor-pointer select-none whitespace-nowrap hover:text-gray-200 ${sort.key === col.key ? "text-quinn-600" : "text-gray-400"}`}>
                    {col.label}
                    {sort.key === col.key && <span className="ml-1">{sort.dir === "asc" ? "↑" : "↓"}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-b border-gray-800/50 hover:bg-gray-800/20">
                  <td className="px-3 py-2.5 font-medium text-gray-50">{row.company}</td>
                  <td className="px-3 py-2.5 text-gray-400">{row.vertical || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-300 tabular-nums text-right">{row.total_locations ?? "—"}</td>
                  <td className="px-3 py-2.5 text-gray-300 tabular-nums text-right">{row.sold_to_locations ?? "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">
                    <span className={`font-semibold ${(row.whitespace || 0) > 5 ? "text-emerald-600" : (row.whitespace || 0) > 2 ? "text-amber-600" : "text-gray-400"}`}>
                      {row.whitespace ?? "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-gray-50 font-medium tabular-nums text-right">
                    {row.arr ? fmt$(row.arr, { compact: true }) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-gray-400">{row.owner || "—"}</td>
                  <td className="px-3 py-2.5 text-gray-400">{fmtDate(row.contract_end)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!data && !err && <div className="text-gray-600 text-sm">Loading…</div>}
    </div>
  );
}
