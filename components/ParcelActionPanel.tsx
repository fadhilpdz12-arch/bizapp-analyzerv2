"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { ActionParcel, ParcelActionBoard } from "@/lib/types";
import { waLink } from "@/lib/winback";
import { sfxSave, sfxSuccess } from "@/lib/sfx";
import {
  ParcelNote,
  ParcelNoteMap,
  fmtNoteTime,
  isEmptyNote,
  loadAdminName,
  loadNotes,
  mergeNotes,
  parcelKey,
  saveAdminName,
  saveNotes,
} from "@/lib/parcelNotes";

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
  tags: string[]; // one-tap follow-up tags relevant to this group
  empty: string;
}

function rm(n: number) {
  return `RM ${Math.round(n).toLocaleString()}`;
}

function groupsFor(stuckDays: number): Group[] {
  return [
    {
      key: "failedDelivery",
      tags: ["Dah WhatsApp", "Dah call", "Tak angkat", "Alamat disahkan", "Minta hantar semula", "Customer nak batal"],
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
      tags: ["Dah WhatsApp", "Dah call", "Tak angkat", "Alamat disahkan", "Aduan kurier", "Customer nak batal"],
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
      tags: ["Dah WhatsApp", "Dah call", "Tak angkat", "Customer akan kutip", "Customer nak batal"],
      icon: "\u{1F3EA}",
      title: "Tunggu Kutipan Sendiri",
      desc: "Parcel dah sampai di pejabat kurier (Window Delivery Assigned) dan customer kena pergi kutip. Kalau tak dikutip, kurier akan auto-return.",
      todo: "WhatsApp customer dengan lokasi kutipan & minta kutip secepat mungkin.",
      tone: "amber",
      urgent: true,
      wa: true,
      empty: "Tiada parcel menunggu kutipan.",
    },
    {
      key: "stuck",
      tags: ["Dah WhatsApp", "Aduan kurier", "Kurier dah jawab"],
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
      tags: ["Dah semak", "Belum serah kurier", "Aduan kurier"],
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
      tags: ["Dah proses", "Tunggu stok", "Customer nak batal"],
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
      tags: ["Dah WhatsApp"],
      icon: "\u{1F69A}",
      title: "Sedang Dihantar",
      desc: "Parcel atas lori, sedang dihantar ke alamat customer.",
      todo: "Pilihan: beri heads-up kepada customer supaya bersedia terima & ada duit COD.",
      tone: "green",
      urgent: false,
      wa: true,
      empty: "Tiada parcel dalam penghantaran.",
    },
    {
      key: "inTransit",
      tags: [],
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

type UpdateNote = (key: string, patch: Partial<ParcelNote>) => void;

function isLate(p: ActionParcel): boolean {
  return (
    p.overdue ||
    ((p.action === "SELF_COLLECT" || p.action === "FAILED_DELIVERY" || p.action === "EXCEPTION") &&
      (p.daysSince ?? 0) >= 3)
  );
}

function Row({
  p,
  g,
  note,
  onUpdate,
}: {
  p: ActionParcel;
  g: Group;
  note: ParcelNote | undefined;
  onUpdate: UpdateNote;
}) {
  const key = parcelKey(p);
  const [copied, setCopied] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note?.note ?? "");
  const link = g.wa && p.phone ? waLink(p.phone, waMessage(p)) : "";
  const done = !!note?.done;
  const tags = note?.tags ?? [];
  const late = isLate(p);

  useEffect(() => {
    if (!editing) setDraft(note?.note ?? "");
  }, [note?.note, editing]);

  const copyTracking = async () => {
    if (!p.trackingNo) return;
    if (await copyText(p.trackingNo)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  const toggleTag = (t: string) =>
    onUpdate(key, { tags: tags.includes(t) ? tags.filter((x) => x !== t) : [...tags, t] });

  const saveDraft = () => {
    setEditing(false);
    if (draft.trim() !== (note?.note ?? "").trim()) onUpdate(key, { note: draft.trim() });
  };

  return (
    <div
      className={`py-3 border-t border-surface-700/70 first:border-t-0 transition-opacity ${done ? "opacity-55" : ""}`}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        {/* Done tick — big tap target */}
        <button
          onClick={() => onUpdate(key, { done: !done })}
          aria-pressed={done}
          title={done ? "Tandakan belum selesai" : "Tandakan selesai"}
          className={`shrink-0 mt-0.5 w-7 h-7 rounded-md border-2 flex items-center justify-center text-[15px] font-bold transition-colors ${
            done
              ? "bg-stamp-green border-stamp-green text-white"
              : "border-surface-500 text-transparent hover:border-stamp-green hover:text-stamp-green/40"
          }`}
        >
          ✓
        </button>

        <div className="min-w-0 flex-1 basis-52">
          <p className={`text-[14px] text-content-100 truncate ${done ? "line-through decoration-content-300/50" : ""}`}>
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
            <p
              className={`font-mono text-[11px] ${
                late ? TONE_TEXT[g.tone === "slate" ? "red" : g.tone] : "text-content-300/45"
              }`}
            >
              {p.daysSince === 0 ? "hari ini" : `${p.daysSince} hari lepas`}
              {p.overdue && <span className="ml-1 font-semibold">· LEWAT</span>}
            </p>
          )}
        </div>

        <div className="flex gap-1.5 shrink-0">
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                if (!tags.includes("Dah WhatsApp")) onUpdate(key, { tags: [...tags, "Dah WhatsApp"] });
              }}
              className="flex items-center bg-stamp-green/10 text-stamp-green border border-stamp-green/40 rounded-lg px-3 py-2 min-h-[36px] text-[12px] font-medium hover:bg-stamp-green/20 transition-colors"
            >
              WhatsApp
            </a>
          )}
          <button
            onClick={() => setEditing((e) => !e)}
            className={`flex items-center rounded-lg px-3 py-2 min-h-[36px] text-[12px] border transition-colors ${
              note?.note
                ? "border-accent/50 text-accent bg-accent/10"
                : "border-surface-600 text-content-300/70 hover:text-content-100"
            }`}
          >
            📝 Nota
          </button>
        </div>
      </div>

      {/* Quick tags + note, aligned under the text (past the tick) */}
      <div className="pl-10 mt-2 space-y-2 min-w-0">
        <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap sm:overflow-visible -mr-5 pr-5 sm:mr-0 sm:pr-0 [scrollbar-width:none]">
          {[...g.tags, ...tags.filter((t) => !g.tags.includes(t))].map((t) => {
            const on = tags.includes(t);
            return (
              <button
                key={t}
                onClick={() => toggleTag(t)}
                className={`shrink-0 whitespace-nowrap px-2 py-1 rounded-full text-[11px] border transition-colors ${
                  on
                    ? "bg-content-100 text-surface-900 border-content-100"
                    : "border-surface-600 text-content-300/60 hover:text-content-100 hover:border-surface-500"
                }`}
              >
                {on ? "✓ " : ""}
                {t}
              </button>
            );
          })}
        </div>

        {editing ? (
          <div>
            <textarea
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={saveDraft}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) saveDraft();
                if (e.key === "Escape") {
                  setDraft(note?.note ?? "");
                  setEditing(false);
                }
              }}
              rows={2}
              placeholder="Contoh: customer minta hantar Sabtu, alamat betul No 12 Jln Mawar…"
              className="w-full rounded-lg border border-surface-500 bg-surface-900 px-3 py-2 text-[13px] text-content-100 focus:outline-none focus:border-accent"
            />
            <p className="text-[11px] text-content-300/50 mt-0.5">Auto-simpan bila klik di luar kotak · Esc untuk batal</p>
          </div>
        ) : (
          note?.note && (
            <button
              onClick={() => setEditing(true)}
              className="block text-left w-full rounded-lg bg-surface-700/60 px-3 py-2 text-[13px] text-content-200 whitespace-pre-wrap hover:bg-surface-700"
            >
              {note.note}
            </button>
          )
        )}

        {note && !isEmptyNote(note) && (
          <p className="font-mono text-[10.5px] text-content-300/45">
            dikemas kini {fmtNoteTime(note.updatedAt)}
            {note.by ? ` oleh ${note.by}` : ""}
          </p>
        )}
      </div>
    </div>
  );
}

function GroupCard({
  g,
  list,
  notes,
  onUpdate,
  hideDone,
}: {
  g: Group;
  list: ActionParcel[];
  notes: ParcelNoteMap;
  onUpdate: UpdateNote;
  hideDone: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const SHOW = 8;

  const doneCount = list.filter((p) => notes[parcelKey(p)]?.done).length;
  // Not-done first, keeping the group's priority order inside each half.
  const ordered = [
    ...list.filter((p) => !notes[parcelKey(p)]?.done),
    ...(hideDone ? [] : list.filter((p) => notes[parcelKey(p)]?.done)),
  ];
  const visible = expanded ? ordered : ordered.slice(0, SHOW);
  const pending = list.filter((p) => !notes[parcelKey(p)]?.done);
  const totalValue = Math.round(pending.reduce((s, p) => s + p.amount, 0));
  const overdue = pending.filter((p) => p.overdue).length;
  const pctDone = list.length ? Math.round((doneCount / list.length) * 100) : 0;

  const copyAll = async () => {
    const lines = pending.map((p) =>
      [
        p.trackingNo || "(tiada tracking)",
        p.customerName,
        p.phone,
        p.product,
        rm(p.amount),
        p.lastEventLabel !== "—" ? p.lastEventLabel : p.lastScanLabel,
      ]
        .filter(Boolean)
        .join(" | ")
    );
    if (await copyText(`${g.title} — ${pending.length} belum selesai\n` + lines.join("\n"))) {
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
          {pending.length} belum selesai{pending.length > 0 ? ` · ${rm(totalValue)}` : ""}
          {overdue > 0 ? ` · ${overdue} lewat` : ""}
        </span>
      </div>
      <p className="text-[12.5px] text-content-300/60">{g.desc}</p>
      <p className="text-[12.5px] text-content-100/85 mt-1.5">
        <span className="font-semibold">Tindakan admin:</span> {g.todo}
      </p>

      {list.length > 0 && g.urgent && (
        <div className="mt-3 mb-1 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-surface-700 overflow-hidden">
            <div className="h-full bg-stamp-green transition-all" style={{ width: `${pctDone}%` }} />
          </div>
          <span className="font-mono text-[11px] text-content-300/60">
            {doneCount}/{list.length} selesai
          </span>
        </div>
      )}

      {list.length === 0 ? (
        <p className="text-[13px] text-content-300/50 py-3">{g.empty}</p>
      ) : ordered.length === 0 ? (
        <p className="text-[13px] text-stamp-green py-3">Semua parcel dalam kumpulan ini dah selesai 🎉</p>
      ) : (
        <>
          <div className="mt-2">
            {visible.map((p, i) => (
              <Row key={`${parcelKey(p)}-${i}`} p={p} g={g} note={notes[parcelKey(p)]} onUpdate={onUpdate} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {ordered.length > SHOW && (
              <button onClick={() => setExpanded(!expanded)} className="btn-soft px-3 py-2 text-[12px]">
                {expanded ? "Tutup senarai" : `Lihat semua ${ordered.length} parcel`}
              </button>
            )}
            {pending.length > 0 && (
              <button
                onClick={copyAll}
                className="btn-soft px-3 py-2 text-[12px]"
                title="Salin senarai belum selesai untuk hantar ke kurier/team"
              >
                {copied ? "Disalin ✓" : `Salin senarai (${pending.length})`}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function exportWorkbook(groups: Group[], board: ParcelActionBoard, notes: ParcelNoteMap) {
  const rows = groups.flatMap((g) =>
    (board[g.key] ?? []).map((p) => {
      const n = notes[parcelKey(p)];
      return {
        Kategori: g.title,
        "Perlu Tindakan": g.urgent ? "Ya" : "Tidak",
        Selesai: n?.done ? "Ya" : "",
        "No. Tracking": p.trackingNo,
        Kurier: p.trackingNo ? p.courierProvider : "",
        Pelanggan: p.customerName,
        Telefon: p.phone,
        Produk: p.product,
        "Nilai (RM)": Math.round(p.amount),
        Ejen: p.agent,
        "Scan Terakhir": p.lastEventLabel !== "—" ? p.lastEventLabel : "",
        Lokasi: p.location,
        Tarikh: p.lastScanLabel,
        "Hari Berlalu": p.daysSince ?? "",
        Lewat: p.overdue ? "Ya" : "",
        "Tag Tindakan": (n?.tags ?? []).join(", "),
        Nota: n?.note ?? "",
        "Dikemas Kini": n && !isEmptyNote(n) ? fmtNoteTime(n.updatedAt) : "",
        Oleh: n?.by ?? "",
      };
    })
  );
  const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nota: "Tiada parcel pending" }]);
  ws["!cols"] = Object.keys(rows[0] ?? { a: 1 }).map((k) => ({
    wch: k === "Scan Terakhir" || k === "Nota" ? 40 : k === "Kategori" ? 30 : 14,
  }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tindakan Parcel");
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  XLSX.writeFile(wb, `tindakan-parcel-${stamp}.xlsx`);
}

function downloadJSON(data: unknown, name: string) {
  const blob = new Blob([JSON.stringify(data, null, 1)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function ParcelActionPanel({ board }: { board: ParcelActionBoard }) {
  const [view, setView] = useState<"tindakan" | "semua">("tindakan");
  const [notes, setNotes] = useState<ParcelNoteMap>({});
  const [adminName, setAdminName] = useState("");
  const [query, setQuery] = useState("");
  const [hideDone, setHideDone] = useState(true);
  const [flash, setFlash] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setNotes(loadNotes());
    setAdminName(loadAdminName());
  }, []);

  const groups = groupsFor(board.stuckDays ?? 3);

  const showFlash = (msg: string) => {
    setFlash(msg);
    setTimeout(() => setFlash(""), 2200);
  };

  // Mirror of notes so updates can save + play sound outside the state
  // updater (updaters run twice under React StrictMode).
  const notesRef = useRef<ParcelNoteMap>({});
  notesRef.current = notes;

  const onUpdate = useCallback<UpdateNote>(
    (key, patch) => {
      const prev = notesRef.current;
      const cur: ParcelNote = prev[key] ?? { done: false, tags: [], note: "", updatedAt: "" };
      const nextNote: ParcelNote = {
        ...cur,
        ...patch,
        updatedAt: new Date().toISOString(),
        by: adminName || cur.by,
      };
      const next = { ...prev };
      if (isEmptyNote(nextNote)) delete next[key];
      else next[key] = nextNote;
      if (!saveNotes(next)) {
        showFlash("Gagal simpan — storan browser penuh");
        return;
      }
      notesRef.current = next;
      setNotes(next);
      if (patch.done === true) sfxSuccess();
      else sfxSave();
    },
    [adminName]
  );

  // Search narrows every group at once.
  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    const out = {} as Record<GroupKey, ActionParcel[]>;
    for (const g of groups) {
      const list = board[g.key] ?? [];
      out[g.key] = q
        ? list.filter((p) =>
            [p.customerName, p.phone, p.trackingNo, p.agent, p.product, p.location, notes[parcelKey(p)]?.note]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q))
          )
        : list;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board, q, notes]);

  // Same rule as board.totalActionable: unscanned/unshipped only once overdue.
  const actionable = groups
    .filter((g) => g.urgent)
    .flatMap((g) => board[g.key] ?? [])
    .filter((p) => (p.action === "NO_SCAN" || p.action === "NOT_SHIPPED" ? p.overdue : true));
  const actionableDone = actionable.filter((p) => notes[parcelKey(p)]?.done).length;
  const actionablePct = actionable.length ? Math.round((actionableDone / actionable.length) * 100) : 0;

  const shown = groups.filter((g) => (view === "semua" || g.urgent) && (!q || filtered[g.key].length > 0));

  const importNotes = async (file: File) => {
    try {
      const data = JSON.parse(await file.text());
      const merged = mergeNotes(notes, data?.notes ?? data);
      if (saveNotes(merged)) {
        setNotes(merged);
        showFlash("Nota berjaya diimport ✓");
      }
    } catch {
      showFlash("Fail tak sah — guna fail backup dari butang Backup Nota");
    }
  };

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* Overview + tools */}
      <div className="ticket p-5 sm:p-6 space-y-4">
        <div className="flex items-baseline justify-between flex-wrap gap-2">
          <p className="text-[14px] text-content-100">
            <span className="font-display font-bold text-2xl mr-1.5">{board.totalPending}</span>
            parcel pending ·{" "}
            <span className="text-stamp-red font-semibold">
              {actionable.length - actionableDone} perlu tindakan
            </span>
          </p>
          <div className="flex gap-1.5">
            {(["tindakan", "semua"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-[12px] border transition-colors ${
                  view === v
                    ? "bg-content-100 text-surface-900 border-content-100"
                    : "border-surface-600 text-content-300/70 hover:text-content-100"
                }`}
              >
                {v === "tindakan" ? "Perlu Tindakan" : "Semua Pending"}
              </button>
            ))}
          </div>
        </div>

        {/* Today's progress across all actionable groups */}
        <div>
          <div className="flex justify-between text-[12px] text-content-300/70 mb-1">
            <span>Kemajuan hari ini</span>
            <span className="font-mono">
              {actionableDone}/{actionable.length} selesai · {actionablePct}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
            <div className="h-full bg-stamp-green transition-all" style={{ width: `${actionablePct}%` }} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {groups.map((g) => {
            const list = board[g.key] ?? [];
            const left = list.filter((p) => !notes[parcelKey(p)]?.done).length;
            return (
              <button
                key={g.key}
                onClick={() => {
                  if (!g.urgent) setView("semua");
                  setTimeout(
                    () => document.getElementById(`grp-${g.key}`)?.scrollIntoView({ behavior: "smooth" }),
                    30
                  );
                }}
                className={`text-left rounded-lg border px-3 py-2.5 transition-opacity ${TONE_BADGE[g.tone]} ${
                  left === 0 ? "opacity-45" : "hover:opacity-80"
                }`}
              >
                <p className="font-display font-bold text-xl leading-none">
                  {left}
                  {left !== list.length && <span className="text-[12px] font-normal opacity-70"> / {list.length}</span>}
                </p>
                <p className="text-[11px] mt-1 leading-snug">
                  {g.icon} {g.title.replace(/\s*\(.*\)$/, "")}
                </p>
              </button>
            );
          })}
        </div>

        {/* Search + filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Cari nama, telefon, tracking, ejen, nota…"
            className="flex-1 min-w-[200px] rounded-lg border border-surface-500 bg-surface-900 px-3 py-2 text-[13px] text-content-100 focus:outline-none focus:border-accent"
          />
          <label className="flex items-center gap-2 text-[12px] text-content-300/80 cursor-pointer select-none">
            <input type="checkbox" checked={hideDone} onChange={(e) => setHideDone(e.target.checked)} className="w-4 h-4" />
            Sembunyi yang selesai
          </label>
        </div>

        {/* Admin name + data tools */}
        <div className="flex flex-wrap gap-2 items-center pt-1 border-t border-surface-700/70">
          <label className="flex items-center gap-2 text-[12px] text-content-300/70 pt-3">
            Nama admin
            <input
              value={adminName}
              onChange={(e) => setAdminName(e.target.value)}
              onBlur={() => saveAdminName(adminName)}
              placeholder="cth: Aina"
              className="w-28 rounded-md border border-surface-500 bg-surface-900 px-2 py-1 text-[12px] text-content-100 focus:outline-none focus:border-accent"
            />
          </label>
          <div className="flex flex-wrap gap-2 pt-3 sm:ml-auto">
            <button
              onClick={() => exportWorkbook(groups, board, notes)}
              className="btn-soft px-3 py-2 text-[12px]"
              title="Semua parcel pending + tick + nota dalam satu Excel"
            >
              ⬇ Excel Tindakan
            </button>
            <button
              onClick={() => downloadJSON({ app: "bizapp-parcel-notes", notes }, "backup-nota-parcel.json")}
              className="btn-soft px-3 py-2 text-[12px]"
              title="Simpan semua tick & nota ke fail — untuk pindah ke komputer lain"
            >
              💾 Backup Nota
            </button>
            <button onClick={() => fileRef.current?.click()} className="btn-soft px-3 py-2 text-[12px]">
              📂 Import Nota
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importNotes(f);
                e.target.value = "";
              }}
            />
          </div>
        </div>
        {flash && <p className="text-[12px] text-accent">{flash}</p>}
        <p className="text-[11px] text-content-300/45">
          Tick & nota disimpan dalam browser ini ikut no. tracking, jadi kekal walaupun upload fail Bizapp baru esok.
          Guna Backup/Import Nota untuk kongsi dengan admin lain atau pindah komputer.
        </p>
      </div>

      {q && shown.length === 0 && (
        <p className="text-[13px] text-content-300/60 text-center py-6">Tiada parcel padan dengan &ldquo;{query}&rdquo;.</p>
      )}

      {shown.map((g) => (
        <GroupCard
          key={g.key}
          g={g}
          list={filtered[g.key]}
          notes={notes}
          onUpdate={onUpdate}
          hideDone={hideDone}
        />
      ))}
    </div>
  );
}
