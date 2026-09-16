import { AgentQuality } from "@/lib/types";

const GRADE_COLOR: Record<string, string> = {
  A: "text-stamp-green border-stamp-green",
  B: "text-accent border-accent",
  C: "text-stamp-amber border-stamp-amber",
  D: "text-stamp-red border-stamp-red",
};

export default function AgentQualityPanel({ rows }: { rows: AgentQuality[] }) {
  if (!rows.length) return null;
  return (
    <div className="ticket p-5 sm:p-6 fade-up">
      <div className="flex items-center justify-between mb-2">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
          Scorecard Kualiti Ejen
        </p>
        <span className="barcode w-14 h-3 text-content-300/40" />
      </div>
      <p className="text-[12.5px] text-content-300/50 mb-5 max-w-lg leading-relaxed">
        Dinilai ikut kualiti order (kadar return), bukan volume. Ejen yang banyak order tapi
        tinggi return sebenarnya membakar duit.
      </p>

      <div className="overflow-x-auto scroll-hint">
        <table className="w-full text-[12.5px] min-w-[560px]">
          <thead>
            <tr className="text-content-300/40 font-mono text-[9.5px] uppercase tracking-wider border-b border-surface-600">
              <th className="text-left font-medium pb-2">Gred</th>
              <th className="text-left font-medium pb-2">Ejen</th>
              <th className="text-right font-medium pb-2">Skor</th>
              <th className="text-right font-medium pb-2">Order</th>
              <th className="text-right font-medium pb-2">Return %</th>
              <th className="text-right font-medium pb-2">COD %</th>
              <th className="text-right font-medium pb-2">Revenue (RM)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.agent + i} className="border-b border-surface-700/60 last:border-0">
                <td className="py-2.5">
                  <span
                    className={`inline-flex items-center justify-center w-6 h-6 border rounded-sm font-mono text-[11px] font-semibold ${
                      GRADE_COLOR[r.grade]
                    }`}
                  >
                    {r.grade}
                  </span>
                </td>
                <td className="py-2.5 text-content-100/90 truncate max-w-[170px]">{r.agent}</td>
                <td className="py-2.5 text-right font-mono text-content-100/80">{r.qualityScore}</td>
                <td className="py-2.5 text-right font-mono text-content-300/60">{r.totalOrders}</td>
                <td
                  className={`py-2.5 text-right font-mono ${
                    r.returnRate > 15 ? "text-stamp-red" : "text-content-300/70"
                  }`}
                >
                  {r.returnRate}%
                </td>
                <td className="py-2.5 text-right font-mono text-content-300/60">{r.codShare}%</td>
                <td className="py-2.5 text-right font-mono text-accent">{r.revenue.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
