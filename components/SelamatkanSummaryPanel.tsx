"use client";

import { useEffect, useMemo, useState } from "react";

import { RiskParcel } from "@/lib/types";

import {
  RiskRecord,
  RiskStatus,
  loadRisk,
  riskKey,
  summariseRisk,
} from "@/lib/riskFollowup";

import {
  CauseRecord,
  causeKey,
  loadCauseMap,
} from "@/lib/returnCause";

import CountUp from "./CountUp";

function rm(n: number) {
  return `RM ${Math.round(n).toLocaleString()}`;
}

function fmtDate(iso?: string) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_STYLE: Record<RiskStatus, string> = {
  "Belum Hubungi": "text-content-300 border-surface-500 bg-surface-700",
  "Confirmation Reply": "text-stamp-green border-stamp-green/40 bg-stamp-green/10",
  "Confirmation Tidak Reply": "text-stamp-amber border-stamp-amber/40 bg-stamp-amber/10",
  "Dah Hubungi — Akan Terima": "text-stamp-amber border-stamp-amber/40 bg-stamp-amber/10",
  "Minta Hantar Semula": "text-stamp-amber border-stamp-amber/40 bg-stamp-amber/10",
  "Cancel Order": "text-stamp-red border-stamp-red/40 bg-stamp-red/10",
  "Tak Dapat Dihubungi": "text-stamp-red border-stamp-red/40 bg-stamp-red/10",
  "Selamat — Sampai": "text-stamp-green border-stamp-green/40 bg-stamp-green/10",
};

/**
 * Ringkasan Selamatkan.
 *
 * Bukan senarai untuk buat tindakan (itu RiskParcelPanel) — ini paparan
 * "apa yang admin dah buat": status yang ditanda, punca return yang
 * dipilih, dan catatan. Guna storan yang sama, jadi apa-apa perubahan di
 * RiskParcelPanel terus muncul di sini.
 */
export default function SelamatkanSummaryPanel({
  parcels,
  thresholdDays,
}: {
  parcels: RiskParcel[];
  thresholdDays?: number;
}) {
  const [riskMap, setRiskMap] = useState<Record<string, RiskRecord>>({});
  const [causeMap, setCauseMap] = useState<Record<string, CauseRecord>>({});
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<"semua" | "ada-tindakan" | "belum">("ada-tindakan");

  useEffect(() => {
    setRiskMap(loadRisk());
    setCauseMap(loadCauseMap());
    setReady(true);
  }, []);

  const summary = useMemo(() => summariseRisk(parcels, riskMap), [parcels, riskMap]);

  // Punca return breakdown — hanya untuk parcel dalam senarai Selamatkan ini.
  const causeBreakdown = useMemo(() => {
    const counts = new Map<string, { count: number; value: number }>();
    for (const p of parcels) {
      const rec = causeMap[causeKey(p.trackingNo)];
      if (!rec) continue;
      const cur = counts.get(rec.cause) ?? { count: 0, value: 0 };
      cur.count += 1;
      cur.value += p.amount;
      counts.set(rec.cause, cur);
    }
    return Array.from(counts.entries())
      .map(([cause, v]) => ({ cause, ...v, value: Math.round(v.value) }))
      .sort((a, b) => b.count - a.count);
  }, [parcels, causeMap]);

  const causeTaggedCount = causeBreakdown.reduce((s, c) => s + c.count, 0);

  // Rows: setiap parcel dengan status semasa + punca (jika ada) + catatan.
  const rows = useMemo(() => {
    return parcels
      .map((p) => {
        const rRec = riskMap[riskKey(p.trackingNo)];
        const cRec = causeMap[causeKey(p.trackingNo)];
        const touched = !!rRec || !!cRec;
        return {
          parcel: p,
          status: rRec?.status ?? "Belum Hubungi",
          note: rRec?.note ?? "",
          cause: cRec?.cause ?? "",
          updatedAt: rRec?.updatedAt ?? cRec?.updatedAt,
          touched,
        };
      })
      .filter((r) => {
        if (filter === "ada-tindakan") return r.touched;
        if (filter === "belum") return !r.touched;
        return true;
      })
      .sort((a, b) => {
        const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return tb - ta;
      });
  }, [parcels, riskMap, causeMap, filter]);

  if (!ready) {
    return (
      <div className="ticket p-6">
        <p className="text-content-300 text-[13px]">Memuatkan…</p>
      </div>
    );
  }

  return (
    <div className="ticket p-5 sm:p-6 fade-up space-y-5">
      {/* HEADER */}
      <div>
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
          Ringkasan Tindakan Admin
        </p>
        <p className="text-[12.5px] text-content-300/70 mt-1.5 max-w-md leading-relaxed">
          Apa yang admin dah pilih dan buat untuk parcel berisiko
          {typeof thresholdDays === "number" ? ` (tersangkut > ${thresholdDays} hari)` : ""} — status
          follow-up dan punca return.
        </p>
      </div>

      {/* STATUS SUMMARY */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        <Stat label="Jumlah Parcel" value={summary.total} />
        <Stat label="Belum Dihubungi" value={summary.pending} tone="amber" sub={rm(summary.pendingValue)} />
        <Stat label="Selamat — Sampai" value={summary.saved} tone="green" sub={rm(summary.savedValue)} />
        <Stat label="Dibatalkan" value={summary.cancelled} tone="red" sub={rm(summary.cancelledValue)} />
        <Stat label="Tak Dapat Dihubungi" value={summary.unreachable} tone="red" />
      </div>

      {/* PUNCA RETURN BREAKDOWN */}
      <div>
        <p className="font-mono text-[9px] uppercase tracking-wider text-content-300/50 mb-2">
          Punca Return Ditanda ({causeTaggedCount} / {parcels.length})
        </p>

        {causeBreakdown.length === 0 ? (
          <p className="text-content-300/60 text-[12.5px]">
            Tiada punca return ditanda lagi untuk parcel dalam senarai ini.
          </p>
        ) : (
          <div className="space-y-1.5">
            {causeBreakdown.map((c) => (
              <div
                key={c.cause}
                className="flex items-center justify-between gap-3 border border-surface-600 rounded-lg px-3 py-2"
              >
                <span className="text-[12.5px] text-content-100/90">{c.cause}</span>
                <span className="font-mono text-[11px] text-content-300/70 shrink-0">
                  {c.count} · {rm(c.value)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FILTER */}
      <div className="flex flex-wrap gap-2 pt-1 border-t border-surface-600">
        {(
          [
            ["ada-tindakan", "Ada Tindakan"],
            ["belum", "Belum Disentuh"],
            ["semua", "Semua"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setFilter(id)}
            className={`font-mono text-[10.5px] uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-colors ${
              filter === id
                ? "border-accent text-accent-ink bg-accent-wash"
                : "border-surface-600 text-content-300 hover:bg-surface-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ACTIVITY LOG */}
      <div className="space-y-2">
        {rows.length === 0 ? (
          <p className="text-content-300/60 text-[12.5px]">Tiada parcel untuk ditunjukkan.</p>
        ) : (
          rows.map((r) => (
            <div
              key={r.parcel.trackingNo}
              className="border border-surface-600 rounded-xl px-3.5 py-3 grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_180px_200px_120px] gap-2.5 lg:items-center"
            >
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-content-100 truncate">
                  {r.parcel.customerName}
                </p>
                <p className="font-mono text-[10.5px] text-content-300/60 mt-0.5">
                  {r.parcel.trackingNo}
                </p>
                {r.note && (
                  <p className="text-[11.5px] text-content-300/80 mt-1 italic">“{r.note}”</p>
                )}
              </div>

              <span
                className={`font-mono text-[9px] uppercase tracking-wider border rounded-full px-1.5 py-1 w-fit ${STATUS_STYLE[r.status]}`}
              >
                {r.status}
              </span>

              <span className="text-[12px] text-content-100/85">
                {r.cause || <span className="text-content-300/50">— tiada punca —</span>}
              </span>

              <span className="font-mono text-[10.5px] text-content-300/60 text-left lg:text-right">
                {fmtDate(r.updatedAt)}
              </span>
            </div>
          ))
        )}
      </div>

      <p className="text-content-300/60 text-[11.5px] leading-relaxed">
        Ringkasan ini dijana daripada data yang sama dengan tab <strong>Selamatkan → Tindakan</strong> dan{" "}
        <strong>Punca Return</strong>, disimpan dalam browser komputer ini.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  tone = "ink",
}: {
  label: string;
  value: number;
  sub?: string;
  tone?: "ink" | "amber" | "green" | "red";
}) {
  const colour =
    tone === "amber"
      ? "text-stamp-amber"
      : tone === "green"
      ? "text-stamp-green"
      : tone === "red"
      ? "text-stamp-red"
      : "text-content-100";

  return (
    <div className="border border-surface-600 rounded-lg px-3 py-2.5">
      <p className="font-mono text-[9px] uppercase tracking-wider text-content-300/60">{label}</p>
      <p className={`font-display font-extrabold text-[1.3rem] leading-none mt-1 ${colour}`}>
        <CountUp value={value} />
      </p>
      {sub && <p className="text-[10.5px] text-content-300/60 mt-1">{sub}</p>}
    </div>
  );
}
