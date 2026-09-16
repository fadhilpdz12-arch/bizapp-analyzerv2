import {
  Order,
  Analytics,
  StatusBreakdown,
  ReasonBucket,
  ProductStat,
  CourierStat,
  RegionStat,
  AgentStat,
  DayTrend,
  Projection,
  OrderStatus,
  MonthlyRecap,
  MonthlyStatusRow,
  CourierReturnSplit,
  MonthComparisonRow,
  ShipTypeStat,
  RiskParcel,
  MonthMaturity,
  MoneyLost,
  LossBucket,
  CustomerStat,
  CustomerInsight,
  AgentQuality,
  SummaryPoint,
} from "./types";

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

function fmtDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function computeAnalytics(allOrders: Order[]): Analytics {
  const orders = allOrders.filter((o) => o.status !== "BATAL" && o.status !== "UNKNOWN");
  const totalOrders = orders.length;

  const collectedOrders = orders.filter((o) => o.status === "COLLECTED");
  const returnedOrders = orders.filter((o) => o.status === "RETURN");
  const pendingOrders = orders.filter((o) => o.status === "PENDING");

  const totalRevenueCollected = collectedOrders.reduce((s, o) => s + o.amount, 0);
  const totalRevenuePotential = orders.reduce((s, o) => s + o.amount, 0);
  const avgOrderValue = totalOrders ? totalRevenuePotential / totalOrders : 0;

  // ---- Status breakdown ----
  const statusMap = new Map<OrderStatus, { count: number; amount: number }>();
  for (const o of orders) {
    const e = statusMap.get(o.status) || { count: 0, amount: 0 };
    e.count += 1;
    e.amount += o.amount;
    statusMap.set(o.status, e);
  }
  const statusBreakdown: StatusBreakdown[] = Array.from(statusMap.entries()).map(([status, v]) => ({
    status,
    count: v.count,
    amount: Math.round(v.amount * 100) / 100,
    pct: pct(v.count, totalOrders),
  }));

  // ---- Return / pending reasons ----
  const bucketize = (list: Order[]): ReasonBucket[] => {
    const m = new Map<string, number>();
    for (const o of list) {
      const key = o.failReason || "Lain-lain / Belum Diklasifikasi";
      m.set(key, (m.get(key) || 0) + 1);
    }
    return Array.from(m.entries())
      .map(([reason, count]) => ({ reason, count, pct: pct(count, list.length) }))
      .sort((a, b) => b.count - a.count);
  };
  const returnReasons = bucketize(returnedOrders);
  const pendingReasons = bucketize(pendingOrders);

  // ---- Product stats ----
  const productMap = new Map<string, Order[]>();
  for (const o of orders) {
    const key = o.product || "Tidak Diketahui";
    if (!productMap.has(key)) productMap.set(key, []);
    productMap.get(key)!.push(o);
  }
  const products: ProductStat[] = Array.from(productMap.entries()).map(([product, list]) => {
    const collected = list.filter((o) => o.status === "COLLECTED").length;
    const returned = list.filter((o) => o.status === "RETURN").length;
    const pending = list.filter((o) => o.status === "PENDING").length;
    const revenue = list.filter((o) => o.status === "COLLECTED").reduce((s, o) => s + o.amount, 0);
    const resolved = collected + returned;
    return {
      product,
      totalOrders: list.length,
      collected,
      returned,
      pending,
      returnRate: pct(returned, resolved || list.length),
      revenue: Math.round(revenue * 100) / 100,
      avgOrderValue: list.length ? Math.round((list.reduce((s, o) => s + o.amount, 0) / list.length) * 100) / 100 : 0,
    };
  }).sort((a, b) => b.totalOrders - a.totalOrders);

  // ---- Courier stats ----
  const courierMap = new Map<string, Order[]>();
  for (const o of orders) {
    const key = o.courierProvider || "Lain-lain";
    if (!courierMap.has(key)) courierMap.set(key, []);
    courierMap.get(key)!.push(o);
  }
  const couriers: CourierStat[] = Array.from(courierMap.entries()).map(([courier, list]) => {
    const collected = list.filter((o) => o.status === "COLLECTED").length;
    const returned = list.filter((o) => o.status === "RETURN").length;
    const pending = list.filter((o) => o.status === "PENDING").length;
    const resolved = collected + returned;
    const revenue = list.filter((o) => o.status === "COLLECTED").reduce((s, o) => s + o.amount, 0);
    return {
      courier,
      totalOrders: list.length,
      collected,
      returned,
      pending,
      returnRate: pct(returned, resolved || list.length),
      revenue: Math.round(revenue * 100) / 100,
    };
  }).sort((a, b) => b.totalOrders - a.totalOrders);

  // ---- Region stats (resolved deliveries only: collected + returned) ----
  const resolvedForRegion = orders.filter((o) => o.status === "COLLECTED" || o.status === "RETURN");
  const regionMap = new Map<string, Order[]>();
  for (const o of resolvedForRegion) {
    const key = o.region || "Tidak Diketahui";
    if (key === "Tidak Diketahui") continue;
    if (!regionMap.has(key)) regionMap.set(key, []);
    regionMap.get(key)!.push(o);
  }
  const regions: RegionStat[] = Array.from(regionMap.entries())
    .map(([region, list]) => {
      const returned = list.filter((o) => o.status === "RETURN").length;
      return {
        region,
        totalOrders: list.length,
        returned,
        returnRate: pct(returned, list.length),
      };
    })
    .filter((r) => r.totalOrders >= 3)
    .sort((a, b) => b.totalOrders - a.totalOrders);

  // ---- Agent stats ----
  const agentMap = new Map<string, Order[]>();
  for (const o of orders) {
    const key = o.agent || "Tidak Diketahui";
    if (!agentMap.has(key)) agentMap.set(key, []);
    agentMap.get(key)!.push(o);
  }
  const agents: AgentStat[] = Array.from(agentMap.entries()).map(([agent, list]) => {
    const collected = list.filter((o) => o.status === "COLLECTED").length;
    const returned = list.filter((o) => o.status === "RETURN").length;
    const resolved = collected + returned;
    const revenue = list.filter((o) => o.status === "COLLECTED").reduce((s, o) => s + o.amount, 0);
    return {
      agent,
      totalOrders: list.length,
      collected,
      returned,
      returnRate: pct(returned, resolved || list.length),
      revenue: Math.round(revenue * 100) / 100,
    };
  }).sort((a, b) => b.totalOrders - a.totalOrders);

  // ---- Daily trend ----
  const trendMap = new Map<string, DayTrend>();
  for (const o of orders) {
    if (!o.orderDate) continue;
    const key = fmtDate(o.orderDate);
    if (!trendMap.has(key)) {
      trendMap.set(key, { date: key, orders: 0, collected: 0, returned: 0, pending: 0, revenue: 0 });
    }
    const e = trendMap.get(key)!;
    e.orders += 1;
    if (o.status === "COLLECTED") { e.collected += 1; e.revenue += o.amount; }
    if (o.status === "RETURN") e.returned += 1;
    if (o.status === "PENDING") e.pending += 1;
  }
  const trend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // ---- Date range ----
  const dates = orders.map((o) => o.orderDate).filter((d): d is Date => !!d);
  const dateRange = {
    start: dates.length ? new Date(Math.min(...dates.map((d) => d.getTime()))) : null,
    end: dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null,
  };

  // ---- Projection: split trend into two halves, compare avg daily revenue ----
  let projection: Projection = {
    method: "Purata harian",
    dailyAvgRevenue: 0,
    next7DaysRevenue: 0,
    next30DaysRevenue: 0,
    trendDirection: "flat",
    trendPct: 0,
  };
  if (trend.length >= 4) {
    const mid = Math.floor(trend.length / 2);
    const firstHalf = trend.slice(0, mid);
    const secondHalf = trend.slice(mid);
    const avg = (arr: DayTrend[]) => (arr.length ? arr.reduce((s, d) => s + d.revenue, 0) / arr.length : 0);
    const firstAvg = avg(firstHalf);
    const secondAvg = avg(secondHalf);
    const overallAvg = avg(trend);
    const trendPct = firstAvg === 0 ? 0 : Math.round(((secondAvg - firstAvg) / firstAvg) * 1000) / 10;
    projection = {
      method: "Perbandingan purata harian (separuh awal vs separuh akhir tempoh data)",
      dailyAvgRevenue: Math.round(overallAvg * 100) / 100,
      next7DaysRevenue: Math.round(secondAvg * 7 * 100) / 100,
      next30DaysRevenue: Math.round(secondAvg * 30 * 100) / 100,
      trendDirection: trendPct > 3 ? "up" : trendPct < -3 ? "down" : "flat",
      trendPct,
    };
  } else if (trend.length > 0) {
    const overallAvg = trend.reduce((s, d) => s + d.revenue, 0) / trend.length;
    projection = {
      method: "Purata harian (data terhad)",
      dailyAvgRevenue: Math.round(overallAvg * 100) / 100,
      next7DaysRevenue: Math.round(overallAvg * 7 * 100) / 100,
      next30DaysRevenue: Math.round(overallAvg * 30 * 100) / 100,
      trendDirection: "flat",
      trendPct: 0,
    };
  }

  const topRiskProducts = [...products]
    .filter((p) => p.totalOrders >= 5)
    .sort((a, b) => b.returnRate - a.returnRate)
    .slice(0, 5);

  const topRiskRegions = [...regions].sort((a, b) => b.returnRate - a.returnRate).slice(0, 6);

  // ---- Monthly recap tables (mirrors the STATUS / TOTAL RM / PURATA RM/ORDER / % layout) ----
  const monthGroups = new Map<string, { label: string; list: Order[] }>();
  for (const o of orders) {
    if (!monthGroups.has(o.monthKey)) monthGroups.set(o.monthKey, { label: o.monthLabel, list: [] });
    monthGroups.get(o.monthKey)!.list.push(o);
  }
  const monthlyRecaps: MonthlyRecap[] = Array.from(monthGroups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([monthKey, { label, list }]) => {
      const totalOrders = list.length;
      const totalSales = list.reduce((s, o) => s + o.amount, 0);
      const byStatus = new Map<OrderStatus, Order[]>();
      for (const o of list) {
        if (!byStatus.has(o.status)) byStatus.set(o.status, []);
        byStatus.get(o.status)!.push(o);
      }
      const rows: MonthlyStatusRow[] = Array.from(byStatus.entries()).map(([status, sublist]) => {
        const totalAmount = sublist.reduce((s, o) => s + o.amount, 0);
        return {
          status,
          count: sublist.length,
          totalAmount: Math.round(totalAmount * 100) / 100,
          avgPerOrder: sublist.length ? Math.round((totalAmount / sublist.length) * 100) / 100 : 0,
          pctOfMonthOrders: pct(sublist.length, totalOrders),
          pctOfMonthSales: pct(totalAmount, totalSales),
        };
      }).sort((a, b) => b.count - a.count);

      // ---- Pecahan return ikut kurier (Pos Laju vs Ninja Van vs lain-lain) ----
      const returnedList = list.filter((o) => o.status === "RETURN");
      const totalReturnCount = returnedList.length;
      const totalReturnAmount = returnedList.reduce((s, o) => s + o.amount, 0);
      const courierMap = new Map<string, { count: number; amount: number }>();
      for (const o of returnedList) {
        const key = o.courierProvider || "Tidak Diketahui";
        if (!courierMap.has(key)) courierMap.set(key, { count: 0, amount: 0 });
        const e = courierMap.get(key)!;
        e.count += 1;
        e.amount += o.amount;
      }
      const courierReturns: CourierReturnSplit[] = Array.from(courierMap.entries())
        .map(([courier, { count, amount }]) => ({
          courier,
          returnCount: count,
          returnAmount: Math.round(amount * 100) / 100,
          pctReturnParcel: pct(count, totalReturnCount),
          pctReturnSales: pct(amount, totalReturnAmount),
        }))
        .sort((a, b) => b.returnCount - a.returnCount);
      const dominantReturnCourier = courierReturns.length ? courierReturns[0].courier : null;

      return {
        monthKey,
        monthLabel: label,
        totalOrders,
        totalSales: Math.round(totalSales * 100) / 100,
        rows,
        courierReturns,
        totalReturnCount,
        totalReturnAmount: Math.round(totalReturnAmount * 100) / 100,
        dominantReturnCourier,
      };
    });

  // ---- Month-over-month comparison ----
  const monthComparison: MonthComparisonRow[] = monthlyRecaps.map((m, idx) => {
    const list = monthGroups.get(m.monthKey)!.list;
    const collected = list.filter((o) => o.status === "COLLECTED");
    const returned = list.filter((o) => o.status === "RETURN");
    const pending = list.filter((o) => o.status === "PENDING");
    const revenueCollected = collected.reduce((s, o) => s + o.amount, 0);
    const resolved = collected.length + returned.length;
    const returnRate = pct(returned.length, resolved || list.length);
    const pendingRate = pct(pending.length, list.length);
    const avgOrderValue = list.length ? list.reduce((s, o) => s + o.amount, 0) / list.length : 0;

    let momRevenueChangePct: number | null = null;
    if (idx > 0) {
      const prevList = monthGroups.get(monthlyRecaps[idx - 1].monthKey)!.list;
      const prevRevenue = prevList
        .filter((o) => o.status === "COLLECTED")
        .reduce((s, o) => s + o.amount, 0);
      momRevenueChangePct = prevRevenue === 0 ? null : Math.round(((revenueCollected - prevRevenue) / prevRevenue) * 1000) / 10;
    }

    return {
      monthKey: m.monthKey,
      monthLabel: m.monthLabel,
      totalOrders: list.length,
      revenueCollected: Math.round(revenueCollected * 100) / 100,
      returnRate,
      pendingRate,
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      momRevenueChangePct,
    };
  });

  // ═══════════ SHIPPING TYPE COMPARISON (COD vs Prepaid vs Self Collect) ═══════════
  const shipMap = new Map<string, Order[]>();
  for (const o of orders) {
    const k = o.shipType;
    if (!shipMap.has(k)) shipMap.set(k, []);
    shipMap.get(k)!.push(o);
  }
  const shipTypes: ShipTypeStat[] = Array.from(shipMap.entries())
    .map(([shipType, list]) => {
      const collected = list.filter((o) => o.status === "COLLECTED");
      const returnedList = list.filter((o) => o.status === "RETURN");
      const pending = list.filter((o) => o.status === "PENDING").length;
      const resolved = collected.length + returnedList.length;
      return {
        shipType,
        totalOrders: list.length,
        collected: collected.length,
        returned: returnedList.length,
        pending,
        returnRate: pct(returnedList.length, resolved || list.length),
        revenue: Math.round(collected.reduce((s, o) => s + o.amount, 0) * 100) / 100,
        lostToReturn: Math.round(returnedList.reduce((s, o) => s + o.amount, 0) * 100) / 100,
      };
    })
    .sort((a, b) => b.totalOrders - a.totalOrders);

  // ═══════════ SETTLEMENT SPEED (median days) ═══════════
  const median = (nums: number[]): number | null => {
    if (!nums.length) return null;
    const s = [...nums].sort((a, b) => a - b);
    return s[Math.floor(s.length / 2)];
  };
  const medianSettleCollected = median(
    orders.filter((o) => o.status === "COLLECTED" && o.daysToSettle !== null).map((o) => o.daysToSettle as number)
  );
  const medianSettleReturned = median(
    orders.filter((o) => o.status === "RETURN" && o.daysToSettle !== null).map((o) => o.daysToSettle as number)
  );

  // ═══════════ RISK PARCELS (pending, stalled past the danger threshold) ═══════════
  // Threshold sits just above the median successful delivery: past this point a
  // parcel statistically trends toward return, so it's still worth intervening.
  const riskThresholdDays = Math.max(5, (medianSettleCollected ?? 3) + 2);
  const fmtShort = (d: Date | null) =>
    d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "—";

  const riskParcels: RiskParcel[] = orders
    .filter((o) => o.status === "PENDING" && o.daysInTransit !== null && (o.daysInTransit as number) >= riskThresholdDays)
    .map((o) => {
      const days = o.daysInTransit as number;
      return {
        trackingNo: o.trackingNo,
        customerName: o.customerName,
        phone: o.phone,
        agent: o.agent,
        product: o.product,
        amount: o.amount,
        courierProvider: o.courierProvider,
        region: o.region,
        daysStalled: days,
        lastScanLabel: fmtShort(o.lastScanDate),
        severity: days >= riskThresholdDays + 4 ? ("kritikal" as const) : ("amaran" as const),
      };
    })
    .sort((a, b) => b.daysStalled - a.daysStalled);

  // ═══════════ MONTH MATURITY (guards against misleading MoM) ═══════════
  const monthMaturity: MonthMaturity[] = Array.from(monthGroups.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([monthKey, { label, list }]) => {
      const resolved = list.filter((o) => o.status === "COLLECTED" || o.status === "RETURN").length;
      const resolvedPct = pct(resolved, list.length);
      return {
        monthKey,
        monthLabel: label,
        totalOrders: list.length,
        resolvedPct,
        isMature: resolvedPct >= 85,
      };
    });

  // ═══════════ MONEY LOST ═══════════
  const SHIPPING_COST_PER_RETURN = 16; // two-way courier cost estimate, RM
  const returnedAll = orders.filter((o) => o.status === "RETURN");
  const totalLost = returnedAll.reduce((s, o) => s + o.amount, 0);

  const bucketLoss = (keyFn: (o: Order) => string): LossBucket[] => {
    const m = new Map<string, { amt: number; n: number }>();
    for (const o of returnedAll) {
      const k = keyFn(o) || "Tidak Diketahui";
      const e = m.get(k) || { amt: 0, n: 0 };
      e.amt += o.amount;
      e.n += 1;
      m.set(k, e);
    }
    return Array.from(m.entries())
      .map(([label, v]) => ({
        label,
        lostAmount: Math.round(v.amt * 100) / 100,
        returnedOrders: v.n,
        pct: totalLost === 0 ? 0 : Math.round((v.amt / totalLost) * 1000) / 10,
      }))
      .sort((a, b) => b.lostAmount - a.lostAmount);
  };

  const moneyLost: MoneyLost = {
    totalLost: Math.round(totalLost * 100) / 100,
    estimatedShippingWaste: returnedAll.length * SHIPPING_COST_PER_RETURN,
    totalWithShipping: Math.round((totalLost + returnedAll.length * SHIPPING_COST_PER_RETURN) * 100) / 100,
    byMonth: bucketLoss((o) => o.monthLabel),
    byProduct: bucketLoss((o) => o.product),
    byRegion: bucketLoss((o) => o.region),
    shippingCostPerReturn: SHIPPING_COST_PER_RETURN,
  };

  // ═══════════ CUSTOMERS: repeat, value, serial returners ═══════════
  const custMap = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.phoneKey) continue;
    if (!custMap.has(o.phoneKey)) custMap.set(o.phoneKey, []);
    custMap.get(o.phoneKey)!.push(o);
  }
  const custStats: CustomerStat[] = Array.from(custMap.entries()).map(([phoneKey, list]) => ({
    phoneKey,
    name: list[0].customerName,
    orders: list.length,
    collected: list.filter((o) => o.status === "COLLECTED").length,
    returned: list.filter((o) => o.status === "RETURN").length,
    totalSpend: Math.round(list.filter((o) => o.status === "COLLECTED").reduce((s, o) => s + o.amount, 0) * 100) / 100,
  }));

  const repeatList = custStats.filter((c) => c.orders > 1);
  const onceList = custStats.filter((c) => c.orders === 1);
  const avg = (arr: CustomerStat[]) =>
    arr.length ? Math.round((arr.reduce((s, c) => s + c.totalSpend, 0) / arr.length) * 100) / 100 : 0;

  const serialReturners = custStats
    .filter((c) => c.returned >= 2)
    .sort((a, b) => b.returned - a.returned);

  const customers: CustomerInsight = {
    uniqueCustomers: custStats.length,
    repeatCustomers: repeatList.length,
    repeatRate: pct(repeatList.length, custStats.length),
    ordersFromRepeat: repeatList.reduce((s, c) => s + c.orders, 0),
    avgSpendRepeat: avg(repeatList),
    avgSpendOnce: avg(onceList),
    topCustomers: [...custStats].sort((a, b) => b.totalSpend - a.totalSpend).slice(0, 8),
    serialReturners,
    wastedBySerial:
      Math.round(
        orders
          .filter((o) => o.status === "RETURN" && serialReturners.some((s) => s.phoneKey === o.phoneKey))
          .reduce((s, o) => s + o.amount, 0) * 100
      ) / 100,
  };

  // ═══════════ AGENT QUALITY SCORECARD ═══════════
  const agentQuality: AgentQuality[] = agents
    .filter((a) => a.totalOrders >= 5)
    .map((a) => {
      const list = agentMap.get(a.agent) || [];
      const codCount = list.filter((o) => o.isCOD).length;
      // Score rewards low return rate, lightly penalises very COD-heavy mixes.
      const returnPenalty = Math.min(a.returnRate * 2.5, 80);
      const codShare = pct(codCount, list.length);
      const codPenalty = codShare > 90 ? 8 : 0;
      const qualityScore = Math.max(0, Math.round(100 - returnPenalty - codPenalty));
      const grade: AgentQuality["grade"] =
        qualityScore >= 80 ? "A" : qualityScore >= 65 ? "B" : qualityScore >= 50 ? "C" : "D";
      return {
        agent: a.agent,
        totalOrders: a.totalOrders,
        collected: a.collected,
        returned: a.returned,
        returnRate: a.returnRate,
        revenue: a.revenue,
        codShare,
        qualityScore,
        grade,
      };
    })
    .sort((a, b) => b.qualityScore - a.qualityScore);

  // ═══════════ AUTO EXECUTIVE SUMMARY ═══════════
  const summary: SummaryPoint[] = [];
  const cod = shipTypes.find((s) => s.shipType === "COD Kurier");
  const prepaid = shipTypes.find((s) => s.shipType === "Prepaid");
  if (cod && prepaid && prepaid.returnRate >= 0 && cod.returnRate > prepaid.returnRate) {
    const gap = prepaid.returnRate === 0 ? cod.returnRate : Math.round((cod.returnRate / prepaid.returnRate) * 10) / 10;
    summary.push({
      headline: `COD kurier return ${cod.returnRate}%, prepaid ${prepaid.returnRate}%`,
      detail:
        prepaid.returnRate === 0
          ? `Prepaid hampir sifar return. COD hilang RM${cod.lostToReturn.toLocaleString()} setakat ini.`
          : `COD ${gap}x lebih berisiko. Setiap 10% order COD ditukar ke prepaid berpotensi jimat lebih kurang RM${Math.round((cod.lostToReturn * 0.1)).toLocaleString()}.`,
      tone: "bahaya",
    });
  }
  if (riskParcels.length > 0) {
    const atRisk = Math.round(riskParcels.reduce((s, r) => s + r.amount, 0));
    summary.push({
      headline: `${riskParcels.length} parcel tersangkut lebih ${riskThresholdDays} hari`,
      detail: `Nilai RM${atRisk.toLocaleString()} masih boleh diselamatkan kalau admin call customer hari ini sebelum parcel auto-return.`,
      tone: "amaran",
    });
  }
  const immature = monthMaturity.filter((m) => !m.isMature);
  if (immature.length > 0) {
    summary.push({
      headline: `Data ${immature.map((m) => m.monthLabel).join(", ")} belum matang`,
      detail: `Baru ${immature.map((m) => m.resolvedPct + "%").join(", ")} parcel selesai. Jangan banding revenue bulan ini dengan bulan penuh — ia akan nampak jatuh walaupun sebenarnya belum settle.`,
      tone: "amaran",
    });
  }
  if (moneyLost.totalLost > 0) {
    summary.push({
      headline: `RM${moneyLost.totalWithShipping.toLocaleString()} hangus sebab return`,
      detail: `RM${moneyLost.totalLost.toLocaleString()} nilai barang + anggaran RM${moneyLost.estimatedShippingWaste.toLocaleString()} kos kurier dua hala. Penyumbang terbesar: ${moneyLost.byProduct[0]?.label ?? "—"}.`,
      tone: "bahaya",
    });
  }
  if (customers.uniqueCustomers > 0) {
    summary.push({
      headline: `Repeat customer ${customers.repeatRate}%`,
      detail:
        customers.repeatRate < 15
          ? `Rendah — majoriti beli sekali sahaja. Customer berulang belanja purata RM${customers.avgSpendRepeat.toLocaleString()} berbanding RM${customers.avgSpendOnce.toLocaleString()}, jadi follow-up berbaloi.`
          : `Customer berulang belanja purata RM${customers.avgSpendRepeat.toLocaleString()} berbanding RM${customers.avgSpendOnce.toLocaleString()}.`,
      tone: customers.repeatRate < 15 ? "amaran" : "baik",
    });
  }
  if (medianSettleCollected !== null && medianSettleReturned !== null) {
    summary.push({
      headline: `Parcel berjaya ${medianSettleCollected} hari, parcel return ${medianSettleReturned} hari`,
      detail: `Parcel yang lambat jauh lebih cenderung jadi return. Ini asas kepada senarai parcel berisiko.`,
      tone: "baik",
    });
  }

  return {
    totalOrders,
    totalRevenueCollected: Math.round(totalRevenueCollected * 100) / 100,
    totalRevenuePotential: Math.round(totalRevenuePotential * 100) / 100,
    avgOrderValue: Math.round(avgOrderValue * 100) / 100,
    statusBreakdown,
    returnReasons,
    pendingReasons,
    products,
    couriers,
    regions,
    agents,
    trend,
    projection,
    dateRange,
    topRiskProducts,
    topRiskRegions,
    monthlyRecaps,
    monthComparison,
    shipTypes,
    riskParcels,
    riskThresholdDays,
    monthMaturity,
    moneyLost,
    customers,
    agentQuality,
    summary,
    medianSettleCollected,
    medianSettleReturned,
  };
}
