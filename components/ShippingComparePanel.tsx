"use client";

import { useState } from "react";
import { ShipTypeStat } from "@/lib/types";

export default function ShippingComparePanel({ stats }: { stats: ShipTypeStat[] }) {
  const [shift, setShift] = useState(30);
  if (!stats.length) return null;

  const cod = stats.find((s) => s.shipType === "COD Kurier");
  const prepaid = stats.find((s) => s.shipType === "Prepaid");

  // Moving orders from COD to prepaid only avoids the *excess* return risk that
  // COD carries over prepaid — not every return, since prepaid returns too.
  let saving = 0;
  let movedOrders = 0;
  if (cod && prepaid) {
    const excessRate = Math.max(0, cod.returnRate - prepaid.returnRate) / 100;
    movedOrders = Math.round((cod.totalOrders * shift) / 100);
    const avgValue = cod.totalOrders ? (cod.revenue + cod.lostToReturn) / cod.totalOrders : 0;
    saving = Math.round(movedOrders * excessRate * (avgValue + 16));
  }

  const maxRate = Math.max(...stats.map((s) => s.returnRate), 1);

  return (
    <div className="ticket p-5 sm:p-6 fade-up">
      <div className="flex items-center justify-between mb-5">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
          COD vs Prepaid — Risiko Return
        </p>
        <span className="barcode w-14 h-3 text-content-300/40" />
      </div>

      <div className="space-y-4 mb-6">
        {stats.map((s) => (
          <div key={s.shipType}>
            <div className="flex items-baseline justify-between gap-3 mb-1.5 flex-wrap">
              <span className="text-[14px] text-content-100">{s.shipType}</span>
              <span className="font-mono text-[12px] text-content-300/60">
                <span className={s.returnRate > 10 ? "text-stamp-red" : "text-stamp-green"}>
                  {s.returnRate}% return
                </span>
                <span className="text-content-300/35"> · {s.totalOrders} order · hilang RM{s.lostToReturn.toLocaleString()}</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
              <div
                className={`h-full rounded-full ${s.returnRate > 10 ? "bg-stamp-red" : "bg-stamp-green"}`}
                style={{ width: `${Math.max((s.returnRate / maxRate) * 100, 2)}%` }}
              />
            </div>
          </div>
        ))}
      </div>

      {cod && prepaid && (
        <div className="ticket-tear pt-5">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-content-300/45 mb-3">
            Simulasi — tukar sebahagian COD ke prepaid
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={shift}
              onChange={(e) => setShift(parseInt(e.target.value, 10))}
              className="flex-1 min-w-[180px] [accent-color:rgb(var(--accent))]"
              aria-label="Peratus order COD ditukar ke prepaid"
            />
            <span className="font-mono text-[13px] text-accent w-12 text-right">{shift}%</span>
          </div>
          <div className="mt-4 flex items-end justify-between gap-4 flex-wrap">
            <div>
              <p className="font-mono text-[10px] text-content-300/45 uppercase tracking-wider">
                Anggaran Jimat
              </p>
              <p className="font-display font-extrabold text-3xl text-stamp-green leading-none mt-1">
                RM {saving.toLocaleString()}
              </p>
            </div>
            <p className="text-[12px] text-content-300/45 max-w-[280px] leading-relaxed">
              {movedOrders.toLocaleString()} order dialih. Kiraan guna beza kadar return COD
              ({cod.returnRate}%) dengan prepaid ({prepaid.returnRate}%), campur kos kurier terbuang.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
