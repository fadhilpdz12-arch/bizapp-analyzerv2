export type OrderStatus = "COLLECTED" | "RETURN" | "PENDING" | "BATAL" | "UNKNOWN";

/**
 * Current actionable state of an unresolved parcel, read from the LATEST
 * courier scan event inside parcelStatusRaw:
 * - SELF_COLLECT    — parcel waiting at an office/hub/locker for the customer
 * - FAILED_DELIVERY — last delivery attempt failed (customer must be contacted)
 * - OUT_FOR_DELIVERY — parcel is on the vehicle today
 */
/**
 * Every PENDING parcel lands in exactly one of these, read from its latest
 * courier scan. Order here = admin priority.
 *  - SELF_COLLECT     waiting at an office/locker for the customer to collect
 *  - FAILED_DELIVERY  latest delivery attempt failed
 *  - EXCEPTION        courier flagged a problem (Arrival Exception, on hold, address issue)
 *  - STUCK            in transit but no new scan for STUCK_DAYS+ days
 *  - NO_SCAN          tracking generated but the courier has never scanned it
 *  - NOT_SHIPPED      no tracking number yet
 *  - OUT_FOR_DELIVERY on the vehicle / delivery window assigned
 *  - IN_TRANSIT       moving normally (linehaul, hub, dispatch, pickup)
 */
export type ParcelAction =
  | "SELF_COLLECT"
  | "FAILED_DELIVERY"
  | "EXCEPTION"
  | "STUCK"
  | "NO_SCAN"
  | "NOT_SHIPPED"
  | "OUT_FOR_DELIVERY"
  | "IN_TRANSIT";

export interface Order {
  agent: string;
  customerName: string;
  phone: string;
  product: string;
  quantity: number;
  amount: number;
  orderDate: Date | null;
  deliveryMethod: string;
  trackingNo: string;
  courierGenerated: Date | null;
  status: OrderStatus;
  note: string;
  parcelStatusRaw: string;
  courierProvider: string; // derived from tracking prefix: Pos Laju / Ninja Van / SPX / Unknown
  failReason: string; // derived category from parcelStatusRaw for RETURN/PENDING
  region: string; // derived office/hub location from parcelStatusRaw
  monthKey: string; // "2026-07", derived from orderDate
  monthLabel: string; // "Julai 2026", derived from orderDate
  isCOD: boolean; // courier COD only (excludes self-collect)
  shipType: "COD Kurier" | "Prepaid" | "Self Collect" | "Tidak Diketahui";
  phoneKey: string; // digits-only normalized phone, "" if unusable
  lastScanDate: Date | null; // final timestamp inside parcelStatusRaw
  daysToSettle: number | null; // courierGenerated -> lastScanDate, for resolved parcels
  daysInTransit: number | null; // courierGenerated -> lastScanDate, for still-pending parcels
  parcelAction: ParcelAction | null; // actionable state from the latest scan, null when resolved/none
  actionLocation: string; // office/hub where the parcel waits for self-collect, "" otherwise
  failAttempts: number; // failed delivery attempts counted across the whole scan history
}

export interface ParsedResult {
  orders: Order[];
  warnings: string[];
  /** Combined label for display, e.g. "july_2026.xlsx + 1 lagi". */
  fileName: string;
  /** Every file that contributed orders, in upload order. */
  fileNames: string[];
  /** Rows dropped because an identical order already came from another file. */
  duplicatesRemoved: number;
}

export interface StatusBreakdown {
  status: OrderStatus;
  count: number;
  amount: number;
  pct: number;
}

export interface ReasonBucket {
  reason: string;
  count: number;
  pct: number;
}

export interface ProductStat {
  product: string;
  totalOrders: number;
  collected: number;
  returned: number;
  pending: number;
  returnRate: number;
  revenue: number;
  avgOrderValue: number;
}

export interface CourierStat {
  courier: string;
  totalOrders: number;
  collected: number;
  returned: number;
  pending: number;
  returnRate: number;
  revenue: number;
}

export interface RegionStat {
  region: string;
  totalOrders: number;
  returned: number;
  returnRate: number;
}

export interface AgentStat {
  agent: string;
  totalOrders: number;
  collected: number;
  returned: number;
  returnRate: number;
  revenue: number;
}

export interface DayTrend {
  date: string; // YYYY-MM-DD
  orders: number;
  collected: number;
  returned: number;
  pending: number;
  revenue: number;
}

export interface Projection {
  method: string;
  dailyAvgRevenue: number;
  next7DaysRevenue: number;
  next30DaysRevenue: number;
  trendDirection: "up" | "down" | "flat";
  trendPct: number;
}

export interface MonthlyStatusRow {
  status: OrderStatus;
  count: number;
  totalAmount: number;
  avgPerOrder: number;
  pctOfMonthOrders: number; // % per parcel — dikira ikut bilangan order/parcel
  pctOfMonthSales: number; // % per sales — dikira ikut nilai RM
}

export interface CourierReturnSplit {
  courier: string;
  returnCount: number;
  returnAmount: number;
  pctReturnParcel: number; // % share kurier ini antara semua return bulan tu, ikut bilangan parcel
  pctReturnSales: number; // % share kurier ini antara semua return bulan tu, ikut nilai RM
}

export interface MonthlyRecap {
  monthKey: string;
  monthLabel: string;
  totalOrders: number;
  totalSales: number;
  rows: MonthlyStatusRow[];
  courierReturns: CourierReturnSplit[];
  totalReturnCount: number;
  totalReturnAmount: number;
  dominantReturnCourier: string | null;
}

export interface MonthComparisonRow {
  monthKey: string;
  monthLabel: string;
  totalOrders: number;
  revenueCollected: number;
  returnRate: number;
  pendingRate: number;
  avgOrderValue: number;
  momRevenueChangePct: number | null; // vs previous month, null if no previous month
}

export interface ShipTypeStat {
  shipType: string;
  totalOrders: number;
  collected: number;
  returned: number;
  pending: number;
  returnRate: number;
  revenue: number;
  lostToReturn: number;
}

export interface ActionParcel {
  action: ParcelAction;
  trackingNo: string;
  customerName: string;
  phone: string;
  agent: string;
  product: string;
  amount: number;
  courierProvider: string;
  /** Self-collect: office/hub/locker where the parcel waits. Otherwise region. */
  location: string;
  failAttempts: number;
  lastEventLabel: string;
  lastScanLabel: string;
  /** Days since the latest scan; for unscanned parcels, since tracking was
   *  generated; for parcels without tracking, since the order date. */
  daysSince: number | null;
  /** Unscanned/unshipped parcel past the follow-up threshold. */
  overdue: boolean;
}

export interface ParcelActionBoard {
  selfCollect: ActionParcel[];
  failedDelivery: ActionParcel[];
  exception: ActionParcel[];
  stuck: ActionParcel[];
  noScan: ActionParcel[];
  notShipped: ActionParcel[];
  outForDelivery: ActionParcel[];
  inTransit: ActionParcel[];
  /** Every pending parcel on the board (all groups). */
  totalPending: number;
  /** Parcels the admin must act on today (everything except out-for-delivery
   *  and normal in-transit; unscanned/unshipped only once overdue). */
  totalActionable: number;
  /** In-transit parcels count as stuck after this many days without a scan. */
  stuckDays: number;
}

export interface RiskParcel {
  trackingNo: string;
  customerName: string;
  phone: string;
  agent: string;
  product: string;
  amount: number;
  courierProvider: string;
  region: string;
  daysStalled: number;
  lastScanLabel: string;
  severity: "kritikal" | "amaran";
}

export interface MonthMaturity {
  monthKey: string;
  monthLabel: string;
  totalOrders: number;
  resolvedPct: number; // (collected + returned) / total
  isMature: boolean; // resolvedPct >= 85
}

export interface LossBucket {
  label: string;
  lostAmount: number;
  returnedOrders: number;
  pct: number;
}

export interface MoneyLost {
  totalLost: number;
  estimatedShippingWaste: number;
  totalWithShipping: number;
  byMonth: LossBucket[];
  byProduct: LossBucket[];
  byRegion: LossBucket[];
  shippingCostPerReturn: number;
}

export interface CustomerStat {
  phoneKey: string;
  name: string;
  orders: number;
  collected: number;
  returned: number;
  totalSpend: number;
}

export interface CustomerInsight {
  uniqueCustomers: number;
  repeatCustomers: number;
  repeatRate: number;
  ordersFromRepeat: number;
  avgSpendRepeat: number;
  avgSpendOnce: number;
  topCustomers: CustomerStat[];
  serialReturners: CustomerStat[];
  wastedBySerial: number;
}

export interface AgentQuality {
  agent: string;
  totalOrders: number;
  collected: number;
  returned: number;
  returnRate: number;
  revenue: number;
  codShare: number;
  qualityScore: number; // 0-100
  grade: "A" | "B" | "C" | "D";
}

export interface SummaryPoint {
  headline: string;
  detail: string;
  tone: "baik" | "amaran" | "bahaya";
}

export interface Analytics {
  totalOrders: number;
  totalRevenueCollected: number;
  totalRevenuePotential: number;
  avgOrderValue: number;
  statusBreakdown: StatusBreakdown[];
  returnReasons: ReasonBucket[];
  pendingReasons: ReasonBucket[];
  products: ProductStat[];
  couriers: CourierStat[];
  regions: RegionStat[];
  agents: AgentStat[];
  trend: DayTrend[];
  projection: Projection;
  dateRange: { start: Date | null; end: Date | null };
  topRiskProducts: ProductStat[];
  topRiskRegions: RegionStat[];
  monthlyRecaps: MonthlyRecap[];
  monthComparison: MonthComparisonRow[];
  shipTypes: ShipTypeStat[];
  riskParcels: RiskParcel[];
  riskThresholdDays: number;
  parcelActions: ParcelActionBoard;
  monthMaturity: MonthMaturity[];
  moneyLost: MoneyLost;
  customers: CustomerInsight;
  agentQuality: AgentQuality[];
  summary: SummaryPoint[];
  medianSettleCollected: number | null;
  medianSettleReturned: number | null;
}
