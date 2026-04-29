import React, { useState, useEffect } from "react";
import { api } from "./lib/api";
import Vitals from "./sections/Vitals";
import CustomerTable from "./sections/CustomerTable";
import ClosedWonTrends from "./sections/ClosedWonTrends";
import PerRepPerformance from "./sections/PerRepPerformance";
import PipelineFunnel from "./sections/PipelineFunnel";
import LeadingIndicators from "./sections/LeadingIndicators";

const NAV = [
  { id: "vitals",    label: "Vitals" },
  { id: "customers", label: "Customers" },
  { id: "trends",    label: "Trends" },
  { id: "reps",      label: "Rep Performance" },
  { id: "pipeline",  label: "Pipeline" },
  { id: "leading",   label: "Leading Indicators" },
];

export default function App() {
  const [active, setActive] = useState("vitals");
  const [snapshotMeta, setSnapshotMeta] = useState(null);

  useEffect(() => {
    api.health().then(setSnapshotMeta).catch(() => {});
  }, []);

  const scrollTo = (id) => {
    setActive(id);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex min-h-screen bg-gray-950">
      <aside className="w-52 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col sticky top-0 h-screen">
        <div className="px-5 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-quinn-500 flex items-center justify-center text-white font-bold text-sm">Q</div>
            <div>
              <div className="text-sm font-semibold text-white">Quinn</div>
              <div className="text-xs text-gray-500">GTM Dashboard</div>
            </div>
          </div>
        </div>
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => scrollTo(n.id)}
              className={`w-full text-left px-5 py-2 text-sm transition-colors ${
                active === n.id
                  ? "text-quinn-300 bg-quinn-950/60 border-r-2 border-quinn-400"
                  : "text-gray-400 hover:text-gray-200 hover:bg-gray-800"
              }`}>
              {n.label}
            </button>
          ))}
        </nav>
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

      <main className="flex-1 overflow-x-hidden">
        <header className="sticky top-0 z-10 bg-gray-950/90 backdrop-blur border-b border-gray-800 px-8 py-3 flex items-center justify-between">
          <div className="text-sm text-gray-400">
            Quinn · Go-to-Market Dashboard · {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </div>
          <span className="text-xs text-gray-600">Daily snapshot @ 6am ET</span>
        </header>

        <div className="px-8 py-6 space-y-10">
          <section id="vitals" className="scroll-mt-16"><Vitals /></section>
          <section id="customers" className="scroll-mt-16"><CustomerTable /></section>
          <section id="trends" className="scroll-mt-16"><ClosedWonTrends /></section>
          <section id="reps" className="scroll-mt-16"><PerRepPerformance /></section>
          <section id="pipeline" className="scroll-mt-16"><PipelineFunnel /></section>
          <section id="leading" className="scroll-mt-16"><LeadingIndicators /></section>
        </div>
      </main>
    </div>
  );
}
