"use client";

/**
 * Manual return causes.
 *
 * The courier only tells us the mechanical outcome — "RTO Success", "Return
 * Success". It never says *why* the customer didn't take the parcel. Only the
 * admin knows that, after making the call. Tagging that reason is what turns
 * a pile of returns into something the business can actually fix.
 */

export interface CauseRecord {
  cause: string;
  note?: string;
  taggedBy?: string;
  updatedAt: string;
}

const STORE_KEY = "bizapp-return-cause-v1";
const CUSTOM_KEY = "bizapp-return-cause-list-v1";

/**
 * Starting list. Every business leaks differently, so admins can add their own
 * — these are just the ones that come up most.
 */
export const DEFAULT_CAUSES = [
  "Confirmation Reply/Done Reminder",
  "Confirmation Tidak Reply/Done Reminder",
  "Whatsapp Tidak Reply/Done Reminder",
  "Done Reminder",
  "Confirmation Reply",
  "Confirmation Tidak Reply",
  "Cancel Order",
  "Joy Buyers",
  "Tiada Inform Dari Rider",
  "Lain-lain",
] as const;

/** Causes that mean the order was never real — worth separating out. */
export const FAKE_ORDER_CAUSES = new Set(["Joy Buyers"]);

/** Causes the courier or delivery process caused, not the customer. */
export const DELIVERY_CAUSES = new Set(["Tiada Inform Dari Rider"]);

// ── Cause list (default + custom) ───────────────────────────────────────────

export function loadCauses(): string[] {
  if (typeof window === "undefined") return [...DEFAULT_CAUSES];
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const custom: string[] = raw ? JSON.parse(raw) : [];
    // "Lain-lain" always sits last so the list reads as a menu with an escape
    // hatch at the bottom.
    const base = DEFAULT_CAUSES.filter((c) => c !== "Lain-lain");
    return [...base, ...custom.filter((c) => !base.includes(c as never)), "Lain-lain"];
  } catch {
    return [...DEFAULT_CAUSES];
  }
}

export function addCause(name: string): string[] {
  const clean = name.trim();
  if (!clean) return loadCauses();
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const custom: string[] = raw ? JSON.parse(raw) : [];
    if (!custom.includes(clean) && !DEFAULT_CAUSES.includes(clean as never)) {
      custom.push(clean);
      localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
    }
  } catch {
    /* the cause still applies for this session */
  }
  return loadCauses();
}

export function removeCause(name: string): string[] {
  try {
    const raw = localStorage.getItem(CUSTOM_KEY);
    const custom: string[] = raw ? JSON.parse(raw) : [];
    localStorage.setItem(
      CUSTOM_KEY,
      JSON.stringify(custom.filter((c) => c !== name))
    );
  } catch {
    /* ignore */
  }
  return loadCauses();
}

// ── Tag storage ─────────────────────────────────────────────────────────────

export function loadCauseMap(): Record<string, CauseRecord> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export function saveCauseMap(map: Record<string, CauseRecord>): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(map));
    return true;
  } catch {
    return false;
  }
}

export function causeKey(tracking: string): string {
  return (tracking || "").replace(/\s+/g, "").toUpperCase();
}

// ── Analytics ───────────────────────────────────────────────────────────────

export interface CauseStat {
  cause: string;
  count: number;
  value: number;
  pct: number;
  /** Which product this cause hits hardest. */
  topProduct: string;
}

export interface TaggedOrder {
  trackingNo: string;
  product: string;
  amount: number;
  region: string;
  agent: string;
  cause: string;
}

export function summariseCauses(tagged: TaggedOrder[]): CauseStat[] {
  const byCause = new Map<string, TaggedOrder[]>();
  for (const t of tagged) {
    if (!byCause.has(t.cause)) byCause.set(t.cause, []);
    byCause.get(t.cause)!.push(t);
  }
  const total = tagged.length;

  return Array.from(byCause.entries())
    .map(([cause, list]) => {
      const byProduct = new Map<string, number>();
      for (const t of list) {
        byProduct.set(t.product, (byProduct.get(t.product) ?? 0) + 1);
      }
      const topProduct =
        Array.from(byProduct.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "—";

      return {
        cause,
        count: list.length,
        value: Math.round(list.reduce((s, t) => s + t.amount, 0)),
        pct: total ? Math.round((list.length / total) * 1000) / 10 : 0,
        topProduct,
      };
    })
    .sort((a, b) => b.count - a.count);
}

export interface CauseGroups {
  fakeOrders: number;
  fakeValue: number;
  delivery: number;
  deliveryValue: number;
  customer: number;
  customerValue: number;
}

/**
 * Groups causes by who can actually fix them — the split that decides what to
 * do next: tighten the order form, change courier, or improve follow-up.
 */
export function groupCauses(tagged: TaggedOrder[]): CauseGroups {
  const g: CauseGroups = {
    fakeOrders: 0,
    fakeValue: 0,
    delivery: 0,
    deliveryValue: 0,
    customer: 0,
    customerValue: 0,
  };
  for (const t of tagged) {
    if (FAKE_ORDER_CAUSES.has(t.cause)) {
      g.fakeOrders += 1;
      g.fakeValue += t.amount;
    } else if (DELIVERY_CAUSES.has(t.cause)) {
      g.delivery += 1;
      g.deliveryValue += t.amount;
    } else {
      g.customer += 1;
      g.customerValue += t.amount;
    }
  }
  g.fakeValue = Math.round(g.fakeValue);
  g.deliveryValue = Math.round(g.deliveryValue);
  g.customerValue = Math.round(g.customerValue);
  return g;
}

// ── Sharing ─────────────────────────────────────────────────────────────────

export interface CauseFile {
  app: "bizapp-analyzer";
  kind: "return-causes";
  version: 1;
  exportedAt: string;
  records: Record<string, CauseRecord>;
  customCauses: string[];
}

export function exportCauses(map: Record<string, CauseRecord>): string {
  let custom: string[] = [];
  try {
    custom = JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? "[]");
  } catch {
    custom = [];
  }
  const payload: CauseFile = {
    app: "bizapp-analyzer",
    kind: "return-causes",
    version: 1,
    exportedAt: new Date().toISOString(),
    records: map,
    customCauses: custom,
  };
  return JSON.stringify(payload, null, 2);
}

export interface CauseImportResult {
  ok: boolean;
  message: string;
  merged?: Record<string, CauseRecord>;
}

export function importCauses(
  json: string,
  current: Record<string, CauseRecord>
): CauseImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, message: "Fail ini bukan fail sebab return yang sah." };
  }
  const file = parsed as Partial<CauseFile>;
  if (file?.kind !== "return-causes" || typeof file.records !== "object") {
    return { ok: false, message: "Fail ini bukan fail sebab return." };
  }

  const merged = { ...current };
  let added = 0;
  let updated = 0;
  for (const [k, incoming] of Object.entries(
    file.records as Record<string, CauseRecord>
  )) {
    const existing = merged[k];
    if (!existing) {
      merged[k] = incoming;
      added += 1;
    } else if ((incoming.updatedAt ?? "") > (existing.updatedAt ?? "")) {
      merged[k] = incoming;
      updated += 1;
    }
  }

  // Bring across any custom causes the other machine had defined.
  if (Array.isArray(file.customCauses)) {
    for (const c of file.customCauses) addCause(c);
  }

  return {
    ok: true,
    message: `${added} tag baharu, ${updated} dikemas kini.`,
    merged,
  };
}
