"use client";

import { useEffect, useState } from "react";
import { Analytics } from "@/lib/types";
import CountUp from "./CountUp";

/**
 * A fullscreen board of headline figures, sized to be readable from across a
 * meeting room. Arrow keys or auto-advance move between slides.
 */
export default function PresentMode({
  analytics,
  onClose,
}: {
  analytics: Analytics;
  onClose: () => void;
}) {
  const a = analytics;
  const [slide, setSlide] = useState(0);
  const [auto, setAuto] = useState(true);

  const ret = a.statusBreakdown.find((s) => s.status === "RETURN");
  const cod = a.shipTypes?.find((s) => s.shipType === "COD Kurier");
  const prepaid = a.shipTypes?.find((s) => s.shipType === "Prepaid");

  const slides = [
    {
      eyebrow: "Jumlah Jualan Terkumpul",
      value: a.totalRevenueCollected,
      money: true,
      note: `${a.totalOrders.toLocaleString()} order diproses`,
      tone: "text-content-100",
    },
    {
      eyebrow: "Kadar Return",
      value: ret?.pct ?? 0,
      suffix: "%",
      decimals: 1,
      note: `${(ret?.count ?? 0).toLocaleString()} parcel dipulangkan`,
      tone: "text-stamp-red",
    },
    {
      eyebrow: "Kerugian Sebab Return",
      value: a.moneyLost?.totalWithShipping ?? 0,
      money: true,
      note: "Nilai barang + kos kurier dua hala",
      tone: "text-stamp-red",
    },
    {
      eyebrow: "COD vs Prepaid — Kadar Return",
      value: cod?.returnRate ?? 0,
      suffix: "%",
      decimals: 1,
      note: `COD berbanding prepaid ${prepaid?.returnRate ?? 0}% — beza yang perlu ditangani`,
      tone: "text-stamp-amber",
    },
    {
      eyebrow: "Parcel Boleh Diselamatkan",
      value: a.riskParcels?.length ?? 0,
      note: `Bernilai RM ${(a.riskParcels ?? [])
        .reduce((s, r) => s + (r.amount || 0), 0)
        .toLocaleString()} — masih boleh dikejar`,
      tone: "text-stamp-green",
    },
  ];

  const total = slides.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") {
        setAuto(false);
        setSlide((s) => (s + 1) % total);
      }
      if (e.key === "ArrowLeft") {
        setAuto(false);
        setSlide((s) => (s - 1 + total) % total);
      }
      if (e.key === " ") {
        e.preventDefault();
        setAuto((x) => !x);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, total]);

  useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % total), 6000);
    return () => clearInterval(t);
  }, [auto, total]);

  const s = slides[slide];

  return (
    <div className="fixed inset-0 z-[70] bg-surface-950 flex flex-col no-print">
      <div className="flex items-center justify-between px-6 py-4 border-b border-surface-600">
        <p className="font-mono text-[10px] tracking-[0.3em] uppercase text-accent">
          Bizapp Analyzer
        </p>
        <div className="flex items-center gap-2">
          <button onClick={() => setAuto((x) => !x)} className="btn-soft">
            {auto ? "Jeda" : "Main"}
          </button>
          <button onClick={onClose} className="btn-soft">Tutup (Esc)</button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <p
          key={`e${slide}`}
          className="font-mono text-[11px] sm:text-[13px] tracking-[0.32em] uppercase text-content-300/70 fade-up"
        >
          {s.eyebrow}
        </p>
        <p
          key={`v${slide}`}
          className={`font-display font-extrabold leading-none mt-5 fade-up ${s.tone}`}
          style={{ fontSize: "clamp(3.5rem, 15vw, 11rem)" }}
        >
          <CountUp
            value={s.value}
            prefix={s.money ? "RM " : ""}
            suffix={s.suffix ?? ""}
            decimals={s.decimals ?? 0}
            duration={1100}
          />
        </p>
        <p
          key={`n${slide}`}
          className="text-content-300 text-[14px] sm:text-[18px] mt-6 max-w-[42ch] fade-up"
        >
          {s.note}
        </p>
      </div>

      <div className="flex items-center justify-center gap-2.5 pb-8">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setAuto(false);
              setSlide(i);
            }}
            aria-label={`Slaid ${i + 1}`}
            className={`h-1.5 rounded-full transition-all ${
              i === slide ? "w-8 bg-accent" : "w-1.5 bg-surface-500"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
