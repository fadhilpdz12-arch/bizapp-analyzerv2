import { Projection } from "@/lib/types";

export default function ProjectionTicket({ projection }: { projection: Projection }) {
  const dirColor =
    projection.trendDirection === "up" ? "text-stamp-green" : projection.trendDirection === "down" ? "text-stamp-red" : "text-stamp-amber";
  const dirArrow = projection.trendDirection === "up" ? "▲" : projection.trendDirection === "down" ? "▼" : "▬";
  const dirLabel =
    projection.trendDirection === "up" ? "Trend menaik" : projection.trendDirection === "down" ? "Trend menurun" : "Trend stabil";

  return (
    <div className="ticket p-5 sm:p-6 fade-up">
      <div className="flex items-center justify-between mb-4">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
          Unjuran Jualan
        </p>
        <span className={`stamp text-[10px] ${dirColor}`}>
          {dirArrow} {dirLabel} {projection.trendPct !== 0 ? `${projection.trendPct > 0 ? "+" : ""}${projection.trendPct}%` : ""}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <p className="font-mono text-[10px] text-content-300/45 uppercase tracking-wider">7 Hari Akan Datang</p>
          <p className="font-display font-extrabold text-3xl text-content-100 mt-1">
            RM {projection.next7DaysRevenue.toLocaleString()}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] text-content-300/45 uppercase tracking-wider">30 Hari Akan Datang</p>
          <p className="font-display font-extrabold text-3xl text-content-100 mt-1">
            RM {projection.next30DaysRevenue.toLocaleString()}
          </p>
        </div>
      </div>

      <div className="ticket-tear mt-5 pt-4 flex items-center justify-between">
        <p className="text-[11.5px] text-content-300/45">{projection.method}</p>
        <p className="font-mono text-[11px] text-content-300/60">
          Purata/hari: <span className="text-accent">RM {projection.dailyAvgRevenue.toLocaleString()}</span>
        </p>
      </div>
    </div>
  );
}
