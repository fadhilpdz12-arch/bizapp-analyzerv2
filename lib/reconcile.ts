import { Order } from "./types";

export type ReconStatus =
  | "padan" // matched to a Bizapp order, amount agrees
  | "beza" // matched, but the amount differs
  | "tiada-bizapp"; // payment received with no matching Bizapp order

export interface ReconRow {
  status: ReconStatus;
  paidAt: string; // as it appeared in the payment record
  customerName: string;
  phone: string;
  paidAmount: number | null;
  // Filled in from Bizapp when a match is found
  seller: string;
  trackingNo: string;
  bizappAmount: number | null;
  bizappProduct: string;
  orderStatus: string;
  difference: number | null; // paid - bizapp
  matchedBy: "telefon" | "nama" | "—";
}

export interface ReconSummary {
  totalRows: number;
  matched: number;
  mismatched: number;
  unmatched: number;
  totalPaid: number;
  totalBizapp: number;
  netDifference: number;
  shortfall: number;
  overpaid: number;
  autoFilledSeller: number;
  autoFilledTracking: number;
}

export interface ReconResult {
  rows: ReconRow[];
  summary: ReconSummary;
  warnings: string[];
}

/**
 * Malaysian mobile numbers arrive in many shapes across systems:
 * "60193040942", "0193040942", "019-304 0942", "193040942".
 * Reducing every form to the same core digits lets them be compared.
 */
export function canonicalPhone(raw: string): string {
  let d = (raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("60")) d = d.slice(2);
  while (d.startsWith("0")) d = d.slice(1);
  if (d.length < 8 || d.length > 11) return "";
  return d;
}

function normName(s: string): string {
  return (s || "")
    .toUpperCase()
    .replace(/[^A-Z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function toAmount(raw: string): number | null {
  if (!raw) return null;
  const negative = /^\(.*\)$/.test(raw.trim());
  const cleaned = raw.replace(/[^\d.-]/g, "");
  if (!cleaned) return null;
  const n = parseFloat(cleaned);
  if (!Number.isFinite(n)) return null;
  return negative ? -Math.abs(n) : n;
}

function looksLikeDateCell(s: string): boolean {
  return /\d{4}-\d{2}-\d{2}/.test(s) || /\d{1,2}\/\d{1,2}\/\d{2,4}/.test(s);
}

/** Splits pasted text: Excel gives tabs, CSV gives commas. */
export function splitPastedRows(text: string): string[][] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.trim().length > 0)
    .map((line) => {
      if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
      if (line.includes(",")) return line.split(",").map((c) => c.trim());
      return line.split(/\s{2,}/).map((c) => c.trim());
    });
}

export interface PaymentEntry {
  paidAt: string;
  customerName: string;
  phone: string;
  amount: number | null;
}

interface ColIdx {
  date?: number;
  name?: number;
  phone?: number;
  amount?: number;
}

function detectColumns(rows: string[][]): { cols: ColIdx; headerRow: number } {
  // Prefer an explicit header row when present.
  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const cols: ColIdx = {};
    rows[i].forEach((cell, j) => {
      const h = cell.toUpperCase().replace(/\s+/g, " ").trim();
      if (!h) return;
      if (h.includes("PHONE") || h.includes("TELEFON") || h.includes("NO H/P")) cols.phone = j;
      else if (h.includes("AMOUNT") || h.includes("AMAUN") || h.includes("JUMLAH")) cols.amount = j;
      else if (h.includes("CUSTOMER") || h.includes("NAMA") || h.includes("NAME")) cols.name = j;
      else if (h === "AT" || h.includes("DATE") || h.includes("TARIKH") || h.includes("MASA"))
        cols.date = j;
    });
    if (cols.phone !== undefined && cols.amount !== undefined) {
      return { cols, headerRow: i };
    }
  }

  // No usable header — infer from the shape of the data itself.
  const cols: ColIdx = {};
  const width = Math.max(...rows.map((r) => r.length), 0);
  let bestPhone = -1, bestPhoneHits = 0;
  let bestName = -1, bestNameHits = 0;
  let bestDate = -1, bestDateHits = 0;

  for (let j = 0; j < width; j++) {
    let phoneHits = 0, nameHits = 0, dateHits = 0;
    for (const r of rows) {
      const c = r[j] ?? "";
      if (!c) continue;
      if (canonicalPhone(c)) phoneHits++;
      if (/[A-Za-z]{3,}/.test(c) && !looksLikeDateCell(c)) nameHits++;
      if (looksLikeDateCell(c)) dateHits++;
    }
    if (phoneHits > bestPhoneHits) { bestPhoneHits = phoneHits; bestPhone = j; }
    if (nameHits > bestNameHits) { bestNameHits = nameHits; bestName = j; }
    if (dateHits > bestDateHits) { bestDateHits = dateHits; bestDate = j; }
  }

  let bestAmount = -1, bestAmountHits = 0;
  for (let j = 0; j < width; j++) {
    if (j === bestPhone) continue;
    let amountHits = 0;
    for (const r of rows) {
      const c = r[j] ?? "";
      if (!c) continue;
      const n = toAmount(c);
      if (n !== null && n > 0 && n < 100000 && !looksLikeDateCell(c) && !canonicalPhone(c))
        amountHits++;
    }
    if (amountHits > bestAmountHits) { bestAmountHits = amountHits; bestAmount = j; }
  }

  if (bestPhone >= 0) cols.phone = bestPhone;
  if (bestAmount >= 0) cols.amount = bestAmount;
  if (bestName >= 0) cols.name = bestName;
  if (bestDate >= 0) cols.date = bestDate;
  return { cols, headerRow: -1 };
}

export function extractPayments(rows: string[][]): {
  entries: PaymentEntry[];
  warnings: string[];
} {
  const warnings: string[] = [];
  if (rows.length === 0) return { entries: [], warnings: ["Tiada data dikesan."] };

  const { cols, headerRow } = detectColumns(rows);

  if (cols.phone === undefined && cols.name === undefined) {
    return {
      entries: [],
      warnings: ["Tiada kolum telefon atau nama customer dikesan. Semak semula data."],
    };
  }
  if (cols.amount === undefined) {
    warnings.push("Tiada kolum amaun dikesan — perbandingan amaun tidak dapat dibuat.");
  }

  const entries: PaymentEntry[] = [];
  let skipped = 0;

  rows.forEach((row, i) => {
    if (i === headerRow) return;
    const phone = cols.phone !== undefined ? row[cols.phone] ?? "" : "";
    const name = cols.name !== undefined ? row[cols.name] ?? "" : "";
    const amount = cols.amount !== undefined ? toAmount(row[cols.amount] ?? "") : null;

    if (!canonicalPhone(phone) && !normName(name)) {
      skipped++;
      return;
    }
    entries.push({
      paidAt: cols.date !== undefined ? row[cols.date] ?? "" : "",
      customerName: name,
      phone,
      amount,
    });
  });

  if (skipped > 0) {
    warnings.push(`${skipped} baris dilangkau (tiada telefon atau nama yang boleh dipadankan).`);
  }

  return { entries, warnings };
}

const TOLERANCE = 0.01;

export function reconcile(orders: Order[], entries: PaymentEntry[]): ReconResult {
  const warnings: string[] = [];

  const byPhone = new Map<string, Order[]>();
  const byName = new Map<string, Order[]>();
  for (const o of orders) {
    const p = canonicalPhone(o.phone);
    if (p) {
      if (!byPhone.has(p)) byPhone.set(p, []);
      byPhone.get(p)!.push(o);
    }
    const n = normName(o.customerName);
    if (n) {
      if (!byName.has(n)) byName.set(n, []);
      byName.get(n)!.push(o);
    }
  }

  // A customer can have several orders. Pick the one whose amount agrees; if
  // none does, fall back to the first so the difference is still surfaced.
  const choose = (candidates: Order[], paid: number | null): Order => {
    if (paid !== null) {
      const exact = candidates.find((o) => Math.abs(o.amount - paid) <= TOLERANCE);
      if (exact) return exact;
    }
    return candidates[0];
  };

  const used = new Set<Order>();
  const rows: ReconRow[] = [];

  for (const entry of entries) {
    const phoneKey = canonicalPhone(entry.phone);
    const nameKey = normName(entry.customerName);

    let candidates = phoneKey ? byPhone.get(phoneKey) ?? [] : [];
    let matchedBy: ReconRow["matchedBy"] = "telefon";

    if (candidates.length === 0 && nameKey) {
      candidates = byName.get(nameKey) ?? [];
      matchedBy = "nama";
    }

    const free = candidates.filter((o) => !used.has(o));
    const pool = free.length ? free : candidates;

    if (pool.length === 0) {
      rows.push({
        status: "tiada-bizapp",
        paidAt: entry.paidAt,
        customerName: entry.customerName,
        phone: entry.phone,
        paidAmount: entry.amount,
        seller: "—",
        trackingNo: "—",
        bizappAmount: null,
        bizappProduct: "—",
        orderStatus: "—",
        difference: null,
        matchedBy: "—",
      });
      continue;
    }

    const order = choose(pool, entry.amount);
    used.add(order);

    const diff =
      entry.amount === null ? null : Math.round((entry.amount - order.amount) * 100) / 100;
    const same = diff !== null && Math.abs(diff) <= TOLERANCE;

    rows.push({
      status: same ? "padan" : "beza",
      paidAt: entry.paidAt,
      customerName: entry.customerName || order.customerName,
      phone: entry.phone,
      paidAmount: entry.amount,
      seller: order.agent || "—",
      trackingNo: order.trackingNo || "—",
      bizappAmount: order.amount,
      bizappProduct: order.product,
      orderStatus: order.status,
      difference: diff,
      matchedBy,
    });
  }

  const rank: Record<ReconStatus, number> = { beza: 0, "tiada-bizapp": 1, padan: 2 };
  rows.sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    return Math.abs(b.difference ?? 0) - Math.abs(a.difference ?? 0);
  });

  const round = (n: number) => Math.round(n * 100) / 100;
  const sum = (arr: number[]) => arr.reduce((s, n) => s + n, 0);

  const matchedRows = rows.filter((r) => r.status === "padan");
  const mismatchedRows = rows.filter((r) => r.status === "beza");
  const unmatchedRows = rows.filter((r) => r.status === "tiada-bizapp");
  const diffs = mismatchedRows.map((r) => r.difference ?? 0);

  const summary: ReconSummary = {
    totalRows: rows.length,
    matched: matchedRows.length,
    mismatched: mismatchedRows.length,
    unmatched: unmatchedRows.length,
    totalPaid: round(sum(rows.map((r) => r.paidAmount ?? 0))),
    totalBizapp: round(sum([...matchedRows, ...mismatchedRows].map((r) => r.bizappAmount ?? 0))),
    netDifference: round(sum(diffs)),
    shortfall: round(sum(diffs.filter((d) => d < 0))),
    overpaid: round(sum(diffs.filter((d) => d > 0))),
    autoFilledSeller: rows.filter((r) => r.seller !== "—").length,
    autoFilledTracking: rows.filter((r) => r.trackingNo !== "—").length,
  };

  if (summary.unmatched > 0) {
    warnings.push(
      `${summary.unmatched} bayaran tiada order sepadan dalam Bizapp — mungkin order bulan lain, atau nombor telefon berbeza.`
    );
  }

  return { rows, summary, warnings };
}

/** Builds a tab-separated block the admin can paste straight back into Sheets. */
export function toTSV(rows: ReconRow[]): string {
  const header = [
    "At",
    "Customer Name",
    "Customer Phone Number",
    "Amount",
    "SELLER",
    "TRACKING",
    "Bizapp Amount",
    "Beza",
    "Status",
  ].join("\t");

  const body = rows.map((r) =>
    [
      r.paidAt,
      r.customerName,
      r.phone,
      r.paidAmount ?? "",
      r.seller === "—" ? "" : r.seller,
      r.trackingNo === "—" ? "" : r.trackingNo,
      r.bizappAmount ?? "",
      r.difference ?? "",
      r.status === "padan" ? "PADAN" : r.status === "beza" ? "BEZA" : "TIADA DI BIZAPP",
    ].join("\t")
  );

  return [header, ...body].join("\n");
}
