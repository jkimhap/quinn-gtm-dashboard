import React, { useEffect, useState, useMemo } from "react";
import { api } from "../lib/api";
import { fmt$, fmtDate, fmtPct } from "../lib/format";

const TIER_META = {
  "1A": { cls: "badge badge-1a", label: "1A" },
  "1B": { cls: "badge badge-1b", label: "1B" },
  "2A": { cls: "badge badge-2a", label: "2A" },
  "2B": { cls: "badge badge-2b", label: "2B" },
  "3":  { cls: "badge badge-3",  label: "3"  },
};

const STATUS_META = {
  "active":   { cls: "badge badge-active",  label: "Active" },
  "at-risk":  { cls: "badge badge-at-risk", label: "At Risk" },
  "churned":  { cls: "badge badge-churned", label: "Churned" },
  "open":     { cls: "badge bg-gray-800 text-gray-400 border border-gray-700", label: "Open" },
};

function Unavailable() {
  return <span className="unavailable">⚠ no data</span>;
}

const COLS = [
  { key: "company",       label: "Company",         sortable: true },
  { key: "vertical",      label: "Vertical",        sortable: true },
  { key: "tier",          label: "Tier",            sortable: true },
  { key: "employees",     label: "Employees",       sortable: true },
  { key: "locations",     label: "Locations",       sortable: true },
  { key: "tcv",           label: "TCV",             sortable: true, note: "Total contract value" },
  { key: "arr",           label: "ARR",             sortable: true, note: "Annual — from hs_arr in HubSpot" },
  { key: "mrr",           label: "MRR",             sortable: true, note: "ARR ÷ 12" },
  { key: "contract_start",label: "Start",           sortable: true },
  { key: "contract_end",  label: "Renewal",         sortable: true },
  { key: "source",        label: "Source",          sortable: true },
  { key: "owner",         label: "Owner",           sortable: true },
  { key: "csm",           label: "CSM",             sortable: false },
  { key: "status",        label: "Status",          sortable: true },
  { key: "products",      label: "Products",        sortable: false },
];

export default function CustomerTable() {
  const [data, setData] = useState(null);
  const [allOwners, setAllOwners] = useState([]);
  const [allVerticals, setAllVerticals] = useState([]);
  const [err, setErr] = useState(null);
  const [search, setSearch] = useState("");
  const [filterVertical, setFilterVertical] = useState("");
  const [filterTier, setFilterTier] = useState("");
  const [filterOwner, setFilterOwner] = useState("");
  const [filterStatus, setFilterStatus] = useState("active,at-risk");
  const [sortKey, setSortKey] = useState("arr");
  const [sortDir, setSortDir] = useState("desc");

  // Fetch full unfiltered list once to populate dropdown options
  useEffect(() => {
    api.customers({ status: "active,at-risk,churned,open" }).then(res => {
      setAllOwners([...new Set((res.data || []).map(r => r.owner).filter(Boolean))].sort());
      setAllVerticals([...new Set((res.data || []).map(r => r.vertical).filter(Boolean))].sort());
    });
  }, []);

  useEffect(() => {
    setData(null);
    api.customers({ status: filterStatus, vertical: filterVertical || undefined,
                    tier: filterTier || undefined, owner: filterOwner || undefined,
                    q: search || undefined })
      .then(setData).catch(setErr);
  }, [search, filterVertical, filterTier, filterOwner, filterStatus]);

  const rows = useMemo(() => {
    if (!data?.data) return [];
    return [...data.data].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const verticals = allVerticals;
  const owners = allOwners;

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  };

  const exportUrl = api.customersExport({ status: filterStatus,
    vertical: filterVertical || undefined, tier: filterTier || undefined,
    owner: filterOwner || undefined, q: search || undefined });

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-white">Customer Master</h2>
        <div className="flex items-center gap-2">
          {data?.data && (
            <span className="text-xs text-gray-500">{rows.length} customers</span>
          )}
          <a href={exportUrl} download="quinn_customers.csv"
            className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded border border-gray-700 transition-colors">
            ↓ Export CSV
          </a>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Search company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-sm text-white placeholder-gray-500 rounded px-3 py-1.5 w-48 focus:outline-none focus:border-quinn-500"
        />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-quinn-500">
          <option value="active,at-risk">Active + At-Risk</option>
          <option value="active">Active</option>
          <option value="at-risk">At-Risk</option>
          <option value="churned">Churned</option>
          <option value="active,at-risk,churned,open">All</option>
        </select>
        <select value={filterVertical} onChange={e => setFilterVertical(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-quinn-500">
          <option value="">All Verticals</option>
          {verticals.map(v => <option key={v} value={v}>{v}</option>)}
        </select>
        <select value={filterTier} onChange={e => setFilterTier(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-quinn-500">
          <option value="">All Tiers</option>
          {["1A","1B","2A","2B","3"].map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterOwner} onChange={e => setFilterOwner(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-sm text-gray-300 rounded px-2 py-1.5 focus:outline-none focus:border-quinn-500">
          <option value="">All Owners</option>
          {owners.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Data quality + legend strip */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 mb-3 text-xs text-gray-500">
        {data?.data_quality && <>
          <span>Vertical coverage: <b className="text-gray-400">{data.data_quality.vertical_coverage}%</b></span>
          <span>ARR coverage: <b className="text-gray-400">{data.data_quality.arr_coverage}%</b></span>
          <span>Contract dates: <b className="text-gray-400">{data.data_quality.contract_dates_coverage}%</b></span>
          <span className="text-gray-600">·</span>
        </>}
        <span><span className="badge badge-active mr-1">Active</span>contract current</span>
        <span><span className="badge badge-at-risk mr-1">At Risk</span>renewal within 90 days</span>
        <span><span className="badge badge-churned mr-1">Churned</span>contract end date passed</span>
      </div>

      {err && <div className="text-red-400 text-sm mb-3">Error: {err.message}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800 bg-gray-900/80">
              {COLS.map(col => (
                <th key={col.key}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                  className={`px-3 py-2.5 text-left text-xs font-medium text-gray-400 whitespace-nowrap ${col.sortable ? "cursor-pointer select-none hover:text-gray-200" : ""} ${sortKey === col.key ? "text-quinn-300" : ""}`}>
                  {col.label}
                  {col.sortable && sortKey === col.key && (
                    <span className="ml-1">{sortDir === "asc" ? "↑" : "↓"}</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {!data ? (
              <tr><td colSpan={COLS.length} className="px-3 py-6 text-center text-gray-600">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={COLS.length} className="px-3 py-6 text-center text-gray-600">No customers found</td></tr>
            ) : rows.map((row, i) => (
              <tr key={row.deal_id || i}
                className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors">
                <td className="px-3 py-2.5 font-medium text-white whitespace-nowrap max-w-[200px] truncate">
                  {row.company || <Unavailable />}
                </td>
                <td className="px-3 py-2.5 text-gray-300 whitespace-nowrap">
                  {row.vertical || <Unavailable />}
                </td>
                <td className="px-3 py-2.5">
                  {row.tier && TIER_META[row.tier]
                    ? <span className={TIER_META[row.tier].cls}>{TIER_META[row.tier].label}</span>
                    : <Unavailable />}
                </td>
                <td className="px-3 py-2.5 text-gray-400 text-right tabular-nums">
                  {row.employees ? row.employees.toLocaleString() : "—"}
                </td>
                <td className="px-3 py-2.5 text-gray-400 text-right tabular-nums">
                  {row.locations ?? "—"}
                </td>
                <td className="px-3 py-2.5 text-white text-right tabular-nums font-medium">
                  {row.tcv ? fmt$(row.tcv, { compact: true }) : "—"}
                </td>
                <td className="px-3 py-2.5 text-white text-right tabular-nums font-medium">
                  {row.arr ? fmt$(row.arr, { compact: true }) : <Unavailable />}
                </td>
                <td className="px-3 py-2.5 text-gray-400 text-right tabular-nums">
                  {row.mrr ? fmt$(row.mrr, { compact: true }) : "—"}
                </td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                  {fmtDate(row.contract_start)}
                </td>
                <td className="px-3 py-2.5 text-gray-400 whitespace-nowrap">
                  {fmtDate(row.contract_end)}
                </td>
                <td className="px-3 py-2.5 text-gray-400 capitalize">
                  {row.source || "—"}
                </td>
                <td className="px-3 py-2.5 text-gray-300">
                  {row.owner || "—"}
                </td>
                <td className="px-3 py-2.5 text-gray-400">
                  {row.csm || "—"}
                </td>
                <td className="px-3 py-2.5">
                  {row.status && STATUS_META[row.status]
                    ? <span className={STATUS_META[row.status].cls}>{STATUS_META[row.status].label}</span>
                    : <span className="text-gray-600">—</span>}
                </td>
                <td className="px-3 py-2.5 text-gray-400 text-xs">
                  {row.products || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
