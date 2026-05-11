import React, { useState, useEffect, useCallback } from "react";
import { api } from "./lib/api";
import Vitals from "./sections/Vitals";
import CustomerTable from "./sections/CustomerTable";
import ClosedWonTrends from "./sections/ClosedWonTrends";
import PerRepPerformance from "./sections/PerRepPerformance";
import PipelineFunnel from "./sections/PipelineFunnel";
import LeadingIndicators from "./sections/LeadingIndicators";
import CallIntelligence from "./sections/CallIntelligence";
import IcpSummary from "./sections/IcpSummary";
import ConversionFunnel from "./sections/ConversionFunnel";
import FirstCallTable from "./sections/FirstCallTable";
import DealSummary from "./sections/DealSummary";

// ── Navigation structure ───────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    group: "Vitals",
    items: [{ id: "vitals", label: "Vitals" }],
  },
  {
    group: "Go-to-Market",
    items: [
      { id: "trends",       label: "Trends" },
      { id: "icp",          label: "ICP Summary" },
      { id: "funnel",       label: "Conversion Funnel" },
      { id: "first-calls",  label: "First Calls" },
      { id: "deals",        label: "Deal Summary" },
      { id: "reps",         label: "Rep Performance" },
      { id: "pipeline",     label: "Pipeline" },
      { id: "leading",      label: "Leading Indicators" },
      { id: "calls",        label: "Call Intelligence" },
    ],
  },
  {
    group: "Customer Success",
    items: [{ id: "customers", label: "Customer Master" }],
  },
];

const ALL_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

export default function App() {
  const [active, setActive] = useState("vitals");
  const [snapshotMeta, setSnapshotMeta] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLabel, setRefreshLabel] = useState(null);

  const fetchHealth = useCallback(() => {
    api.health().then((d) => {
      setSnapshotMeta(d);
      setRefreshLabel(d.last_refresh || null);
      if (d.refresh_running) {
        // Poll every 5s while running
        setTimeout(fetchHealth, 5000);
      } else {
        setRefreshing(false);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const handleRefresh = () => {
    setRefreshing(true);
    api.refresh().then(() => {
      // Poll health every 5s to detect completion
      setTimeout(fetchHealth, 3000);
    }).catch(() => setRefreshing(false));
  };

  const scrollTo = (id) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Update active item on scroll
  useEffect(() => {
    const handler = () => {
      for (const item of [...ALL_ITEMS].reverse()) {
        const el = document.getElementById(item.id);
        if (el && el.getBoundingClientRect().top <= 100) {
          setActive(item.id);
          return;
        }
      }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <div className="flex min-h-screen bg-gray-950">
      {/* Sidebar */}
      <aside className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col sticky top-0 h-screen">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-quinn-500 flex items-center justify-center text-white font-bold text-sm">Q</div>
            <div>
              <div className="text-sm font-semibold text-white">Quinn</div>
              <div className="text-xs text-gray-500">GTM Dashboard</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_GROUPS.map(({ group, items }) => (
            <div key={group} className="mb-3">
              <div className="px-5 pb-1 text-[10px] font-semibold text-gray-600 uppercase tracking-widest">
                {group}
              </div>
              {items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => scrollTo(n.id)}
                  className={`w-full text-left px-5 py-1.5 text-sm transition-colors ${
                    active === n.id
                      ? "text-quinn-300 bg-quinn-950/60 border-r-2 border-quinn-400"
                      : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                  }`}
                >
                  {n.label}
                </button>
              ))}
            </div>
          ))}
        </nav>

        {/* Snapshot status */}
        <div className="px-5 py-4 border-t border-gray-800">
          {snapshotMeta ? (
            <div className="text-xs text-gray-500 space-y-1">
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${snapshotMeta.snapshots?.hubspot?.status === "ok" ? "bg-emerald-400" : "bg-amber-400"}`} />
                HubSpot {snapshotMeta.snapshots?.hubspot?.ran_at?.slice(0, 10) || "—"}
              </div>
              <div className="flex items-center gap-1">
                <span className={`w-1.5 h-1.5 rounded-full ${snapshotMeta.snapshots?.gong?.status === "ok" ? "bg-emerald-400" : "bg-gray-600"}`} />
                Gong {snapshotMeta.snapshots?.gong?.status === "skipped" ? "not configured" : snapshotMeta.snapshots?.gong?.ran_at?.slice(0, 10) || "—"}
              </div>
            </div>
          ) : (
            <div className="text-xs text-gray-600">Loading…</div>
          )}
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-x-hidden">
        {/* Header */}
        <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-8 py-3 flex items-center justify-between gap-4">
          <div className="text-sm text-gray-400 shrink-0">
            Quinn · Go-to-Market Dashboard · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
          <div className="flex items-center gap-4">
            {refreshLabel && (
              <span className="text-xs text-gray-600 hidden sm:block">
                Last refreshed {refreshLabel}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border transition-colors disabled:opacity-50 ${
                refreshing
                  ? "border-gray-700 text-gray-500 cursor-not-allowed"
                  : "border-gray-700 text-gray-400 hover:border-quinn-500 hover:text-quinn-300"
              }`}
            >
              {refreshing ? (
                <>
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                  </svg>
                  Refreshing…
                </>
              ) : (
                <>↺ Refresh Data</>
              )}
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="px-8 py-6 space-y-10">
          {/* VITALS */}
          <section id="vitals" className="scroll-mt-16"><Vitals /></section>

          {/* GO-TO-MARKET */}
          <div className="border-t border-gray-800 pt-8">
            <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-widest mb-6">Go-to-Market</div>
            <div className="space-y-10">
              <section id="trends" className="scroll-mt-16"><ClosedWonTrends /></section>
              <section id="icp" className="scroll-mt-16"><IcpSummary /></section>
              <section id="funnel" className="scroll-mt-16"><ConversionFunnel /></section>
              <section id="first-calls" className="scroll-mt-16"><FirstCallTable /></section>
              <section id="deals" className="scroll-mt-16"><DealSummary /></section>
              <section id="reps" className="scroll-mt-16"><PerRepPerformance /></section>
              <section id="pipeline" className="scroll-mt-16"><PipelineFunnel /></section>
              <section id="leading" className="scroll-mt-16"><LeadingIndicators /></section>
              <section id="calls" className="scroll-mt-16"><CallIntelligence /></section>
            </div>
          </div>

          {/* CUSTOMER SUCCESS */}
          <div className="border-t border-gray-800 pt-8">
            <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-widest mb-6">Customer Success</div>
            <section id="customers" className="scroll-mt-16"><CustomerTable /></section>
          </div>
        </div>
      </main>
    </div>
  );
}
