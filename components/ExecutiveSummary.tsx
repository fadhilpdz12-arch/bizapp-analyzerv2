import { SummaryPoint } from "@/lib/types";

const TONE: Record<string, { border: string; text: string; label: string }> = {
  bahaya: { border: "border-l-stamp-red", text: "text-stamp-red", label: "BAHAYA" },
  amaran: { border: "border-l-stamp-amber", text: "text-stamp-amber", label: "AMARAN" },
  baik: { border: "border-l-stamp-green", text: "text-stamp-green", label: "MAKLUMAT" },
};

export default function ExecutiveSummary({ points }: { points: SummaryPoint[] }) {
  if (!points.length) return null;
  return (
    <div className="ticket p-5 sm:p-6 fade-up">
      <div className="flex items-center justify-between mb-5">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
          Ringkasan Eksekutif
        </p>
        <span className="barcode w-14 h-3 text-content-300/40" />
      </div>
      <div className="space-y-4">
        {points.map((p, i) => {
          const t = TONE[p.tone] || TONE.baik;
          return (
            <div key={i} className={`border-l-2 ${t.border} pl-4 py-0.5`}>
              <div className="flex items-baseline gap-2.5 flex-wrap">
                <span className={`font-mono text-[9.5px] tracking-[0.18em] ${t.text}`}>{t.label}</span>
                <p className="text-[15px] text-content-100 font-medium">{p.headline}</p>
              </div>
              <p className="text-[13px] text-content-300/55 mt-1 leading-relaxed">{p.detail}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
