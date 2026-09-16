import CountUp from "./CountUp";

interface KpiTicketProps {
  eyebrow: string;
  value: string;
  sub?: string;
  accent?: "green" | "red" | "amber" | "accent";
  manifestNo: string;
  /** When provided, the figure animates up on load instead of rendering `value`. */
  count?: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
}

const ACCENT: Record<string, string> = {
  green: "text-stamp-green",
  red: "text-stamp-red",
  amber: "text-stamp-amber",
  accent: "text-accent",
};

export default function KpiTicket({
  eyebrow,
  value,
  sub,
  accent = "accent",
  manifestNo,
  count,
  prefix = "",
  suffix = "",
  decimals = 0,
}: KpiTicketProps) {
  // long currency figures overflow the ticket at the base size, so step down as they grow
  const size =
    value.length > 14
      ? "text-[1.3rem] min-[380px]:text-[1.15rem] sm:text-[1.65rem]"
      : value.length > 11
      ? "text-[1.6rem] min-[380px]:text-[1.3rem] sm:text-[2rem]"
      : value.length > 8
      ? "text-[1.9rem] min-[380px]:text-[1.45rem] sm:text-[2.3rem]"
      : "text-[2.2rem] min-[380px]:text-[1.8rem] sm:text-[2.6rem]";

  return (
    <div className="ticket px-5 py-4 sm:px-6 sm:py-5 fade-up">
      <div className="flex items-start justify-between">
        <span className="font-mono text-[10px] tracking-[0.2em] text-content-300/40 uppercase">
          {manifestNo}
        </span>
        <span className="barcode w-10 h-3 text-content-300/60" />
      </div>
      <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-content-300/55 mt-2.5 sm:mt-3">
        {eyebrow}
      </p>
      <p className={`font-display font-extrabold ${size} leading-none mt-1 whitespace-nowrap ${ACCENT[accent]}`}>
        {typeof count === "number" ? (
          <CountUp value={count} prefix={prefix} suffix={suffix} decimals={decimals} />
        ) : (
          value
        )}
      </p>
      {sub && <p className="text-[12px] sm:text-[12.5px] text-content-300/50 mt-2 leading-snug">{sub}</p>}
    </div>
  );
}
