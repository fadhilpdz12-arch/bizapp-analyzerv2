interface LedgerRow {
  label: string;
  value: number;
  sub?: string;
}

export default function LedgerBars({
  title,
  rows,
  valueSuffix = "",
  color = "accent",
  maxRows = 6,
}: {
  title: string;
  rows: LedgerRow[];
  valueSuffix?: string;
  color?: "accent" | "red" | "green" | "amber";
  maxRows?: number;
}) {
  const list = rows.slice(0, maxRows);
  const max = Math.max(...list.map((r) => r.value), 1);
  const barColor =
    color === "red" ? "bg-stamp-red" : color === "green" ? "bg-stamp-green" : color === "amber" ? "bg-stamp-amber" : "bg-accent";

  return (
    <div className="ticket p-5 sm:p-6 fade-up">
      <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50 mb-4">{title}</p>
      <div className="space-y-3.5">
        {list.map((row, i) => (
          <div key={row.label + i}>
            <div className="flex items-baseline justify-between gap-3 mb-1">
              <span className="text-[13px] text-content-100/90 truncate">{row.label}</span>
              <span className="font-mono text-[12px] text-content-300/70 shrink-0">
                {row.value}
                {valueSuffix}
                {row.sub && <span className="text-content-300/40 ml-1.5">· {row.sub}</span>}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-surface-700 overflow-hidden">
              <div
                className={`h-full rounded-full ${barColor}`}
                style={{ width: `${Math.max((row.value / max) * 100, 3)}%` }}
              />
            </div>
          </div>
        ))}
        {list.length === 0 && <p className="text-content-300/40 text-[13px]">Tiada data.</p>}
      </div>
    </div>
  );
}
