"use client";

/**
 * Follow-up on stalled parcels.
 *
 * These are different from returns: the parcel is still in transit, so the
 * outcomes are about whether it can still be saved — not whether the customer
 * re-ordered. Kept in its own store so the two never overwrite each other.
 */

export type RiskStatus =
  | "Belum Hubungi"
  | "Confirmation Reply"
  | "Confirmation Tidak Reply"
  | "Dah Hubungi — Akan Terima"
  | "Minta Hantar Semula"
  | "Cancel Order"
  | "Tak Dapat Dihubungi"
  | "Selamat — Sampai";

export const RISK_STATUSES: RiskStatus[] = [
  "Belum Hubungi",
  "Confirmation Reply",
  "Confirmation Tidak Reply",
  "Dah Hubungi — Akan Terima",
  "Minta Hantar Semula",
  "Cancel Order",
  "Tak Dapat Dihubungi",
  "Selamat — Sampai",
];

export interface RiskRecord {
  status: RiskStatus;
  contactedAt?: string;
  note?: string;
  handledBy?: string;
  updatedAt: string;
}

const STORE_KEY = "bizapp-risk-followup-v1";

export function blankRisk(): RiskRecord {
  return { status: "Belum Hubungi", updatedAt: new Date().toISOString() };
}

export function riskKey(tracking: string): string {
  return (tracking || "").replace(/\s+/g, "").toUpperCase();
}

export function loadRisk(): Record<string, RiskRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveRisk(map: Record<string, RiskRecord>): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export interface RiskSummary {
  total: number;
  pending: number;
  contacted: number;
  saved: number;
  unreachable: number;
  cancelled: number;
  savedValue: number;
  pendingValue: number;
  cancelledValue: number;
}

export function summariseRisk(
  parcels: { trackingNo: string; amount: number }[],
  map: Record<string, RiskRecord>
): RiskSummary {
  let pending = 0;
  let contacted = 0;
  let saved = 0;
  let unreachable = 0;
  let cancelled = 0;
  let savedValue = 0;
  let pendingValue = 0;
  let cancelledValue = 0;

  for (const p of parcels) {
    const rec = map[riskKey(p.trackingNo)];
    const status = rec?.status ?? "Belum Hubungi";
    if (status === "Belum Hubungi") {
      pending += 1;
      pendingValue += p.amount;
    } else if (status === "Selamat — Sampai") {
      saved += 1;
      savedValue += p.amount;
    } else if (status === "Cancel Order") {
      cancelled += 1;
      cancelledValue += p.amount;
    } else if (status === "Tak Dapat Dihubungi") {
      unreachable += 1;
    } else {
      contacted += 1;
    }
  }

  return {
    total: parcels.length,
    pending,
    contacted,
    saved,
    unreachable,
    cancelled,
    savedValue: Math.round(savedValue),
    pendingValue: Math.round(pendingValue),
    cancelledValue: Math.round(cancelledValue),
  };
}
