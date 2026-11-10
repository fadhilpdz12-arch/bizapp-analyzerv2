"use client";

import { useState } from "react";
import { ActionParcel, ParcelActionBoard } from "@/lib/types";
import { waLink } from "@/lib/winback";

/**
 * Operational board for parcels that need action TODAY, read from the latest
 * courier scan: waiting for self-collect (with the pickup location), failed
 * delivery attempts, and parcels currently out for delivery.
 */

function rm(n: number) {
  return `RM ${Math.round(n).toLocaleString()}`;
}

function waMessage(p: ActionParcel): string {
  const name = p.customerName || "puan/tuan";
  const prod = p.product || "pesanan anda";
  if (p.action === "SELF_COLLECT") {
    const loc = p.location ? ` di ${p.location}` : " di pejabat/cawangan kurier berdekatan";
    return (
      `Salam ${name}, parcel ${prod} anda (${p.trackingNo}) sudah sampai dan sedang menunggu kutipan${loc}. ` +
      `Mohon kutip secepat mungkin ya — parcel yang tidak dikutip dalam beberapa hari akan dihantar pulang oleh kurier. Terima kasih! 🙏`
    );
  }
  if (p.action === "FAILED_DELIVERY") {
    return (
      `Salam ${name}, kurier telah cuba menghantar parcel ${prod} anda (${p.trackingNo}) tetapi penghantaran tidak berjaya. ` +
      `Boleh bantu sahkan alamat penghantaran & pastikan ada orang di rumah untuk percubaan seterusnya? Terima kasih! 🙏`
    );
  }
  return (
    `Salam ${name}, parcel ${prod} anda (${p.trackingNo}) sedang keluar untuk penghantaran hari ini. ` +
    `Mohon pastikan ada orang untuk menerimanya ya. Terima kasih! 😊`
  );
}

const GROUPS: {
  key: keyof Pick<ParcelActionBoard, "selfCollect" | "failedDelivery" | "outForDelivery">;
  icon: string;
  title: string;
  desc: string;
  tone: "red" | "amber" | "green";
  empty: string;
}[] = [
  {
    key: "selfCollect",
    icon: "\u{1F3EA}",
    title: "Tunggu Kutipan Sendiri (Self Collect)",
    desc: "Parcel dah sampai tapi customer kena pergi kutip. Kalau tak dikutip, kurier akan auto-return.",
    tone: "amber",
    empty: "Tiada parcel menunggu kutipan — bagus.",
  },
  {
    key: "failedDelivery",
    icon: "\u26A0\uFE0F",
    title: "Gagal Dihantar (Failed Delivery)",
    desc: "Percubaan hantar terakhir gagal. Hubungi customer sebelum percubaan seterusnya gagal juga.",
    tone: "red",
    empty: "Tiada parcel gagal dihantar setakat ini.",
  },
  {
    key: "outForDelivery",
    icon: "\u{1F69A}",
    title: "Sedang Dihantar (Out For Delivery)",
    desc: "Parcel atas lori hari ini. Boleh beri heads-up supaya customer bersedia terima.",
    tone: "green",
    empty: "Tiada parcel dalam penghantaran buat masa ini.",
  },
];

const TONE_TEXT: Record<string, string> = {
  red: "text-stamp-red",
  amber: "text-stamp-amber",
  green: "text-stamp-green",
};
const TONE_BADGE: Record<string, string> = {
  red: "bg-stamp-red/10 text-stamp-red border-stamp-red/40",
  amber: "bg-stamp-amber/10 text-stamp-amber border-stamp-amber/40",
  green: "bg-stamp-green/10 text-stamp-green border-stamp-green/40",
};

function Row({ p, tone }: { p: ActionParcel; tone: string }) {
  const [copied, setCopied] = useState(false);
  const link = p.phone ? waLink(p.phone, waMessage(p)) : "";

  const copyTracking = async () => {
    try {
      await navigator.clipboard.writeText(p.trackingNo);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3 border-t border-surface-700/70 first:border-t-0">
      <div className="min-w-0 flex-1 basis-56">
        <p className="text-[14px] text-content-100 truncate">
          {p.customerName || "—"}
          <span className="text-content-300/50"> · {p.product || "—"}</span>
        </p>
        <p className="font-mono text-[11px] text-content-300/60 mt-0.5 flex flex-wrap items-center gap-x-2">
          <button
            onClick={copyTracking}
            title="Salin no. tracking"
            className="hover:text-content-100 transition-colors underline decoration-dotted underline-offset-2"
          >
            {copied ? "Disalin ✓" : p.trackingNo || "—"}
          </button>
          <span>· {p.courierProvider}</span>
          <span>· {rm(p.amount)}</span>
          {p.agent && <span className="hidden sm:inline">· ejen {p.agent}</span>}
        </p>
        {p.action === "SELF_COLLECT" && (
          <p className={`text-[12px] mt-1 ${TONE_TEXT[tone]}`}>
            📍 Lokasi kutipan: <span className="font-medium">{p.location || "tidak dinyatakan dalam status kurier"}</span>
          </p>
        )}
        {p.action === "FAILED_DELIVERY" && p.failAttempts > 0 && (
          <p className={`text-[12px] mt-1 ${TONE_TEXT[tone]}`}>
            {p.failAttempts}x percubaan gagal setakat ini
          </p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="font-mono text-[11px] text-content-300/60">{p.lastScanLabel}</p>
        {p.daysSince !== null && (
          <p
            className={`font-mono text-[11px] ${
              p.daysSince >= 3 && p.action !== "OUT_FOR_DELIVERY" ? TONE_TEXT[tone] : "text-content-300/45"
            }`}
          >
            {p.daysSince === 0 ? "hari ini" : `${p.daysSince} hari lepas`}
          </p>
        )}
      </div>

      {link && (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 flex items-center bg-stamp-green/10 text-stamp-green border border-stamp-green/40 rounded-lg px-3 py-2 min-h-[36px] text-[12px] font-medium hover:bg-stamp-green/20 transition-colors"
        >
          WhatsApp
        </a>
      )}
    </div>
  );
}

export default function ParcelActionPanel({ board }: { board: ParcelActionBoard }) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const SHOW = 8; // rows shown before "lihat semua"

  return (
    <div className="space-y-5 sm:space-y-6">
      {GROUPS.map((g) => {
        const list = board[g.key];
        const expanded = openGroup === g.key;
        const visible = expanded ? list : list.slice(0, SHOW);
        const totalValue = Math.round(list.reduce((s, p) => s + p.amount, 0));

        return (
          <div key={g.key} className="ticket p-5 sm:p-6 fade-up">
            <div className="flex items-start justify-between gap-3 flex-wrap mb-1.5">
              <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
                {g.icon} {g.title}
              </p>
              <span
                className={`font-mono text-[11px] leading-none px-2 py-1.5 rounded-full border ${TONE_BADGE[g.tone]}`}
              >
                {list.length} parcel{list.length > 0 ? ` · ${rm(totalValue)}` : ""}
              </span>
            </div>
            <p className="text-[12.5px] text-content-300/60 mb-2">{g.desc}</p>

            {list.length === 0 ? (
              <p className="text-[13px] text-content-300/50 py-3">{g.empty}</p>
            ) : (
              <>
                {visible.map((p) => (
                  <Row key={`${p.trackingNo}-${p.customerName}`} p={p} tone={g.tone} />
                ))}
                {list.length > SHOW && (
                  <button
                    onClick={() => setOpenGroup(expanded ? null : g.key)}
                    className="btn-soft mt-3 px-3 py-2 text-[12px]"
                  >
                    {expanded ? "Tutup senarai" : `Lihat semua ${list.length} parcel`}
                  </button>
                )}
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
