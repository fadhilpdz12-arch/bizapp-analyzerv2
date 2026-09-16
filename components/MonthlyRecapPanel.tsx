"use client";

import { useState } from "react";
import { MonthlyRecap } from "@/lib/types";
import StampBadge from "./StampBadge";

export default function MonthlyRecapPanel({ recaps }: { recaps: MonthlyRecap[] }) {
  const [active, setActive] = useState(0);
  if (recaps.length === 0) return null;
  const recap = recaps[active];

  return (
    <div className="ticket p-5 sm:p-6 fade-up">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/70 font-semibold">
          Recap Bulanan
        </p>
        <div className="flex gap-2">
          {recaps.map((r, i) => (
            <button
              key={r.monthKey}
              onClick={() => setActive(i)}
              className={`font-mono text-[11px] uppercase tracking-wider px-3 py-1.5 rounded-sm border transition-colors font-semibold ${
                i === active
                  ? "border-accent text-accent bg-accent/10"
                  : "border-surface-600 text-content-300/70 hover:text-content-100 hover:border-surface-500"
              }`}
            >
              {r.monthLabel}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto scroll-hint">
        <table className="w-full text-[14px] min-w-[480px]">
        <thead>
          <tr className="text-content-100/80 font-mono text-[10.5px] font-bold uppercase tracking-wider border-b-2 border-surface-500">
            <th className="text-left pb-2">Status</th>
            <th className="text-right pb-2">Order</th>
            <th className="text-right pb-2">Total (RM)</th>
            <th className="text-right pb-2">Purata RM/Order</th>
            <th className="text-right pb-2">% Per Parcel</th>
            <th className="text-right pb-2">% Per Sales</th>
          </tr>
        </thead>
        <tbody>
          {recap.rows.map((row) => (
            <tr key={row.status} className="border-b border-surface-700 last:border-0">
              <td className="py-2.5">
                <StampBadge status={row.status} />
              </td>
              <td className="py-2.5 text-right font-mono font-semibold text-content-100">{row.count}</td>
              <td className="py-2.5 text-right font-mono font-bold text-content-100">
                {row.totalAmount.toLocaleString()}
              </td>
              <td className="py-2.5 text-right font-mono font-semibold text-content-100">
                {row.avgPerOrder.toLocaleString()}
              </td>
              <td className="py-2.5 text-right font-mono font-bold text-accent">{row.pctOfMonthOrders}%</td>
              <td className="py-2.5 text-right font-mono font-bold text-accent">{row.pctOfMonthSales}%</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="ticket-tear">
            <td className="pt-3 font-mono text-[11.5px] font-bold text-content-100/90 uppercase">
              Jumlah — {recap.totalOrders} order
            </td>
            <td colSpan={4}></td>
            <td className="pt-3 text-right font-display font-bold text-lg text-content-100">
              RM {recap.totalSales.toLocaleString()}
            </td>
          </tr>
        </tfoot>
        </table>
      </div>

      {recap.courierReturns.length > 0 && (
        <div className="ticket-tear pt-5 mt-5">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-content-100/80 font-bold mb-3">
            Pecahan Return Ikut Kurier
          </p>

          <div className="overflow-x-auto scroll-hint">
            <table className="w-full text-[14px] min-w-[420px]">
              <thead>
                <tr className="text-content-100/80 font-mono text-[10.5px] font-bold uppercase tracking-wider border-b-2 border-surface-500">
                  <th className="text-left pb-2">Kurier</th>
                  <th className="text-right pb-2">Return (Parcel)</th>
                  <th className="text-right pb-2">Return (RM)</th>
                  <th className="text-right pb-2">% Per Parcel</th>
                  <th className="text-right pb-2">% Per Sales</th>
                </tr>
              </thead>
              <tbody>
                {recap.courierReturns.map((c) => (
                  <tr key={c.courier} className="border-b border-surface-700 last:border-0">
                    <td className="py-2.5 font-semibold text-content-100">{c.courier}</td>
                    <td className="py-2.5 text-right font-mono font-semibold text-content-100">{c.returnCount}</td>
                    <td className="py-2.5 text-right font-mono font-bold text-content-100">
                      {c.returnAmount.toLocaleString()}
                    </td>
                    <td className="py-2.5 text-right font-mono font-bold text-stamp-red">{c.pctReturnParcel}%</td>
                    <td className="py-2.5 text-right font-mono font-bold text-stamp-red">{c.pctReturnSales}%</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td className="pt-3 font-mono text-[11.5px] font-bold text-content-100/90 uppercase">
                    Jumlah Return — {recap.totalReturnCount} parcel
                  </td>
                  <td colSpan={2}></td>
                  <td colSpan={2} className="pt-3 text-right font-display font-bold text-content-100">
                    RM {recap.totalReturnAmount.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {recap.dominantReturnCourier && (
            <p className="text-[13px] font-medium text-content-100/85 mt-3 leading-relaxed">
              Majoriti return bulan ini datang dari{" "}
              <span className="text-stamp-red font-bold">{recap.dominantReturnCourier}</span> —{" "}
              <span className="font-bold text-content-100">{recap.courierReturns[0].pctReturnParcel}%</span>{" "}
              daripada jumlah parcel return{" "}
              (<span className="font-bold text-content-100">{recap.courierReturns[0].pctReturnSales}%</span>{" "}
              daripada nilai RM return).
            </p>
          )}
        </div>
      )}
    </div>
  );
}
