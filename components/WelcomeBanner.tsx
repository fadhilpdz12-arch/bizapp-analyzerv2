"use client";

import { useEffect, useMemo, useState } from "react";
import { greeting, quoteOfTheMoment, funFact } from "@/lib/motivation";
import { Analytics } from "@/lib/types";
import CountUp from "./CountUp";

export default function WelcomeBanner({
  analytics,
  orderCount,
  processMs,
}: {
  analytics: Analytics;
  orderCount: number;
  processMs: number;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const hi = useMemo(() => greeting(), [mounted]);
  const quote = useMemo(() => quoteOfTheMoment(), [mounted]);

  const risk = analytics.riskParcels ?? [];
  const rescueValue = risk.reduce((s, r) => s + (r.amount || 0), 0);
  const critical = risk.filter((r) => r.severity === "kritikal").length;

  const scrollToRisk = () => {
    const el = document.getElementById("parcel-berisiko");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!mounted) return null;

  return (
    <section className="space-y-4 fade-up">
      {/* Greeting + quote */}
      <div className="ticket px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="min-w-0">
            <p className="font-display font-bold text-[1.35rem] sm:text-2xl text-content-100 leading-tight">
              {hi.hello}, Nurul.
            </p>
            <p className="text-content-300/55 text-[13px] sm:text-[14px] mt-0.5">
              {funFact(orderCount, processMs)}
            </p>
          </div>
          <span className="barcode w-16 h-4 text-content-300/40 shrink-0 hidden sm:block" />
        </div>

        <div className="ticket-tear mt-4 pt-3">
          <p className="text-content-100/75 text-[13px] sm:text-[14px] italic leading-relaxed">
            &ldquo;{quote.text}&rdquo;
          </p>
        </div>
      </div>

      {/* Quick win — the reason to open this every morning */}
      {risk.length > 0 && (
        <button
          onClick={scrollToRisk}
          className="w-full text-left ticket px-5 py-4 sm:px-6 sm:py-5 border-stamp-amber/40 hover:border-stamp-amber/70 transition-colors group"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 shrink-0 rounded-full border-2 border-stamp-amber/50 flex items-center justify-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-stamp-amber">
                <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-stamp-amber mb-1.5">
                Tindakan Hari Ini
              </p>
              <p className="font-display font-bold text-[1.4rem] sm:text-[1.7rem] text-content-100 leading-tight">
                <CountUp value={risk.length} /> parcel tergendala
              </p>
              {critical > 0 && (
                <p className="text-stamp-red text-[13px] sm:text-[14px] font-semibold mt-0.5">
                  {critical} daripadanya kritikal
                </p>
              )}
              <p className="text-content-300/60 text-[13px] sm:text-[14px] mt-1.5 leading-relaxed">
                Bernilai <span className="text-accent font-semibold">RM {rescueValue.toLocaleString()}</span>.
                Hubungi customer sekarang sebelum jadi return.
              </p>
              <p className="font-mono text-[11px] text-stamp-amber/80 mt-2.5 group-hover:text-stamp-amber transition-colors">
                Lihat senarai →
              </p>
            </div>
          </div>
        </button>
      )}
    </section>
  );
}
