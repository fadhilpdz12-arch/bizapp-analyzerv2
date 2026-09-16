import * as XLSX from "xlsx";
import { Order, OrderStatus, ParsedResult } from "./types";

const STATUS_TOKENS: OrderStatus[] = ["COLLECTED", "RETURN", "PENDING", "BATAL"];

// Keywords that reliably indicate a real product line (checked with word boundaries
// so short keywords like "GEL" don't false-match inside names like "ANGELA").
const STRONG_PRODUCT_KEYWORDS = [
  "PHYTO",
  "COCOA",
  "PACK",
  "KOTAK",
  "TRIAL",
  "JIMAT",
  "COMBO",
  "REPEAT",
  "PELINCIR",
];

const PHONE_RE = /^6?0?1\d{7,9}$/;
const DATE_RE = /^\d{1,2}\/\d{1,2}\/\d{4}/; // dd/mm/yyyy...
const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
const TRACKING_RE = /^[A-Z0-9]{8,20}$/;

function cleanCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function looksLikeProduct(s: string): boolean {
  const upper = s.toUpperCase().trim();
  if (STRONG_PRODUCT_KEYWORDS.some((k) => new RegExp(`\\b${k}\\b`).test(upper))) return true;
  // "MELDORIA" alone is ambiguous — it's both a product name and a tag sometimes
  // appended to customer names (e.g. "AZMAN(MELDORIA)"). Only treat it as a
  // product when it stands alone, or appears together with GEL as a word.
  if (upper === "MELDORIA") return true;
  if (/\bMELDORIA\b/.test(upper) && /\bGEL\b/.test(upper)) return true;
  return false;
}

function looksLikeStatus(s: string): OrderStatus | null {
  const upper = s.toUpperCase().trim();
  if (STATUS_TOKENS.includes(upper as OrderStatus)) return upper as OrderStatus;
  return null;
}

function looksLikeDate(s: string): boolean {
  return DATE_RE.test(s);
}

function parseFlexibleDate(s: string): Date | null {
  if (!s) return null;
  // formats seen: "01/07/2026 12:45 AM"
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
  if (!m) return null;
  const [, dd, mm, yyyy, hh, min, ampm] = m;
  let hour = hh ? parseInt(hh, 10) : 0;
  if (ampm) {
    const upper = ampm.toUpperCase();
    if (upper === "PM" && hour !== 12) hour += 12;
    if (upper === "AM" && hour === 12) hour = 0;
  }
  const d = new Date(
    parseInt(yyyy, 10),
    parseInt(mm, 10) - 1,
    parseInt(dd, 10),
    hour,
    min ? parseInt(min, 10) : 0
  );
  return isNaN(d.getTime()) ? null : d;
}

function looksLikePhone(s: string): boolean {
  const digits = s.replace(/\D/g, "");
  return PHONE_RE.test(digits) && digits.length >= 9 && digits.length <= 13;
}

const NOISE_TOKENS = new Set(["ADA", "TIADA", "-", "NOTA", "N/A", "#N/A"]);

function looksLikeAmount(s: string): boolean {
  if (!s) return false;
  if (looksLikePhone(s)) return false; // phone numbers are all-digit and would otherwise match
  return AMOUNT_RE.test(s);
}

function looksLikeDeliveryMethod(s: string): boolean {
  const upper = s.toUpperCase();
  return upper.includes("POS") || upper.includes("COD") || upper.includes("SELF COLLECT") || upper.includes("COURIER");
}

function looksLikeTracking(s: string): boolean {
  if (s === "BATAL") return true;
  return TRACKING_RE.test(s) && /\d/.test(s);
}

const PARCEL_TIMESTAMP_RE = /\d{4}-\d{2}-\d{2}\s+\d{1,2}:\d{2}/; // e.g. "(2026-07-06 11:27:43)"

function looksLikeAgentOrCustomer(s: string): boolean {
  if (!s) return false;
  if (NOISE_TOKENS.has(s.toUpperCase())) return false;
  if (looksLikeProduct(s)) return false;
  if (looksLikePhone(s)) return false;
  if (looksLikeAmount(s)) return false;
  if (looksLikeDate(s)) return false;
  if (looksLikeDeliveryMethod(s)) return false;
  if (looksLikeStatus(s)) return false;
  if (looksLikeTracking(s)) return false;
  if (PARCEL_TIMESTAMP_RE.test(s)) return false; // parcel-status prose always carries a timestamp
  if (s.length < 1 || s.length > 80) return false;
  return /[A-Za-z]/.test(s);
}

function deriveCourierProvider(tracking: string): string {
  const t = tracking.toUpperCase();
  if (t === "BATAL" || !t) return "-";
  if (t.startsWith("NVMY")) return "Ninja Van";
  if (t.startsWith("SPX")) return "Shopee Xpress";
  if (t.startsWith("EC") || t.startsWith("ERD") || t.endsWith("MY")) return "Pos Laju";
  return "Lain-lain";
}

const FAIL_REASON_PATTERNS: [RegExp, string][] = [
  [/RTO Success/i, "RTO Success (Auto Return)"],
  [/Return Success/i, "Return Success (Manual Return)"],
  [/Arrival Exception/i, "Arrival Exception"],
  [/Out For Delivery|Out for delivery/i, "Out For Delivery"],
  [/Delivery Failed|Delivery Fail\b/i, "Delivery Failed"],
  [/Trip Dispatching/i, "In Transit — Dispatching"],
  [/Window Delivery Assigned/i, "Window Delivery Assigned"],
  [/Window Delivery Success/i, "Window Delivery Success"],
  [/In Linehaul/i, "In Linehaul"],
  [/Recipient not available/i, "Recipient Not Available"],
  [/Recipient refusal to accept/i, "Recipient Refused"],
  [/Rescheduled delivery/i, "Rescheduled Delivery"],
  [/Missed delivery card/i, "Missed Delivery Card"],
  [/Force majeure/i, "Force Majeure"],
  [/Shipment Received At Hub/i, "At Hub — Received"],
  [/Delivery Success|Delivered|Successful Delivery/i, "Delivered"],
];

function deriveFailReason(parcelStatusRaw: string): string {
  if (!parcelStatusRaw) return "Tiada Maklumat";
  for (const [re, label] of FAIL_REASON_PATTERNS) {
    if (re.test(parcelStatusRaw)) return label;
  }
  return "Lain-lain / Belum Diklasifikasi";
}

function deriveRegion(parcelStatusRaw: string): string {
  if (!parcelStatusRaw) return "Tidak Diketahui";
  const m = parcelStatusRaw.match(/(Pusat[^(]+?|DC [^(]+?|Pejabat[^(]+?|HUB[^(]+?|LDC[^(]+?)(?:\(|$)/);
  if (m) {
    return m[1]
      .replace(/\s+/g, " ")
      .replace(/^(Delivered|Delivery Success\.?|Delivery Fail\.?|Delivery Failed\.?|Out For Delivery|Window Delivery (Success|Assigned)|RTO Success\.?|Return Success|Arrival Exception|In Linehaul|Trip Dispatching|Shipment Received At)\s*/i, "")
      .trim();
  }
  return "Tidak Diketahui";
}

const MALAY_MONTHS = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];

function deriveMonth(orderDate: Date | null): { monthKey: string; monthLabel: string } {
  if (!orderDate) return { monthKey: "unknown", monthLabel: "Tarikh Tidak Diketahui" };
  const y = orderDate.getFullYear();
  const m = orderDate.getMonth();
  const monthKey = `${y}-${String(m + 1).padStart(2, "0")}`;
  const monthLabel = `${MALAY_MONTHS[m]} ${y}`;
  return { monthKey, monthLabel };
}

function deriveShipType(deliveryMethod: string): Order["shipType"] {
  const u = deliveryMethod.toUpperCase();
  if (!u.trim()) return "Tidak Diketahui";
  if (/SELF\s*COLLECT/.test(u)) return "Self Collect";
  if (/COD/.test(u)) return "COD Kurier";
  if (/POS|COURIER|KURIER/.test(u)) return "Prepaid";
  return "Tidak Diketahui";
}

function derivePhoneKey(phone: string): string {
  let d = phone.replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("60")) d = "0" + d.slice(2); // normalise +60 prefix
  if (d.length < 9 || d.length > 12) return "";
  return d;
}

// parcel status carries scan events like "(2026-07-18 13:24:11)"; the last one is
// the most recent movement, which anchors both settlement time and stall detection.
function deriveLastScanDate(parcelStatusRaw: string): Date | null {
  if (!parcelStatusRaw) return null;
  const stamps = parcelStatusRaw.match(/\((\d{4})-(\d{2})-(\d{2})\s+\d{2}:\d{2}:\d{2}\)/g);
  if (!stamps || !stamps.length) return null;
  const last = stamps[stamps.length - 1];
  const m = last.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(parseInt(m[1], 10), parseInt(m[2], 10) - 1, parseInt(m[3], 10));
  return isNaN(d.getTime()) ? null : d;
}

function daysBetween(from: Date | null, to: Date | null): number | null {
  if (!from || !to) return null;
  const diff = Math.round((to.getTime() - from.getTime()) / 86400000);
  if (diff < 0 || diff > 180) return null; // guard against bad dates
  return diff;
}

function cleanAgentName(raw: string): string {
  const m = raw.match(/^([^(]+)/);
  return m ? m[1].trim() : raw.trim();
}

/**
 * Bizapp exports come in more than one shape: a narrow ~14-column sheet and a
 * wide ~69-column sheet where the amount/status columns sit far to the right.
 * When a header row is present we map columns by name, which is exact. If no
 * header is found we fall back to the content-sniffing heuristics below.
 */
interface ColumnMap {
  agent?: number;
  customer?: number;
  phone?: number;
  product?: number;
  quantity?: number;
  amount?: number;
  orderDate?: number;
  shipping?: number;
  tracking?: number;
  trackingDate?: number;
  status?: number;
  parcelStatus?: number;
}

function norm(s: string): string {
  return s.toUpperCase().replace(/\s+/g, " ").trim();
}

function detectHeader(row: string[]): ColumnMap | null {
  const map: ColumnMap = {};
  row.forEach((cell, i) => {
    const h = norm(cell);
    if (!h) return;
    if (h === "DIMASUKKAN OLEH") map.agent = i;
    else if (h === "NAMA PELANGGAN") map.customer = i;
    else if (h === "NO H/P") map.phone = i;
    else if (h === "PRODUK") map.product = i;
    else if (h === "KUANTITI") map.quantity = i;
    // Prefer the agent-to-customer price; fall back to other price columns.
    else if (h === "HARGA JUALAN AGEN KEPADA PELANGGAN") map.amount = i;
    else if (h.startsWith("HARGA JUALAN SEBENAR") && map.amount === undefined) map.amount = i;
    else if (h === "HARGA JUALAN PRODUK" && map.amount === undefined) map.amount = i;
    else if (h === "TARIKH TEMPAHAN") map.orderDate = i;
    else if (h === "CARA PENGHANTARAN") map.shipping = i;
    else if (h === "NO. TRACKING" || h === "NO TRACKING") map.tracking = i;
    else if (h.startsWith("TARIKH NO/TRACK")) map.trackingDate = i;
    else if (h === "STATUS PARCEL") map.parcelStatus = i;
    // NOTE: the delivery status column is deliberately NOT taken from the
    // header. Bizapp labels it "KURIER" (the column literally named "STATUS"
    // holds an unrelated "ada"/blank flag), and the two KURIER columns swap
    // positions between exports. It is resolved by content in findStatusColumn.
  });

  // Require the columns we genuinely cannot work without.
  if (map.product === undefined || map.customer === undefined) return null;
  return map;
}

/**
 * Finds the delivery-status column by looking at the data itself: the correct
 * column is the one whose cells are overwhelmingly COLLECTED / RETURN /
 * PENDING / BATAL. This survives Bizapp's mislabelled and reordered headers.
 */
function findStatusColumn(sampleRows: string[][]): number | undefined {
  const hits = new Map<number, number>();
  for (const row of sampleRows) {
    row.forEach((cell, i) => {
      if (looksLikeStatus(cell)) hits.set(i, (hits.get(i) ?? 0) + 1);
    });
  }
  let best: number | undefined;
  let bestCount = 0;
  hits.forEach((count, i) => {
    if (count > bestCount) {
      bestCount = count;
      best = i;
    }
  });
  // Require a meaningful share of the sample so a stray word can't win.
  return bestCount >= Math.max(3, sampleRows.length * 0.2) ? best : undefined;
}

function pick(row: string[], idx?: number): string {
  if (idx === undefined) return "";
  return row[idx] ?? "";
}

function toNumber(s: string): number {
  if (!s) return 0;
  // tolerate "RM 1,090.00", stray spaces, and text-formatted numbers
  const cleaned = s.replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : 0;
}

export function parseWorkbook(fileBuffer: ArrayBuffer, fileName: string): ParsedResult {
  const wb = XLSX.read(fileBuffer, { type: "array", cellDates: false });
  const orders: Order[] = [];
  const warnings: string[] = [];

  for (const sheetName of wb.SheetNames) {
    const sheet = wb.Sheets[sheetName];
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      raw: false,
      defval: "",
      blankrows: false,
    });

    let colMap: ColumnMap | null = null;
    const allRows = rows.map((r) => r.map(cleanCell));

    // Locate the header row, then resolve the status column from the data that
    // follows it before parsing anything.
    const headerIdx = allRows.findIndex((r) => r.some((c) => norm(c) === "DIMASUKKAN OLEH"));
    if (headerIdx >= 0) {
      colMap = detectHeader(allRows[headerIdx]);
      if (colMap) {
        const sample = allRows.slice(headerIdx + 1, headerIdx + 201);
        colMap.status = findStatusColumn(sample);
      }
    }

    for (let rowIdx = 0; rowIdx < allRows.length; rowIdx++) {
      const fullRow = allRows[rowIdx];

      if (fullRow.every((c) => c === "")) continue;
      if (rowIdx === headerIdx) continue;

      // Skip stray header repeats and recap/summary rows
      if (fullRow.some((c) => norm(c) === "DIMASUKKAN OLEH")) continue;
      if (fullRow.some((c) => norm(c) === "QUANTITY" || norm(c) === "BILANGAN CUSTOMER")) continue;
      if (norm(fullRow[0] ?? "") === "STATUS") continue;

      // ---- Header-mapped path (exact) ----
      if (colMap) {
        const product = pick(fullRow, colMap.product);
        const customerName = pick(fullRow, colMap.customer);
        if (!product || !customerName) continue;

        const statusRaw = pick(fullRow, colMap.status);
        const trackingNo = pick(fullRow, colMap.tracking);
        let status = looksLikeStatus(statusRaw);
        if (!status) status = trackingNo.toUpperCase() === "BATAL" ? "BATAL" : "UNKNOWN";

        const orderDate = parseFlexibleDate(pick(fullRow, colMap.orderDate));
        const parcelStatusRaw = pick(fullRow, colMap.parcelStatus);
        const qty = toNumber(pick(fullRow, colMap.quantity));
        const { monthKey, monthLabel } = deriveMonth(orderDate);

        const deliveryMethod = pick(fullRow, colMap.shipping);
        const phone = pick(fullRow, colMap.phone);
        const courierGenerated = parseFlexibleDate(pick(fullRow, colMap.trackingDate));
        const lastScanDate = deriveLastScanDate(parcelStatusRaw);
        const settleGap = daysBetween(courierGenerated, lastScanDate);
        const isResolved = status === "COLLECTED" || status === "RETURN";
        const shipType = deriveShipType(deliveryMethod);

        orders.push({
          agent: cleanAgentName(pick(fullRow, colMap.agent)),
          customerName,
          phone,
          product,
          quantity: qty > 0 ? qty : 1,
          amount: toNumber(pick(fullRow, colMap.amount)),
          orderDate,
          deliveryMethod,
          trackingNo,
          courierGenerated,
          status,
          note: "",
          parcelStatusRaw,
          courierProvider: deriveCourierProvider(trackingNo),
          failReason:
            status === "RETURN" || status === "PENDING" ? deriveFailReason(parcelStatusRaw) : "",
          region: deriveRegion(parcelStatusRaw),
          monthKey,
          monthLabel,
          isCOD: shipType === "COD Kurier",
          shipType,
          phoneKey: derivePhoneKey(phone),
          lastScanDate,
          daysToSettle: isResolved ? settleGap : null,
          daysInTransit: status === "PENDING" ? settleGap : null,
        });
        continue;
      }

      // ---- Heuristic fallback (no header row found) ----
      const row = fullRow.filter((_, idx) => idx < 20);

      let status = looksLikeStatus(row.find((c) => looksLikeStatus(c)) || "");
      const hasProductCell = row.some((c) => looksLikeProduct(c));
      if (!hasProductCell) continue; // not an order row

      const nameCandidates = row.filter((c) => looksLikeAgentOrCustomer(c));
      if (nameCandidates.length < 2) continue; // sub-item breakdown row, skip (no customer)

      const agent = cleanAgentName(nameCandidates[0]);
      const customerName = nameCandidates[1];
      const product = row.find((c) => looksLikeProduct(c)) || "";
      const phone = row.find((c) => looksLikePhone(c)) || "";
      const amounts = row.filter((c) => looksLikeAmount(c) && c !== "");
      const amount = amounts.length ? parseFloat(amounts[amounts.length > 1 ? amounts.length - 1 : 0]) : 0;
      const qtyCandidate = amounts.length > 1 ? parseInt(amounts[0], 10) : 1;
      const quantity = Number.isFinite(qtyCandidate) && qtyCandidate > 0 && qtyCandidate < 50 ? qtyCandidate : 1;
      const dateCells = row.filter((c) => looksLikeDate(c));
      const orderDate = dateCells.length ? parseFlexibleDate(dateCells[0]) : null;
      const courierGenerated = dateCells.length > 1 ? parseFlexibleDate(dateCells[1]) : null;
      const deliveryMethod = row.find((c) => looksLikeDeliveryMethod(c)) || "";
      const trackingNo = row.find((c) => looksLikeTracking(c)) || "";
      const parcelStatusRaw = row.find((c) => c.length > 25 && /\d{4}-\d{2}-\d{2}/.test(c)) || "";

      if (!status) {
        if (trackingNo === "BATAL") status = "BATAL";
        else status = "UNKNOWN";
      }

      const { monthKey, monthLabel } = deriveMonth(orderDate);
      const lastScanDate = deriveLastScanDate(parcelStatusRaw);
      const settleGap = daysBetween(courierGenerated, lastScanDate);
      const isResolved = status === "COLLECTED" || status === "RETURN";

      orders.push({
        agent,
        customerName,
        phone,
        product,
        quantity,
        amount: Number.isFinite(amount) ? amount : 0,
        orderDate,
        deliveryMethod,
        trackingNo,
        courierGenerated,
        status,
        note: "",
        parcelStatusRaw,
        courierProvider: deriveCourierProvider(trackingNo),
        failReason: status === "RETURN" || status === "PENDING" ? deriveFailReason(parcelStatusRaw) : "",
        region: deriveRegion(parcelStatusRaw),
        monthKey,
        monthLabel,
        isCOD: deriveShipType(deliveryMethod) === "COD Kurier",
        shipType: deriveShipType(deliveryMethod),
        phoneKey: derivePhoneKey(phone),
        lastScanDate,
        daysToSettle: isResolved ? settleGap : null,
        daysInTransit: status === "PENDING" ? settleGap : null,
      });
    }
  }

  if (orders.length === 0) {
    warnings.push(
      "Tiada order dapat dikesan dalam fail ini. Pastikan fail export Bizapp asal (ada kolum DIMASUKKAN OLEH, PRODUK, KURIER/STATUS)."
    );
  }

  return { orders, warnings, fileName, fileNames: [fileName], duplicatesRemoved: 0 };
}

/**
 * Merges several parsed files into one dataset.
 *
 * Bizapp exports for adjacent months often overlap (an order placed late in
 * July can appear in both the July and August export), so identical orders are
 * collapsed. Identity is a composite of the fields that together make an order
 * unique, which works across both the narrow and wide export layouts since
 * neither exposes a reliable single ID in every case.
 */
export function mergeParsedResults(results: ParsedResult[]): ParsedResult {
  const orders: Order[] = [];
  const warnings: string[] = [];
  const fileNames: string[] = [];
  const seen = new Set<string>();
  let duplicatesRemoved = 0;

  for (const result of results) {
    fileNames.push(...result.fileNames);
    warnings.push(...result.warnings);

    for (const order of result.orders) {
      const key = [
        order.trackingNo,
        order.orderDate ? order.orderDate.getTime() : "",
        order.customerName,
        order.phoneKey,
        order.product,
        order.amount,
      ]
        .join("|")
        .toUpperCase();

      if (seen.has(key)) {
        duplicatesRemoved += 1;
        continue;
      }
      seen.add(key);
      orders.push(order);
    }
  }

  const fileName =
    fileNames.length === 1
      ? fileNames[0]
      : `${fileNames[0]} + ${fileNames.length - 1} lagi`;

  return { orders, warnings, fileName, fileNames, duplicatesRemoved };
}
