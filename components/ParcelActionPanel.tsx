"use client";

import { useState } from "react";
import { ActionParcel, ParcelActionBoard } from "@/lib/types";
import { waLink } from "@/lib/winback";

/**
 * Operational board covering EVERY pending parcel, each placed in one group
 * from its latest courier scan, ordered by how urgently the admin must act.
 */

type GroupKey = keyof Pick<
  ParcelActionBoard,
  "selfCollect" | "failedDelivery" | "exception" | "stuck" | "noScan" | "notShipped" | "outForDelivery" | "inTransit"
>;
type Tone = "red" | "amber" | "green" | "slate";

interface Group {
  key: GroupKey;
  icon: string;
  title: string;
  desc: string;
  todo: string; // what the admin should do
  tone: Tone;
  urgent: boolean; // counts as "Perlu Tindakan"
  wa: boolean; // customer-facing WhatsApp makes sense
  empty: string;
}

function rm(n: number) {
  return `RM ${Math.round(n).toLocaleString()}`;
}

function groupsFor(stuckDays: number): Group[] {
  return [
    {
      key: "failedDelivery",
      icon: "\u26A0\uFE0F",
      title: "Gagal Dihantar",
      desc: "Percubaan hantar terakhir gagal. Satu lagi gagal, biasanya parcel terus dipulangkan.",
      todo: "WhatsApp/call customer: sahkan alamat & pastikan ada orang di rumah. Kalau perlu, minta kurier hantar semula.",
      tone: "red",
      urgent: true,
      wa: true,
      empty: "Tiada parcel gagal dihantar.",
    },
    {
      key: "exception",
      icon: "\u{1F6A9}",
      title: "Masalah di Pejabat Kurier (Exception)",
      desc: "Kurier tanda parcel ada isu (Arrival Exception) — selalunya alamat tak lengkap atau telefon tak dapat dihubungi. Parcel tak akan bergerak sendiri.",
      todo: "Semak dengan kurier apa isunya, sahkan alamat & no. telefon customer, kemudian kemas kini dengan kurier.",
      tone: "red",
      urgent: true,
      wa: true,
      empty: "Tiada parcel exception.",
    },
    {
      key: "selfCollect",
      icon: "\u{1F3EA}",
      title: "Tunggu Kutipan Sendiri",
      desc: "Parcel dah sampai tapi customer kena pergi kutip. Kalau tak dikutip, kurier akan auto-return.",
      todo: "WhatsApp customer dengan lokasi kutipan & minta kutip secepat mungkin.",
      tone: "amber",
      urgent: true,
      wa: true,
      empty: "Tiada parcel menunggu kutipan.",
    },
    {
      key: "stuck",
      icon: "\u23F3",
      title: `Tersangkut (${stuckDays}+ hari tiada scan baru)`,
      desc: "Parcel dalam perjalanan tapi status tak bergerak lama.",
      todo: "Buat aduan/semakan dengan kurier guna no. tracking. Beritahu customer parcel lambat supaya tak reject.",
      tone: "amber",
      urgent: true,
      wa: true,
      empty: "Tiada parcel tersangkut.",
    },
    {
      key: "noScan",
      icon: "\u{1F4E6}",
      title: "Tracking Dah Jana, Belum Discan Kurier",
      desc: "No. tracking wujud tapi kurier belum pickup/scan langsung. Yang bertanda LEWAT dah melebihi 2 hari.",
      todo: "Semak parcel dah diserah/dipickup belum. Kalau dah serah, follow up dengan kurier.",
      tone: "slate",
      urgent: true,
      wa: false,
      empty: "Semua parcel bertracking dah discan kurier.",
    },
    {
      key: "notShipped",
      icon: "\u{1F4DD}",
      title: "Belum Ada Tracking",
      desc: "Order pending tanpa no. tracking — belum dipos. Yang bertanda LEWAT dah lebih sehari.",
      todo: "Pastikan order dah diproses: jana tracking & hantar parcel, atau batalkan kalau tak jadi.",
      tone: "slate",
      urgent: true,
      wa: false,
      empty: "Semua order pending dah ada tracking.",
    },
    {
      key: "outForDelivery",
      icon: "\u{1F69A}",
      title: "Sedang Dihantar",
      desc: "Parcel atas lori / slot hantar dah ditetapkan.",
      todo: "Pilihan: beri heads-up kepada customer supaya bersedia terima & ada duit COD.",
      tone: "green",
      urgent: false,
      wa: true,
      empty: "Tiada parcel dalam penghantaran.",
    },
    {
      key: "inTransit",
      icon: "\u{1F6E3}\uFE0F",
      title: "Dalam Perjalanan (Normal)",
      desc: `Bergerak seperti biasa (linehaul, hub, dispatch, pickup) dengan scan dalam ${stuckDays} hari terakhir.`,
      todo: "Tiada tindakan — pantau sahaja. Akan masuk 'Tersangkut' kalau tak bergerak.",
      tone: "green",
      urgent: false,
      wa: false,
      empty: "Tiada parcel dalam perjalanan.",
    },
  ];
}

function waMessage(p: ActionParcel): string {
  const name = p.customerName || "puan/tuan";
  const prod = p.product || "pesanan anda";
  const tn = p.trackingNo ? ` (${p.trackingNo})` : "";
  switch (p.action) {
    case "SELF_COLLECT": {
      const loc = p.location ? ` di ${p.location}` : " di pejabat/cawangan kurier berdekatan";
      return (
        `Salam ${name}, parcel ${prod} anda${tn} sudah sampai dan sedang menunggu kutipan${loc}. ` +
        `Mohon kutip secepat mungkin ya — parcel yang tidak dikutip dalam beberapa hari akan dihantar pulang oleh kurier. Terima kasih! 🙏`
      );
    }
    case "FAILED_DELIVERY":
      return (
        `Salam ${name}, kurier telah cuba menghantar parcel ${prod} anda${tn} tetapi penghantaran tidak berjaya. ` +
        `Boleh bantu sahkan alamat penghantaran & pastikan ada orang di rumah untuk percubaan seterusnya? Terima kasih! 🙏`
      );
    case "EXCEPTION":
      return (
        `Salam ${name}, parcel ${prod} anda${tn} tertahan di ${p.location || "pejabat kurier"}. ` +
        `Boleh bantu sahkan alamat penuh (no. rumah, jalan, taman, poskod) & no. telefon yang boleh dihubungi supaya kami boleh minta kurier teruskan penghantaran? Terima kasih! 🙏`
      );
    case "STUCK":
      return (
        `Salam ${name}, parcel ${prod} anda${tn} masih dalam perjalanan tetapi agak lambat dari biasa. ` +
        `Kami sedang semak dengan pihak kurier. Mohon terima parcel bila sampai nanti ya. Terima kasih atas kesabaran! 🙏`
      );
    default:
      return (
        `Salam ${name}, parcel ${prod} anda${tn} sedang dalam penghantaran hari ini. ` +
        `Mohon pastikan ada orang untuk menerimanya ya. Terima kasih! 😊`
      );
  }
}

const TONE_TEXT: Record<Tone, string> = {
  red: "text-stamp-red",
  amber: "text-stamp-amber",
  green: "text-stamp-green",
  slate: "text-stamp-slate",
};
const TONE_BADGE: Record<Tone, string> = {
  red: "bg-stamp-red/10 text-stamp-red border-stamp-red/40",
  amber: "bg-stamp-amber/10 text-stamp-amber border-stamp-amber/40",
  green: "bg-stamp-green/10 text-stamp-green border-stamp-green/40",
  slate: "bg-stamp-slate/10 text-stamp-slate border-stamp-slate/40",
};

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function Row({ p, g }: { p: ActionParcel; g: Group }) {
  const [copied, setCopied] = useState(false);
  const link = g.wa && p.phone ? waLink(p.phone, waMessage(p)) : "";
  const late =
    p.overdue ||
    ((p.action === "SELF_COLLECT" || p.action === "FAILED_DELIVERY" || p.action === "EXCEPTION") &&
      (p.daysSince ?? 0) >= 3);

  const copyTracking = async () => {
    if (!p.trackingNo) return;
    if (await copyText(p.trackingNo)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
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
          {p.trackingNo ? (
            <button
              onClick={copyTracking}
              title="Salin no. tracking"
              className="hover:text-content-100 transition-colors underline decoration-dotted underline-offset-2"
            >
              {copied ? "Disalin ✓" : p.trackingNo}
            </button>
          ) : (
            <span>tiada tracking</span>
          )}
          {p.trackingNo && <span>· {p.courierProvider}</span>}
          <span>· {rm(p.amount)}</span>
          {p.agent && <span className="hidden sm:inline">· ejen {p.agent}</span>}
          {p.phone && <span className="hidden sm:inline">· {p.phone}</span>}
        </p>
        {p.lastEventLabel !== "—" && (
          <p className={`text-[12px] mt-1 ${TONE_TEXT[g.tone]}`}>
            {p.action === "SELF_COLLECT" ? "📍 Lokasi kutipan: " : "Scan terakhir: "}
            <span className="font-medium">
              {p.action === "SELF_COLLECT" ? p.location || "tidak dinyatakan" : p.lastEventLabel}
            </span>
            {p.action === "FAILED_DELIVERY" && p.failAttempts > 1 && <span> · {p.failAttempts}x gagal</span>}
          </p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className="font-mono text-[11px] text-content-300/60">{p.lastScanLabel}</p>
        {p.daysSince !== null && (
          <p className={`font-mono text-[11px] ${late ? TONE_TEXT[g.tone === "slate" ? "red" : g.tone] : "text-content-300/45"}`}>
            {p.daysSince === 0 ? "hari ini" : `${p.daysSince} hari lepas`}
            {p.overdue && <span className="ml-1 font-semibold">· LEWAT</span>}
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

function GroupCard({ g, list }: { g: Group; list: ActionParcel[] }) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const SHOW = 8;
  const visible = expanded ? list : list.slice(0, SHOW);
  const totalValue = Math.round(list.reduce((s, p) => s + p.amount, 0));
  const overdue = list.filter((p) => p.overdue).length;
  const trackings = list.map((p) => p.trackingNo).filter(Boolean);

  const copyAll = async () => {
    const lines = list.map((p) =>
      [p.trackingNo || "(tiada tracking)", p.customerName, p.phone, p.product, rm(p.amount), p.lastEventLabel !== "—" ? p.lastEventLabel : p.lastScanLabel]
        .filter(Boolean)
        .join(" | ")
    );
    if (await copyText(`${g.title} (${list.length})\n` + lines.join("\n"))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    }
  };

  return (
    <div id={`grp-${g.key}`} className="ticket p-5 sm:p-6 fade-up scroll-mt-24">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-1.5">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
          {g.icon} {g.title}
        </p>
        <span className={`font-mono text-[11px] leading-none px-2 py-1.5 rounded-full border ${TONE_BADGE[g.tone]}`}>
          {list.length} parcel{list.length > 0 ? ` · ${rm(totalValue)}` : ""}
          {overdue > 0 ? ` · ${overdue} lewat` : ""}
        </span>
      </div>
      <p className="text-[12.5px] text-content-300/60">{g.desc}</p>
      <p className="text-[12.5px] text-content-100/85 mt-1.5 mb-2">
        <span className="font-semibold">Tindakan admin:</span> {g.todo}
      </p>

      {list.length === 0 ? (
        <p className="text-[13px] text-content-300/50 py-3">{g.empty}</p>
      ) : (
        <>
          {visible.map((p, i) => (
            <Row key={`${p.trackingNo}-${p.customerName}-${i}`} p={p} g={g} />
          ))}
          <div className="flex flex-wrap gap-2 mt-3">
            {list.length > SHOW && (
              <button onClick={() => setExpanded(!expanded)} className="btn-soft px-3 py-2 text-[12px]">
                {expanded ? "Tutup senarai" : `Lihat semua ${list.length} parcel`}
              </button>
            )}
            <button onClick={copyAll} className="btn-soft px-3 py-2 text-[12px]" title="Salin senarai untuk hantar ke kurier/team">
              {copied ? "Disalin ✓" : trackings.length ? `Salin senarai (${list.length})` : "Salin senarai"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default function ParcelActionPanel({ board }: { board: ParcelActionBoard }) {
  const [view, setView] = useState<"tindakan" | "semua">("tindakan");
  const groups = groupsFor(board.stuckDays ?? 3);
  const shown = groups.filter((g) => view === "semua" || g.urgent);

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Overview: every pending parcel, one chip per group */}
      <div className="ticket p-5 sm:p-6">
        <div className="flex items-baseline justify-between flex-wrap gap-2 mb-3">
          <p className="text-[14px] text-content-100">
            <span className="font-display font-bold text-2xl mr-1.5">{board.totalPending}</span>
            parcel pending ·{" "}
            <span className="text-stamp-red font-semibold">{board.totalActionable} perlu tindakan</span>
          </p>
          <div className="flex gap-1.5">
            {(["tindakan", "semua"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-[12px] border transition-colors ${
                  view === v
                    ? "bg-content-100 text-surface-900 border-content-100"
                    : "border-surface-700 text-content-300/70 hover:text-content-100"
                }`}
              >
                {v === "tindakan" ? "Perlu Tindakan" : "Semua Pending"}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {groups.map((g) => {
            const n = board[g.key]?.length ?? 0;
            return (
              <button
                key={g.key}
                onClick={() => {
                  if (!g.urgent) setView("semua");
                  setTimeout(() => document.getElementById(`grp-${g.key}`)?.scrollIntoView({ behavior: "smooth" }), 30);
                }}
                className={`text-left rounded-lg border px-3 py-2.5 transition-opacity ${TONE_BADGE[g.tone]} ${
                  n === 0 ? "opacity-45" : "hover:opacity-80"
                }`}
              >
                <p className="font-display font-bold text-xl leading-none">{n}</p>
                <p className="text-[11px] mt-1 leading-snug">
                  {g.icon} {g.title.replace(/\s*\(.*\)$/, "")}
                </p>
              </button>
            );
          })}
        </div>
      </div>

      {shown.map((g) => (
        <GroupCard key={g.key} g={g} list={board[g.key] ?? []} />
      ))}
    </div>
  );
}
