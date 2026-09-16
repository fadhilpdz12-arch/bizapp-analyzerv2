"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { MonthComparisonRow, MonthMaturity } from "@/lib/types";
import {
  CHART,
  TOOLTIP_STYLE,
  TOOLTIP_ITEM,
  tickStyle,
  tickStyleStrong,
  useAccent,
} from "@/lib/chartTheme";

/** Axis labels shorten to 12k / 1.2j so wide RM figures stay legible. */
function compactRM(v: number): string {
  if (!Number.isFinite(v)) return "";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}j`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

export default function MonthComparisonPanel({
  rows,
  maturity,
}: {
  rows: MonthComparisonRow[];
  maturity: MonthMaturity[];
}) {
  // Hooks must run before any early return.
  const accent = useAccent();
  if (rows.length === 0) return null;

  const matOf = (key: string) => maturity.find((m) => m.monthKey === key);
  const immature = maturity.filter((m) => !m.isMature);

  const chartData = rows.map((r) => ({
    name: r.monthLabel.split(" ")[0],
    revenue: r.revenueCollected,
    mature: matOf(r.monthKey)?.isMature ?? true,
  }));

  return (
    <div className="space-y-4">
      {immature.length > 0 && (
        <div className="border border-stamp-amber/40 bg-stamp-amber/10 px-4 py-3 rounded-sm fade-up">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-stamp-amber mb-1">
            Amaran Tafsiran
          </p>
          <p className="text-[13px] text-content-100/85 leading-relaxed">
            {immature.map((m) => `${m.monthLabel} baru ${m.resolvedPct}% selesai`).join("; ")}. Bulan
            ini belum matang — banyak parcel masih dalam perjalanan, jadi revenue akan nampak rendah
            walaupun jualan sebenar mungkin sihat. Jangan buat keputusan berdasarkan penurunan ini.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 ticket p-6 fade-up">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50 mb-4">
          Revenue Collected — Bulan ke Bulan
        </p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} vertical={false} />
              <XAxis dataKey="name" tick={tickStyleStrong} axisLine={{ stroke: CHART.axisLine }} tickLine={false} />
              <YAxis tick={tickStyle} axisLine={false} tickLine={false} width={54} tickFormatter={compactRM} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                itemStyle={TOOLTIP_ITEM}
                formatter={(v: number) => [`RM ${v.toLocaleString()}`, "Revenue"]}
                cursor={{ fill: CHART.cursor }}
              />
              <Bar dataKey="revenue" fill={accent} radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="lg:col-span-2 ticket p-5 sm:p-6 fade-up overflow-x-auto scroll-hint">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50 mb-4">
          Ringkasan Bulanan
        </p>
        <table className="w-full text-[12.5px] min-w-[220px]">
          <thead>
            <tr className="text-content-300/40 font-mono text-[9.5px] uppercase tracking-wider border-b border-surface-600">
              <th className="text-left font-medium pb-2">Bulan</th>
              <th className="text-right font-medium pb-2">Return %</th>
              <th className="text-right font-medium pb-2">MoM</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const mat = matOf(r.monthKey);
              const incomplete = mat && !mat.isMature;
              return (
                <tr key={r.monthKey} className="border-b border-surface-700/60 last:border-0">
                  <td className="py-2.5 text-content-100/90">
                    {r.monthLabel}
                    {incomplete && (
                      <span
                        className="ml-2 font-mono text-[9px] text-stamp-amber border border-stamp-amber/40 rounded-sm px-1 py-0.5"
                        title={`Baru ${mat!.resolvedPct}% parcel selesai`}
                      >
                        BELUM MATANG
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-right font-mono text-stamp-red">{r.returnRate}%</td>
                  <td className="py-2.5 text-right font-mono">
                    {r.momRevenueChangePct === null ? (
                      <span className="text-content-300/30">—</span>
                    ) : incomplete ? (
                      <span className="text-content-300/35" title="Bulan belum matang — perbandingan tidak sah lagi">
                        n/a
                      </span>
                    ) : (
                      <span className={r.momRevenueChangePct >= 0 ? "text-stamp-green" : "text-stamp-red"}>
                        {r.momRevenueChangePct >= 0 ? "▲" : "▼"} {Math.abs(r.momRevenueChangePct)}%
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  );
}
