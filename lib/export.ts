import * as XLSX from "xlsx";
import { Analytics, Order } from "./types";

function sheetFrom(rows: Record<string, unknown>[]): XLSX.WorkSheet {
  return XLSX.utils.json_to_sheet(rows.length ? rows : [{ Nota: "Tiada data" }]);
}

export function exportToExcel(a: Analytics, orders: Order[], fileName: string) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      a.summary.map((s, i) => ({
        No: i + 1,
        Tahap: s.tone.toUpperCase(),
        Perkara: s.headline,
        Penjelasan: s.detail,
      }))
    ),
    "Ringkasan"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      a.monthlyRecaps.flatMap((m) =>
        m.rows.map((r) => ({
          Bulan: m.monthLabel,
          Status: r.status,
          Order: r.count,
          "Total (RM)": r.totalAmount,
          "Purata RM/Order": r.avgPerOrder,
          "% Dari Jumlah": r.pctOfMonthOrders,
        }))
      )
    ),
    "Recap Bulanan"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      a.shipTypes.map((s) => ({
        "Jenis Penghantaran": s.shipType,
        Order: s.totalOrders,
        Collected: s.collected,
        Return: s.returned,
        Pending: s.pending,
        "Return %": s.returnRate,
        "Revenue (RM)": s.revenue,
        "Hilang (RM)": s.lostToReturn,
      }))
    ),
    "COD vs Prepaid"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      a.riskParcels.map((r) => ({
        Tahap: r.severity,
        "Hari Tersangkut": r.daysStalled,
        Tracking: r.trackingNo,
        Pelanggan: r.customerName,
        Telefon: r.phone,
        Produk: r.product,
        "Nilai (RM)": r.amount,
        Kurier: r.courierProvider,
        Kawasan: r.region,
        "Scan Terakhir": r.lastScanLabel,
        Ejen: r.agent,
      }))
    ),
    "Parcel Berisiko"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom([
      { Perkara: "Nilai barang hilang (RM)", Jumlah: a.moneyLost.totalLost },
      { Perkara: "Anggaran kos kurier terbuang (RM)", Jumlah: a.moneyLost.estimatedShippingWaste },
      { Perkara: "JUMLAH KERUGIAN (RM)", Jumlah: a.moneyLost.totalWithShipping },
      ...a.moneyLost.byProduct.map((b) => ({
        Perkara: `Produk: ${b.label}`,
        Jumlah: b.lostAmount,
        Order: b.returnedOrders,
      })),
      ...a.moneyLost.byRegion.map((b) => ({
        Perkara: `Kawasan: ${b.label}`,
        Jumlah: b.lostAmount,
        Order: b.returnedOrders,
      })),
    ]),
    "Duit Hangus"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      a.agentQuality.map((q) => ({
        Ejen: q.agent,
        Gred: q.grade,
        Skor: q.qualityScore,
        Order: q.totalOrders,
        Collected: q.collected,
        Return: q.returned,
        "Return %": q.returnRate,
        "COD %": q.codShare,
        "Revenue (RM)": q.revenue,
      }))
    ),
    "Kualiti Ejen"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      a.customers.serialReturners.map((c) => ({
        Pelanggan: c.name,
        Telefon: c.phoneKey,
        "Jumlah Order": c.orders,
        Collected: c.collected,
        Return: c.returned,
        "Belanja (RM)": c.totalSpend,
      }))
    ),
    "Serial Returner"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      a.products.map((p) => ({
        Produk: p.product,
        Order: p.totalOrders,
        Collected: p.collected,
        Return: p.returned,
        Pending: p.pending,
        "Return %": p.returnRate,
        "Revenue (RM)": p.revenue,
      }))
    ),
    "Produk"
  );

  XLSX.utils.book_append_sheet(
    wb,
    sheetFrom(
      orders.map((o) => ({
        Ejen: o.agent,
        Pelanggan: o.customerName,
        Telefon: o.phone,
        Produk: o.product,
        Kuantiti: o.quantity,
        "Harga (RM)": o.amount,
        Tarikh: o.orderDate ? o.orderDate.toLocaleDateString("en-GB") : "",
        Penghantaran: o.shipType,
        Tracking: o.trackingNo,
        Kurier: o.courierProvider,
        Status: o.status,
        Kawasan: o.region,
        Sebab: o.failReason,
      }))
    ),
    "Data Penuh"
  );

  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `${fileName.replace(/\.[^.]+$/, "")}-analisis-${stamp}.xlsx`);
}

export function exportToPDF() {
  window.print();
}
