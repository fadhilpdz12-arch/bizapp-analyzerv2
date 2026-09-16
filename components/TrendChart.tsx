"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { DayTrend } from "@/lib/types";
import { CHART, TOOLTIP_STYLE, TOOLTIP_ITEM, tickStyle, useAccent, tooltipLabel } from "@/lib/chartTheme";

/** Axis labels shorten to 12k / 1.2j so wide RM figures stay legible. */
function compactRM(v: number): string {
  if (!Number.isFinite(v)) return "";
  if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}j`;
  if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}k`;
  return String(v);
}

export default function TrendChart({ data }: { data: DayTrend[] }) {
  const accent = useAccent();
  const short = data.map((d) => ({ ...d, label: d.date.slice(5) }));
  return (
    <div className="ticket p-5 sm:p-6 fade-up">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
          Trend Harian — Jualan Collected (RM)
        </p>
        <span className="barcode w-14 h-3 text-content-300/40" />
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={short} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity={0.28} />
                <stop offset="100%" stopColor={accent} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} vertical={false} />
            <XAxis
              dataKey="label"
              tick={tickStyle}
              axisLine={{ stroke: CHART.axisLine }}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={tickStyle}
              axisLine={false}
              tickLine={false}
              width={54}
              tickFormatter={compactRM}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              labelStyle={tooltipLabel(accent)}
              itemStyle={TOOLTIP_ITEM}
              formatter={(v: number) => [`RM ${v.toLocaleString()}`, "Revenue"]}
            />
            <Area type="monotone" dataKey="revenue" stroke={accent} strokeWidth={2} fill="url(#revGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
