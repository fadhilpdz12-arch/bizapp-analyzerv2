/**
 * Admin follow-up state for the Tindakan Parcel board: a done tick, quick
 * follow-up tags and a free-text note per parcel.
 *
 * Stored in localStorage keyed by tracking number (or customer+phone+product
 * when the order has no tracking yet), so it survives re-uploading the next
 * day's export. It lives in this browser only — use Export/Import to move it.
 */

import { ActionParcel } from "./types";

export interface ParcelNote {
  done: boolean;
  tags: string[];
  note: string;
  updatedAt: string; // ISO
  by?: string; // admin name, optional
}

export type ParcelNoteMap = Record<string, ParcelNote>;

const STORE_KEY = "bizapp-parcel-notes-v1";
const ADMIN_KEY = "bizapp-admin-name";
const KEEP_DAYS = 60; // older untouched notes are pruned on load

export function parcelKey(p: Pick<ActionParcel, "trackingNo" | "customerName" | "phone" | "product">): string {
  const tn = (p.trackingNo || "").trim().toUpperCase();
  if (tn && tn !== "-" && tn !== "BATAL") return tn;
  const phone = (p.phone || "").replace(/\D/g, "");
  return `NOTRACK:${phone}:${(p.customerName || "").trim().toUpperCase()}:${(p.product || "").trim().toUpperCase()}`;
}

export function loadNotes(): ParcelNoteMap {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const map = JSON.parse(raw) as ParcelNoteMap;
    const cutoff = Date.now() - KEEP_DAYS * 86400000;
    for (const k of Object.keys(map)) {
      const t = Date.parse(map[k]?.updatedAt || "");
      if (!t || t < cutoff) delete map[k];
    }
    return map;
  } catch {
    return {};
  }
}

export function saveNotes(map: ParcelNoteMap): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function isEmptyNote(n: ParcelNote | undefined): boolean {
  return !n || (!n.done && n.tags.length === 0 && !n.note.trim());
}

export function loadAdminName(): string {
  try {
    return localStorage.getItem(ADMIN_KEY) || "";
  } catch {
    return "";
  }
}

export function saveAdminName(name: string): void {
  try {
    localStorage.setItem(ADMIN_KEY, name.trim());
  } catch {
    /* ignore */
  }
}

export function fmtNoteTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("ms-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** Merge imported notes: newer updatedAt wins per parcel. */
export function mergeNotes(base: ParcelNoteMap, incoming: ParcelNoteMap): ParcelNoteMap {
  const out = { ...base };
  for (const [k, v] of Object.entries(incoming)) {
    if (!v || typeof v !== "object") continue;
    const cur = out[k];
    if (!cur || Date.parse(v.updatedAt || "") > Date.parse(cur.updatedAt || "")) {
      out[k] = {
        done: !!v.done,
        tags: Array.isArray(v.tags) ? v.tags.map(String) : [],
        note: String(v.note || ""),
        updatedAt: v.updatedAt || new Date().toISOString(),
        by: v.by ? String(v.by) : undefined,
      };
    }
  }
  return out;
}
