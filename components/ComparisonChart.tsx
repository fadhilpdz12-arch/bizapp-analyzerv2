"use client";

import { CHART, SERIES, TOOLTIP_STYLE, TOOLTIP_ITEM, tickStyle, tickStyleStrong } from "@/lib/chartTheme";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

interface Row {
  name: string;
  collected: number;
  returned: number;
  pending: number;
}

export default function ComparisonChart({ title, data }: { title: string; data: Row[] }) {
  return (
    <div className="ticket p-5 sm:p-6 fade-up">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">{title}</p>
        <span className="barcode w-14 h-3 text-content-300/40" />
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} horizontal={false} />
            <XAxis type="number" tick={tickStyle} axisLine={{ stroke: CHART.axisLine }} tickLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={tickStyleStrong}
              axisLine={false}
              tickLine={false}
              width={150}
            />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              itemStyle={TOOLTIP_ITEM}
              cursor={{ fill: CHART.cursor }}
            />
            <Legend wrapperStyle={{ fontSize: 11, fontFamily: "var(--font-mono)" }} />
            <Bar dataKey="collected" stackId="a" fill={SERIES.green} name="Collected" radius={[0, 0, 0, 0]} />
            <Bar dataKey="returned" stackId="a" fill={SERIES.red} name="Return" />
            <Bar dataKey="pending" stackId="a" fill={SERIES.amber} name="Pending" radius={[0, 2, 2, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
