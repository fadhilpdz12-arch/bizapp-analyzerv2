import { Order } from "./types";
import { ReprocessRow } from "./reprocess";

/**
 * Deciding which returned customers to call first.
 *
 * With hundreds of returns and a few hours a day, the order of the call list
 * is what determines how much money comes back. This scores each return on
 * how recoverable it looks and how much it's worth, and — importantly — says
 * *why*, so an admin can trust or override it.
 */

export interface WinBackFactor {
  label: string;
  /** Points contributed. Negative means it pushed the priority down. */
  points: number;
}

export interface WinBackLead extends ReprocessRow {
  score: number;
  /** Expected recoverable ringgit = value × probability. */
  expectedValue: number;
  factors: WinBackFactor[];
  isRepeatCustomer: boolean;
  isSerialReturner: boolean;
  daysSinceReturn: number | null;
  waLink: string;
}

/**
 * How often each return reason converts back into a sale.
 *
 * These are starting estimates: a parcel that was never collected is a much
 * warmer lead than one the customer actively refused. Once the team logs real
 * outcomes, the observed rate replaces the estimate (see blendedRates).
 */
const REASON_BASE: Record<string, number> = {
  "RTO Success (Auto Return)": 0.35,
  "Return Success (Manual Return)": 0.3,
  "Recipient Not Available": 0.45,
  "Missed Delivery Card": 0.45,
  "Rescheduled Delivery": 0.4,
  "Arrival Exception": 0.35,
  "Delivery Failed": 0.35,
  "Recipient Refused": 0.12,
  "Force Majeure": 0.3,
};
const REASON_DEFAULT = 0.25;

/**
 * Blends the estimate with what actually happened, weighted by how much
 * evidence exists. With few logged outcomes the estimate dominates; once a
 * reason has been worked dozens of times, reality takes over.
 */
export function blendedRates(rows: ReprocessRow[]): Record<string, number> {
  const out: Record<string, number> = {};
  const byReason = new Map<string, ReprocessRow[]>();

  for (const r of rows) {
    if (!byReason.has(r.returnReason)) byReason.set(r.returnReason, []);
    byReason.get(r.returnReason)!.push(r);
  }

  for (const [reason, list] of byReason) {
    const base = REASON_BASE[reason] ?? REASON_DEFAULT;
    const worked = list.filter((r) => r.state.status !== "Belum Hubungi");
    const won = list.filter((r) => r.state.status === "Berjaya Re-order");

    if (worked.length === 0) {
      out[reason] = base;
      continue;
    }
    const observed = won.length / worked.length;
    // Confidence grows with sample size, capped so the prior never vanishes
    // entirely on a small run of luck.
    const weight = Math.min(worked.length / 30, 0.8);
    out[reason] = base * (1 - weight) + observed * weight;
  }

  return out;
}

/** Turns a local phone into the digits wa.me expects (no plus, country code). */
export function waNumber(phone: string): string {
  let d = (phone || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("60")) return d;
  if (d.startsWith("0")) return `60${d.slice(1)}`;
  // Bare subscriber digits, e.g. "123456789"
  return `60${d}`;
}

export function waLink(phone: string, message: string): string {
  const num = waNumber(phone);
  if (!num) return "";
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

/**
 * Fills the placeholders a promo script can use.
 * Unknown placeholders are left alone rather than blanked, so a typo is
 * visible instead of silently producing an odd-looking message.
 */
export function renderScript(
  template: string,
  vars: Record<string, string>
): string {
  if (!template) return "";
  return template.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? vars[name] : whole
  );
}

export const SCRIPT_TOKENS = [
  "{nama}",
  "{produk}",
  "{harga}",
  "{tracking}",
  "{sebab}",
];

const DEFAULT_SCRIPT =
  "Salam {nama}, saya dari Meldoria. Kami perasan parcel {produk} " +
  "tak sempat sampai kepada anda dan telah dipulangkan. " +
  "Kami boleh hantar semula — nak saya uruskan?";

export interface BuildLeadsOptions {
  rows: ReprocessRow[];
  allOrders: Order[];
  /** Script template from the active promo plan, if any. */
  script?: string;
  /** Reference point for recency; injected for testability. */
  today?: Date;
}

export function buildLeads({
  rows,
  allOrders,
  script,
  today = new Date(),
}: BuildLeadsOptions): WinBackLead[] {
  const rates = blendedRates(rows);

  // Order counts per customer, used to spot loyal buyers and serial returners.
  const orderCount = new Map<string, number>();
  const returnCount = new Map<string, number>();
  for (const o of allOrders) {
    if (!o.phoneKey) continue;
    orderCount.set(o.phoneKey, (orderCount.get(o.phoneKey) ?? 0) + 1);
    if (o.status === "RETURN") {
      returnCount.set(o.phoneKey, (returnCount.get(o.phoneKey) ?? 0) + 1);
    }
  }
  const phoneKeyOf = (phone: string) => {
    let d = (phone || "").replace(/\D/g, "");
    if (d.startsWith("60")) d = `0${d.slice(2)}`;
    return d.length >= 9 && d.length <= 12 ? d : "";
  };

  const amounts = rows.map((r) => r.originalAmount).filter((n) => n > 0);
  const maxAmount = amounts.length ? Math.max(...amounts) : 1;

  const leads: WinBackLead[] = rows.map((row) => {
    const factors: WinBackFactor[] = [];
    const pk = phoneKeyOf(row.phone);
    const orders = pk ? orderCount.get(pk) ?? 1 : 1;
    const returns = pk ? returnCount.get(pk) ?? 1 : 1;
    const isRepeat = orders > 1;
    const isSerial = returns >= 3;

    // 1. Value — bigger orders are worth more calling time.
    const valueScore = Math.round((row.originalAmount / maxAmount) * 40);
    factors.push({ label: `Nilai order RM${row.originalAmount}`, points: valueScore });

    // 2. Reason recoverability.
    const rate = rates[row.returnReason] ?? REASON_DEFAULT;
    const reasonScore = Math.round(rate * 35);
    factors.push({
      label: `${row.returnReason} — ${Math.round(rate * 100)}% biasanya pulih`,
      points: reasonScore,
    });

    // 3. Loyalty — someone who bought before will buy again.
    let loyaltyScore = 0;
    if (isRepeat) {
      loyaltyScore = Math.min(orders * 5, 20);
      factors.push({ label: `Customer berulang (${orders} order)`, points: loyaltyScore });
    }

    // 4. Recency — a warm lead cools fast.
    let recencyScore = 0;
    let daysSince: number | null = null;
    if (row.orderDate) {
      daysSince = Math.floor(
        (today.getTime() - row.orderDate.getTime()) / 86400000
      );
      if (daysSince <= 7) recencyScore = 15;
      else if (daysSince <= 14) recencyScore = 10;
      else if (daysSince <= 30) recencyScore = 5;
      else recencyScore = 0;
      if (recencyScore > 0) {
        factors.push({ label: `Baru ${daysSince} hari lalu`, points: recencyScore });
      }
    }

    // 5. Serial returners waste the day.
    let serialPenalty = 0;
    if (isSerial) {
      serialPenalty = -30;
      factors.push({ label: `Return ${returns} kali — risiko tinggi`, points: serialPenalty });
    }

    const score = Math.max(
      0,
      valueScore + reasonScore + loyaltyScore + recencyScore + serialPenalty
    );

    // Probability estimate used for expected value, nudged by loyalty/serial.
    let prob = rate;
    if (isRepeat) prob = Math.min(prob * 1.35, 0.9);
    if (isSerial) prob *= 0.35;

    const message = renderScript(script?.trim() || DEFAULT_SCRIPT, {
      nama: row.customerName || "puan/tuan",
      produk: row.product || "pesanan anda",
      harga: `RM${row.originalAmount}`,
      tracking: row.trackingNo,
      sebab: row.returnReason,
    });

    return {
      ...row,
      score,
      expectedValue: Math.round(row.originalAmount * prob),
      factors: factors.sort((a, b) => Math.abs(b.points) - Math.abs(a.points)),
      isRepeatCustomer: isRepeat,
      isSerialReturner: isSerial,
      daysSinceReturn: daysSince,
      waLink: waLink(row.phone, message),
    };
  });

  return leads.sort((a, b) => b.score - a.score || b.expectedValue - a.expectedValue);
}

/** The untouched leads worth working today, highest value first. */
export function todaysQueue(leads: WinBackLead[], limit = 15): WinBackLead[] {
  return leads.filter((l) => l.state.status === "Belum Hubungi").slice(0, limit);
}

export interface QueueValue {
  count: number;
  totalValue: number;
  expectedValue: number;
}

export function queueValue(queue: WinBackLead[]): QueueValue {
  return {
    count: queue.length,
    totalValue: Math.round(queue.reduce((s, l) => s + l.originalAmount, 0)),
    expectedValue: Math.round(queue.reduce((s, l) => s + l.expectedValue, 0)),
  };
}
