import { AgentStat } from "@/lib/types";

export default function ManifestTable({ agents }: { agents: AgentStat[] }) {
  return (
    <div className="ticket p-5 sm:p-6 fade-up overflow-x-auto scroll-hint">
      <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50 mb-4">
        Prestasi Ejen / Marketer
      </p>
      <table className="w-full text-[13px] min-w-[520px]">
        <thead>
          <tr className="text-content-300/40 font-mono text-[10px] uppercase tracking-wider border-b border-surface-600">
            <th className="text-left font-medium pb-2">Ejen</th>
            <th className="text-right font-medium pb-2">Order</th>
            <th className="text-right font-medium pb-2">Collected</th>
            <th className="text-right font-medium pb-2">Return</th>
            <th className="text-right font-medium pb-2">Return %</th>
            <th className="text-right font-medium pb-2">Revenue (RM)</th>
          </tr>
        </thead>
        <tbody>
          {agents.slice(0, 10).map((a, i) => (
            <tr key={a.agent + i} className="border-b border-surface-700/60 last:border-0">
              <td className="py-2.5 text-content-100/90 truncate max-w-[180px]">{a.agent}</td>
              <td className="py-2.5 text-right font-mono text-content-300/70">{a.totalOrders}</td>
              <td className="py-2.5 text-right font-mono text-stamp-green">{a.collected}</td>
              <td className="py-2.5 text-right font-mono text-stamp-red">{a.returned}</td>
              <td className="py-2.5 text-right font-mono text-content-300/70">{a.returnRate}%</td>
              <td className="py-2.5 text-right font-mono text-accent">{a.revenue.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {agents.length === 0 && <p className="text-content-300/40 text-[13px]">Tiada data ejen.</p>}
    </div>
  );
}
