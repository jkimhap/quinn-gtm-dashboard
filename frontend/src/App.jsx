import React, { useState, useEffect, useCallback, useRef } from "react";
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

// ── Tab definitions ────────────────────────────────────────────────────────────
const TABS = [
  { id: "vitals", label: "Vitals" },
  { id: "gtm",    label: "Go-to-Market" },
  { id: "cs",     label: "Customer Success" },
];

const GTM_SECTIONS = [
  { id: "trends",      label: "Trends" },
  { id: "icp",         label: "ICP Summary" },
  { id: "funnel",      label: "Conversion Funnel" },
  { id: "first-calls", label: "First Calls" },
  { id: "deals",       label: "Deal Summary" },
  { id: "reps",        label: "Rep Performance" },
  { id: "pipeline",    label: "Pipeline" },
  { id: "leading",     label: "Leading Indicators" },
  { id: "calls",       label: "Call Intelligence" },
];

export default function App() {
  const [tab, setTab] = useState("vitals");
  const [activeSection, setActiveSection] = useState("trends");
  const [snapshotMeta, setSnapshotMeta] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshLabel, setRefreshLabel] = useState(null);
  const mainRef = useRef(null);

  // ── Health polling ────────────────────────────────────────────────────────
  const fetchHealth = useCallback(() => {
    api.health().then((d) => {
      setSnapshotMeta(d);
      setRefreshLabel(d.last_refresh || null);
      if (d.refresh_running) {
        setTimeout(fetchHealth, 5000);
      } else {
        setRefreshing(false);
      }
    }).catch(() => {});
  }, []);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);

  const handleRefresh = () => {
    setRefreshing(true);
    api.refresh().then(() => setTimeout(fetchHealth, 3000)).catch(() => setRefreshing(false));
  };

  // ── Tab switch: scroll main panel back to top ─────────────────────────────
  const switchTab = (id) => {
    setTab(id);
    if (id === "gtm") setActiveSection("trends");
    if (mainRef.current) mainRef.current.scrollTop = 0;
  };

  // ── GTM sub-section scroll nav ────────────────────────────────────────────
  const scrollToSection = (id) => {
    setActiveSection(id);
    const el = document.getElementById(id);
    if (el && mainRef.current) {
      const offset = el.offsetTop - 72; // account for sticky header
      mainRef.current.scrollTo({ top: offset, behavior: "smooth" });
    }
  };

  // Track which GTM section is in view
  useEffect(() => {
    if (tab !== "gtm") return;
    const container = mainRef.current;
    if (!container) return;
    const handler = () => {
      for (const sec of [...GTM_SECTIONS].reverse()) {
        const el = document.getElementById(sec.id);
        if (el && el.getBoundingClientRect().top <= 110) {
          setActiveSection(sec.id);
          return;
        }
      }
    };
    container.addEventListener("scroll", handler, { passive: true });
    return () => container.removeEventListener("scroll", handler);
  }, [tab]);

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
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

        {/* Top-level tabs */}
        <nav className="flex-1 overflow-y-auto py-3">
          {TABS.map((t) => (
            <div key={t.id}>
              <button
                onClick={() => switchTab(t.id)}
                className={`w-full text-left px-5 py-2.5 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? "text-quinn-300 bg-quinn-950/60 border-r-2 border-quinn-400"
                    : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
                }`}
              >
                {t.label}
              </button>

              {/* GTM sub-sections — only shown when GTM tab is active */}
              {t.id === "gtm" && tab === "gtm" && (
                <div className="ml-3 border-l border-gray-800 mb-1">
                  {GTM_SECTIONS.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => scrollToSection(s.id)}
                      className={`w-full text-left pl-4 pr-3 py-1.5 text-xs transition-colors ${
                        activeSection === s.id
                          ? "text-quinn-300 border-l-2 border-quinn-400 -ml-px"
                          : "text-gray-500 hover:text-gray-300"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
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

      {/* ── Main panel ──────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-8 py-3 flex items-center justify-between gap-4">
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

        {/* Scrollable content — isolated per tab */}
        <main ref={mainRef} className="flex-1 overflow-y-auto overflow-x-hidden">
          <div className="px-8 py-6">

            {/* ── VITALS ── */}
            {tab === "vitals" && (
              <Vitals />
            )}

            {/* ── GO-TO-MARKET ── */}
            {tab === "gtm" && (
              <div className="space-y-10">
                <section id="trends"><ClosedWonTrends /></section>
                <section id="icp"><IcpSummary /></section>
                <section id="funnel"><ConversionFunnel /></section>
                <section id="first-calls"><FirstCallTable /></section>
                <section id="deals"><DealSummary /></section>
                <section id="reps"><PerRepPerformance /></section>
                <section id="pipeline"><PipelineFunnel /></section>
                <section id="leading"><LeadingIndicators /></section>
                <section id="calls"><CallIntelligence /></section>
              </div>
            )}

            {/* ── CUSTOMER SUCCESS ── */}
            {tab === "cs" && (
              <CustomerTable />
            )}

          </div>
        </main>
      </div>
    </div>
  );
}
