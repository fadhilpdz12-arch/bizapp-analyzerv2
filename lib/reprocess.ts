import { Order } from "./types";

/**
 * Follow-up tracking for returned orders.
 *
 * The analyser itself is stateless — upload, read, close. Reprocessing is the
 * opposite: it only works if the app remembers who has already been contacted.
 * That state lives in localStorage keyed by tracking number, and can be
 * exported to a file so several people on different machines can share it.
 */

export type ReprocessStatus =
  | "Belum Hubungi"
  | "Cuba Hubungi"
  | "Berjaya Re-order"
  | "Tolak"
  | "Tak Dapat Dihubungi";

export const STATUSES: ReprocessStatus[] = [
  "Belum Hubungi",
  "Cuba Hubungi",
  "Berjaya Re-order",
  "Tolak",
  "Tak Dapat Dihubungi",
];

/** The part an admin edits. Keyed by tracking number. */
export interface TrackingState {
  status: ReprocessStatus;
  /** ISO date of the last contact attempt. */
  contactedAt?: string;
  /** Value of the replacement order, when one was placed. */
  reorderAmount?: number;
  reorderUnits?: number;
  reorderDate?: string;
  handledBy?: string;
  note?: string;
  updatedAt: string;
}

/** A row in the work list: order facts plus whatever tracking exists. */
export interface ReprocessRow {
  trackingNo: string;
  customerName: string;
  phone: string;
  product: string;
  originalAmount: number;
  quantity: number;
  agent: string;
  returnReason: string;
  region: string;
  orderDate: Date | null;
  state: TrackingState;
}

export interface ReprocessSummary {
  total: number;
  processed: number;
  pending: number;
  reorder: number;
  declined: number;
  unreachable: number;
  recoveredSales: number;
  recoveredUnits: number;
  lostValue: number;
  recoveryRate: number; // reorder / total
  contactRate: number; // processed / total
  /** Average value of a successful re-order. */
  avgReorderValue: number;
}

export interface ReasonRecovery {
  reason: string;
  total: number;
  reorder: number;
  rate: number;
  recovered: number;
}

export interface ProductRecovery {
  product: string;
  total: number;
  reorder: number;
  recovered: number;
  rate: number;
}

const STORE_KEY = "bizapp-reprocess-v1";

function nowISO(): string {
  return new Date().toISOString();
}

export function blankState(): TrackingState {
  return { status: "Belum Hubungi", updatedAt: nowISO() };
}

// ── Persistence ────────────────────────────────────────────────────────────

export function loadTracking(): Record<string, TrackingState> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    // Corrupt or unavailable storage shouldn't break the page.
    return {};
  }
}

export function saveTracking(map: Record<string, TrackingState>): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

// ── Work list ──────────────────────────────────────────────────────────────

/** Tracking numbers are the join key; normalise the same way on both sides. */
function key(t: string): string {
  return (t || "").replace(/\s+/g, "").toUpperCase();
}

export function buildWorkList(
  orders: Order[],
  tracking: Record<string, TrackingState>
): ReprocessRow[] {
  const rows: ReprocessRow[] = [];
  const seen = new Set<string>();

  for (const o of orders) {
    if (o.status !== "RETURN") continue;
    const k = key(o.trackingNo);
    // Cancelled rows carry "BATAL" instead of a real tracking number.
    if (!k || k === "BATAL" || seen.has(k)) continue;
    seen.add(k);

    rows.push({
      trackingNo: o.trackingNo,
      customerName: o.customerName,
      phone: o.phone,
      product: o.product,
      originalAmount: o.amount,
      quantity: o.quantity,
      agent: o.agent,
      returnReason: o.failReason || "Tiada Maklumat",
      region: o.region,
      orderDate: o.orderDate,
      state: tracking[k] ?? blankState(),
    });
  }

  // Untouched rows first — that's the queue of work still to do.
  const rank: Record<ReprocessStatus, number> = {
    "Belum Hubungi": 0,
    "Cuba Hubungi": 1,
    "Tak Dapat Dihubungi": 2,
    "Tolak": 3,
    "Berjaya Re-order": 4,
  };
  rows.sort((a, b) => {
    const d = rank[a.state.status] - rank[b.state.status];
    if (d !== 0) return d;
    return b.originalAmount - a.originalAmount;
  });

  return rows;
}

// ── Metrics ────────────────────────────────────────────────────────────────

const round2 = (n: number) => Math.round(n * 100) / 100;
const pct = (n: number, d: number) => (d === 0 ? 0 : Math.round((n / d) * 1000) / 10);

export function summarise(rows: ReprocessRow[]): ReprocessSummary {
  const total = rows.length;
  const pending = rows.filter((r) => r.state.status === "Belum Hubungi").length;
  const reorderRows = rows.filter((r) => r.state.status === "Berjaya Re-order");
  const declined = rows.filter((r) => r.state.status === "Tolak").length;
  const unreachable = rows.filter((r) => r.state.status === "Tak Dapat Dihubungi").length;

  const recoveredSales = reorderRows.reduce(
    (s, r) => s + (r.state.reorderAmount ?? r.originalAmount),
    0
  );
  const recoveredUnits = reorderRows.reduce(
    (s, r) => s + (r.state.reorderUnits ?? r.quantity),
    0
  );
  const lostValue = rows
    .filter((r) => r.state.status === "Tolak" || r.state.status === "Tak Dapat Dihubungi")
    .reduce((s, r) => s + r.originalAmount, 0);

  return {
    total,
    processed: total - pending,
    pending,
    reorder: reorderRows.length,
    declined,
    unreachable,
    recoveredSales: round2(recoveredSales),
    recoveredUnits,
    lostValue: round2(lostValue),
    recoveryRate: pct(reorderRows.length, total),
    contactRate: pct(total - pending, total),
    avgReorderValue: reorderRows.length
      ? round2(recoveredSales / reorderRows.length)
      : 0,
  };
}

/** Which return reasons actually convert back into sales. */
export function recoveryByReason(rows: ReprocessRow[]): ReasonRecovery[] {
  const map = new Map<string, ReprocessRow[]>();
  for (const r of rows) {
    if (!map.has(r.returnReason)) map.set(r.returnReason, []);
    map.get(r.returnReason)!.push(r);
  }
  return Array.from(map.entries())
    .map(([reason, list]) => {
      const won = list.filter((r) => r.state.status === "Berjaya Re-order");
      return {
        reason,
        total: list.length,
        reorder: won.length,
        rate: pct(won.length, list.length),
        recovered: round2(
          won.reduce((s, r) => s + (r.state.reorderAmount ?? r.originalAmount), 0)
        ),
      };
    })
    .sort((a, b) => b.total - a.total);
}

export function recoveryByProduct(rows: ReprocessRow[]): ProductRecovery[] {
  const map = new Map<string, ReprocessRow[]>();
  for (const r of rows) {
    if (!map.has(r.product)) map.set(r.product, []);
    map.get(r.product)!.push(r);
  }
  return Array.from(map.entries())
    .map(([product, list]) => {
      const won = list.filter((r) => r.state.status === "Berjaya Re-order");
      return {
        product,
        total: list.length,
        reorder: won.length,
        rate: pct(won.length, list.length),
        recovered: round2(
          won.reduce((s, r) => s + (r.state.reorderAmount ?? r.originalAmount), 0)
        ),
      };
    })
    .sort((a, b) => b.recovered - a.recovered || b.total - a.total);
}

export function statusBreakdown(rows: ReprocessRow[]) {
  return STATUSES.map((status) => ({
    status,
    count: rows.filter((r) => r.state.status === status).length,
  })).filter((s) => s.count > 0);
}

// ── Sharing between machines ───────────────────────────────────────────────

export interface TrackingFile {
  app: "bizapp-analyzer";
  kind: "reprocess-tracking";
  version: 1;
  exportedAt: string;
  records: Record<string, TrackingState>;
}

export function exportTracking(map: Record<string, TrackingState>): string {
  const payload: TrackingFile = {
    app: "bizapp-analyzer",
    kind: "reprocess-tracking",
    version: 1,
    exportedAt: nowISO(),
    records: map,
  };
  return JSON.stringify(payload, null, 2);
}

export interface ImportResult {
  ok: boolean;
  message: string;
  merged?: Record<string, TrackingState>;
  added?: number;
  updated?: number;
}

/**
 * Merges an exported file into the current tracking map.
 * When both sides know a tracking number, the newer edit wins — that keeps two
 * people working in parallel from overwriting each other's latest work.
 */
export function importTracking(
  json: string,
  current: Record<string, TrackingState>
): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, message: "Fail ini bukan fail jejak yang sah (JSON rosak)." };
  }

  const file = parsed as Partial<TrackingFile>;
  if (file?.kind !== "reprocess-tracking" || typeof file.records !== "object") {
    return { ok: false, message: "Fail ini bukan fail jejak Reprocess." };
  }

  const merged = { ...current };
  let added = 0;
  let updated = 0;

  for (const [k, incoming] of Object.entries(file.records as Record<string, TrackingState>)) {
    const existing = merged[k];
    if (!existing) {
      merged[k] = incoming;
      added += 1;
      continue;
    }
    if ((incoming.updatedAt ?? "") > (existing.updatedAt ?? "")) {
      merged[k] = incoming;
      updated += 1;
    }
  }

  return {
    ok: true,
    message: `${added} rekod baharu, ${updated} dikemas kini.`,
    merged,
    added,
    updated,
  };
}

export { key as trackingKey };
