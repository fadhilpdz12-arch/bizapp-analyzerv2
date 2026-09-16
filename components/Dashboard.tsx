"use client";

import { useEffect, useMemo, useState } from "react";
import { Analytics, ParsedResult } from "@/lib/types";
import KpiTicket from "./KpiTicket";
import LedgerBars from "./LedgerBars";
import TrendChart from "./TrendChart";
import ComparisonChart from "./ComparisonChart";
import ProjectionTicket from "./ProjectionTicket";
import ManifestTable from "./ManifestTable";
import StampBadge from "./StampBadge";
import MonthlyRecapPanel from "./MonthlyRecapPanel";
import MonthComparisonPanel from "./MonthComparisonPanel";
import ExecutiveSummary from "./ExecutiveSummary";
import ShippingComparePanel from "./ShippingComparePanel";
import RiskParcelPanel from "./RiskParcelPanel";
import SelamatkanSummaryPanel from "./SelamatkanSummaryPanel";
import MoneyLostPanel from "./MoneyLostPanel";
import CustomerPanel from "./CustomerPanel";
import AgentQualityPanel from "./AgentQualityPanel";
import FilterBar from "./FilterBar";
import WelcomeBanner from "./WelcomeBanner";
import ReconcilePanel from "./ReconcilePanel";
import Tabs, { TabDef } from "./Tabs";
import ThemePicker from "./ThemePicker";
import ReprocessPanel from "./ReprocessPanel";
import PromoPlanner from "./PromoPlanner";
import CallQueuePanel from "./CallQueuePanel";
import CausePanel from "./CausePanel";
import CommandPalette, { Command } from "./CommandPalette";
import PresentMode from "./PresentMode";
import { soundEnabled, setSoundEnabled, sfxTick } from "@/lib/sfx";
import { FilterState, FilterOptions } from "@/lib/filters";
import { exportToExcel, exportToPDF } from "@/lib/export";
import { Order } from "@/lib/types";

function fmtDateShort(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export default function Dashboard({
  analytics,
  parsed,
  onReset,
  filters,
  filterOptions,
  onFilterChange,
  filteredOrders,
  processMs = 0,
}: {
  analytics: Analytics;
  parsed: ParsedResult;
  onReset: () => void;
  filters: FilterState;
  filterOptions: FilterOptions;
  onFilterChange: (f: FilterState) => void;
  filteredOrders: Order[];
  processMs?: number;
}) {
  const a = analytics;

  const productRows = a.products.slice(0, 8).map((p) => ({
    name: p.product.length > 26 ? p.product.slice(0, 24) + "…" : p.product,
    collected: p.collected,
    returned: p.returned,
    pending: p.pending,
  }));

  const courierRows = a.couriers.map((c) => ({
    name: c.courier,
    collected: c.collected,
    returned: c.returned,
    pending: c.pending,
  }));

  const [tab, setTab] = useState("ringkasan");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [presenting, setPresenting] = useState(false);
  // Mirrors the stored preference so the palette label stays in sync.
  const [soundOn, setSoundOn] = useState(false);
  useEffect(() => setSoundOn(soundEnabled()), []);

  // Badges surface work that needs doing, so the tab bar doubles as a to-do.
  const tabs: TabDef[] = useMemo(() => {
    const risky = a.riskParcels?.length ?? 0;
    const returned = a.statusBreakdown.find((s) => s.status === "RETURN")?.count ?? 0;
    return [
      { id: "ringkasan", label: "Ringkasan", icon: "\u{1F4CA}" },
      { id: "selamatkan", label: "Selamatkan", icon: "\u{1F6A8}", badge: risky + returned, badgeTone: "alert" },
      { id: "panggil", label: "Panggilan Hari Ini", icon: "\u{1F4DE}" },
      { id: "bulanan", label: "Bulanan", icon: "\u{1F4C5}", badge: a.monthlyRecaps.length, badgeTone: "neutral" },
      { id: "produk", label: "Produk & Kurier", icon: "\u{1F4E6}" },
      { id: "orang", label: "Ejen & Pelanggan", icon: "\u{1F465}" },
      { id: "reprocess", label: "Reprocess", icon: "\u{1F501}", badge: returned, badgeTone: "alert" },
      { id: "promo", label: "Promosi", icon: "\u{1F3AF}" },
    ];
  }, [a]);

  const commands: Command[] = useMemo(() => {
    const list: Command[] = tabs.map((t, i) => ({
      id: `tab-${t.id}`,
      label: t.label,
      group: "Pergi ke",
      icon: t.icon,
      hint: String(i + 1),
      run: () => setTab(t.id),
    }));

    list.push(
      {
        id: "present",
        label: "Mod Pembentangan",
        group: "Tindakan",
        icon: "\u{1F4FD}\uFE0F",
        hint: "untuk mesyuarat",
        run: () => setPresenting(true),
      },
      {
        id: "excel",
        label: "Muat turun Excel",
        group: "Tindakan",
        icon: "\u{1F4C4}",
        run: () => exportToExcel(a, filteredOrders, parsed.fileName),
      },
      {
        id: "pdf",
        label: "Cetak / simpan PDF",
        group: "Tindakan",
        icon: "\u{1F5A8}\uFE0F",
        run: exportToPDF,
      },
      {
        id: "reset",
        label: "Muat naik fail baharu",
        group: "Tindakan",
        icon: "\u{1F4C1}",
        run: onReset,
      },
      {
        id: "sound",
        label: soundOn ? "Matikan bunyi" : "Hidupkan bunyi",
        group: "Tetapan",
        icon: soundOn ? "\u{1F507}" : "\u{1F50A}",
        run: () => {
          const next = !soundOn;
          setSoundEnabled(next);
          setSoundOn(next);
        },
      }
    );
    return list;
  }, [tabs, a, filteredOrders, parsed.fileName, onReset, soundOn]);

  return (
    <div className="min-h-screen blueprint-grid pb-20 overflow-x-hidden">
      <CommandPalette
        commands={commands}
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
      />
      {presenting && (
        <PresentMode analytics={a} onClose={() => setPresenting(false)} />
      )}
      {/* Header strip */}
      <header className="border-b border-surface-700/80 bg-surface-950/60 backdrop-blur sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.28em] text-accent uppercase hidden sm:block">
              Analisis Return & Penghantaran
            </p>
            <h1 className="font-display font-extrabold text-lg sm:text-2xl text-content-100 leading-none sm:mt-1 whitespace-nowrap">
              BIZAPP ANALYZER
            </h1>
            <p className="text-[10.5px] text-content-300/50 mt-0.5 sm:hidden whitespace-nowrap">
              {fmtDateShort(a.dateRange.start)} — {fmtDateShort(a.dateRange.end)}
            </p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0 no-print">
            <button
              onClick={() => { setPaletteOpen(true); sfxTick(); }}
              aria-label="Buka palet arahan"
              title="Palet arahan (Ctrl+K)"
              className="flex items-center gap-1.5 border border-surface-600 rounded-full px-3 py-2 min-h-[38px] hover:bg-surface-700 transition-colors"
            >
              <span className="text-content-300 text-[13px]">⌘</span>
              <kbd className="font-mono text-[10px] text-content-300/70 hidden sm:inline">K</kbd>
            </button>
            <button
              onClick={() => setPresenting(true)}
              aria-label="Mod pembentangan"
              title="Mod pembentangan"
              className="hidden sm:flex items-center border border-surface-600 rounded-full px-3 py-2 min-h-[38px] hover:bg-surface-700 transition-colors text-[13px]"
            >
              📽️
            </button>
            <ThemePicker />
            <div className="text-right hidden lg:block mr-1">
              <p className="font-mono text-[10px] text-content-300/40 uppercase tracking-wider">Tempoh Data</p>
              <p className="text-[13px] text-content-100/80">
                {fmtDateShort(a.dateRange.start)} — {fmtDateShort(a.dateRange.end)}
              </p>
            </div>
            <button
              onClick={() => exportToExcel(a, filteredOrders, parsed.fileName)}
              aria-label="Muat turun Excel"
              className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider border border-stamp-green/50 text-stamp-green px-2.5 sm:px-3 py-2 rounded-sm hover:bg-stamp-green/10 active:bg-stamp-green/20 transition-colors min-h-[38px]"
            >
              Excel
            </button>
            <button
              onClick={exportToPDF}
              aria-label="Cetak PDF"
              className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider border border-surface-500 text-content-300/70 px-2.5 sm:px-3 py-2 rounded-sm hover:bg-surface-700 active:bg-surface-600 transition-colors min-h-[38px]"
            >
              PDF
            </button>
            <button
              onClick={onReset}
              aria-label="Muat naik fail baru"
              className="font-mono text-[10px] sm:text-[11px] uppercase tracking-wider border border-accent/40 text-accent px-2.5 sm:px-3 py-2 rounded-sm hover:bg-accent/10 active:bg-accent/20 transition-colors min-h-[38px]"
            >
              <span className="hidden sm:inline">Fail Baru</span>
              <span className="sm:hidden">Baru</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 mt-5 sm:mt-8 space-y-6 sm:space-y-8">
        {parsed.warnings.length > 0 && (
          <div className="border border-stamp-amber/40 bg-stamp-amber/10 text-stamp-amber text-[13px] px-4 py-3 rounded-sm">
            {parsed.warnings.join(" ")}
          </div>
        )}

        <WelcomeBanner analytics={a} orderCount={parsed.orders.length} processMs={processMs} />

        {parsed.fileNames.length > 1 && (
          <div className="ticket px-5 py-4 sm:px-6 fade-up">
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/45 mb-2.5">
              Sumber Data — {parsed.fileNames.length} Fail
            </p>
            <div className="flex flex-wrap gap-2">
              {parsed.fileNames.map((name) => (
                <span
                  key={name}
                  className="font-mono text-[11px] text-content-100/75 border border-surface-600 rounded-sm px-2.5 py-1"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
        )}

        <FilterBar
          options={filterOptions}
          filters={filters}
          onChange={onFilterChange}
          resultCount={filteredOrders.length}
          totalCount={parsed.orders.length}
        />

        <Tabs tabs={tabs} active={tab} onChange={setTab} />

        {tab === "ringkasan" && (
          <div className="space-y-6 sm:space-y-8">
          <ExecutiveSummary points={a.summary} />
          {/* KPI row */}
          <section className="grid grid-cols-1 min-[380px]:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5">
            <KpiTicket
              manifestNo="NO. 001"
              eyebrow="Jumlah Order"
              value={a.totalOrders.toLocaleString()}
              count={a.totalOrders}
              sub={
                parsed.fileNames.length > 1
                  ? `Gabungan ${parsed.fileNames.length} fail`
                  : parsed.fileName
              }
              accent="accent"
            />
            <KpiTicket
              manifestNo="NO. 002"
              eyebrow="Revenue Collected"
              value={`RM ${a.totalRevenueCollected.toLocaleString()}`}
              count={a.totalRevenueCollected}
              prefix="RM "
              sub={`Potensi penuh: RM ${a.totalRevenuePotential.toLocaleString()}`}
              accent="green"
            />
            <KpiTicket
              manifestNo="NO. 003"
              eyebrow="Return Rate"
              value={`${a.statusBreakdown.find((s) => s.status === "RETURN")?.pct ?? 0}%`}
              count={a.statusBreakdown.find((s) => s.status === "RETURN")?.pct ?? 0}
              suffix="%"
              decimals={1}
              sub={`${a.statusBreakdown.find((s) => s.status === "RETURN")?.count ?? 0} parcel return`}
              accent="red"
            />
            <KpiTicket
              manifestNo="NO. 004"
              eyebrow="Purata / Order"
              value={`RM ${a.avgOrderValue.toLocaleString()}`}
              count={a.avgOrderValue}
              prefix="RM "
              sub={`${a.statusBreakdown.find((s) => s.status === "PENDING")?.count ?? 0} order masih pending`}
              accent="amber"
            />
          </section>
          {/* Status stamp strip */}
          <section className="ticket px-5 py-4 sm:px-6 flex flex-wrap items-center gap-x-3 gap-y-2.5 fade-up">
            <span className="font-mono text-[10px] tracking-[0.2em] text-content-300/45 uppercase w-full sm:w-auto sm:mr-2">
              Status Keseluruhan
            </span>
            {a.statusBreakdown.map((s) => (
              <div key={s.status} className="flex items-center gap-2">
                <StampBadge status={s.status} />
                <span className="font-mono text-[12px] text-content-300/60">
                  {s.count} ({s.pct}%)
                </span>
              </div>
            ))}
          </section>
          {/* Projection + trend */}
          <section className="grid grid-cols-1 lg:grid-cols-5 gap-5 sm:gap-6">
            <div className="lg:col-span-2">
              <ProjectionTicket projection={a.projection} />
            </div>
            <div className="lg:col-span-3">
              <TrendChart data={a.trend} />
            </div>
          </section>
          </div>
        )}

        {tab === "selamatkan" && (
          <div className="space-y-6 sm:space-y-8">

          <section id="parcel-berisiko" className="scroll-mt-24">
            <p className="font-display font-bold text-lg sm:text-xl text-content-100 mb-1">Boleh Diselamatkan</p>
            <p className="text-content-300/70 text-[13px] mb-4">
              Parcel yang masih boleh dikejar — hubungi, tanda status dan punca dalam satu tempat.
            </p>
            <div className="space-y-5 sm:space-y-6">
              <RiskParcelPanel parcels={a.riskParcels} thresholdDays={a.riskThresholdDays} />
              <ReconcilePanel orders={filteredOrders} />
            </div>
          </section>

          <section>
            <p className="font-display font-bold text-lg sm:text-xl text-content-100 mb-1">Ringkasan Tindakan Admin</p>
            <p className="text-content-300/70 text-[13px] mb-4">
              Apa yang admin dah pilih dan buat setakat ini.
            </p>
            <SelamatkanSummaryPanel parcels={a.riskParcels} thresholdDays={a.riskThresholdDays} />
          </section>

          <section>
            <p className="font-display font-bold text-lg sm:text-xl text-content-100 mb-1">
              Sebab Sebenar (Order Yang Dah RETURN)
            </p>
            <p className="text-content-300/70 text-[13px] mb-4">
              Status kurier tidak beritahu kenapa customer menolak. Tanda sebab sebenar di
              sini untuk dapat gambaran yang boleh ditindak.
            </p>
            <CausePanel orders={filteredOrders} />
          </section>

          <section>
            <p className="font-display font-bold text-lg sm:text-xl text-content-100 mb-1">Punca Kerugian</p>
            <p className="text-content-300/70 text-[13px] mb-4">
              Di mana duit hilang, dan corak penghantaran yang menyebabkannya.
            </p>
            <div className="space-y-5 sm:space-y-6">
              <ShippingComparePanel stats={a.shipTypes} />
              <MoneyLostPanel data={a.moneyLost} />
            </div>
          </section>

          {/* Root cause: return + pending reasons */}
          <section>
            <p className="font-display font-bold text-lg sm:text-xl text-content-100 mb-1">Kenapa Sales Bermasalah</p>
            <p className="text-content-300/50 text-[13px] mb-4">
              Pecahan sebab sebenar di sebalik status RETURN dan PENDING — diambil terus dari status parcel kurier.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
              <LedgerBars
                title="Sebab Return (RTO)"
                rows={a.returnReasons.map((r) => ({ label: r.reason, value: r.count, sub: `${r.pct}%` }))}
                color="red"
              />
              <LedgerBars
                title="Sebab Pending / Stuck"
                rows={a.pendingReasons.map((r) => ({ label: r.reason, value: r.count, sub: `${r.pct}%` }))}
                color="amber"
              />
            </div>
          </section>

          {/* Risk lists */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
            <LedgerBars
              title="Produk Risiko Tinggi (Return Rate)"
              rows={a.topRiskProducts.map((p) => ({
                label: p.product,
                value: p.returnRate,
                sub: `${p.returned}/${p.totalOrders} order`,
              }))}
              valueSuffix="%"
              color="red"
            />
            <LedgerBars
              title="Kawasan Risiko Tinggi (Return Rate)"
              rows={a.topRiskRegions.map((r) => ({
                label: r.region,
                value: r.returnRate,
                sub: `${r.returned}/${r.totalOrders} order`,
              }))}
              valueSuffix="%"
              color="red"
            />
          </section>

          </div>
        )}

        {tab === "bulanan" && (
          <div className="space-y-6 sm:space-y-8">
          {/* Monthly recap + comparison */}
          {a.monthlyRecaps.length > 0 && (
            <section>
              <p className="font-display font-bold text-lg sm:text-xl text-content-100 mb-1">Analisis Ikut Bulan</p>
              <p className="text-content-300/50 text-[13px] mb-4">
                Pecahan status & jualan setiap bulan, plus perbandingan bulan ke bulan.
              </p>
              <div className="space-y-6">
                <MonthlyRecapPanel recaps={a.monthlyRecaps} />
                {a.monthComparison.length > 1 && (
                  <MonthComparisonPanel rows={a.monthComparison} maturity={a.monthMaturity} />
                )}
              </div>
            </section>
          )}
          {a.monthlyRecaps.length === 0 && (
            <div className="ticket px-6 py-10 text-center">
              <p className="text-content-300 text-[14px]">
                Tiada data bulanan — pastikan fail mengandungi tarikh tempahan.
              </p>
            </div>
          )}
          </div>
        )}

        {tab === "produk" && (
          <div className="space-y-6 sm:space-y-8">
          {/* Product & courier comparison */}
          <section>
            <p className="font-display font-bold text-lg sm:text-xl text-content-100 mb-1">Perbandingan Produk & Kurier</p>
            <p className="text-content-300/50 text-[13px] mb-4">
              Status mix (Collected / Return / Pending) mengikut produk dan pembekal kurier.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
              <ComparisonChart title="Produk — Status Mix" data={productRows} />
              <ComparisonChart title="Kurier — Status Mix" data={courierRows} />
            </div>
          </section>
          </div>
        )}

        {tab === "orang" && (
          <div className="space-y-6 sm:space-y-8">
          {/* Customers */}
          <section>
            <p className="font-display font-bold text-lg sm:text-xl text-content-100 mb-1">Pelanggan</p>
            <p className="text-content-300/50 text-[13px] mb-4">
              Siapa beli berulang, siapa paling bernilai, dan siapa perlu dipantau.
            </p>
            <CustomerPanel data={a.customers} />
          </section>
          {/* Agent quality + raw table */}
          <section className="space-y-6">
            <AgentQualityPanel rows={a.agentQuality} />
            <ManifestTable agents={a.agents} />
          </section>
          </div>
        )}

        {tab === "panggil" && (
          <div className="space-y-6 sm:space-y-8">
            <section>
              <p className="font-display font-bold text-lg sm:text-xl text-content-100 mb-1">
                Panggilan Keutamaan Hari Ini
              </p>
              <p className="text-content-300/70 text-[13px] mb-4">
                Disusun mengikut nilai order, kadar pemulihan sebab return, dan kesetiaan
                customer — hubungi dari atas ke bawah.
              </p>
              <CallQueuePanel orders={filteredOrders} />
            </section>
          </div>
        )}

        {tab === "reprocess" && (
          <div className="space-y-6 sm:space-y-8">
            <section>
              <p className="font-display font-bold text-lg sm:text-xl text-content-100 mb-1">
                Proses Semula Order Return
              </p>
              <p className="text-content-300/70 text-[13px] mb-4">
                Hubungi customer yang parcelnya dipulangkan, dan jejak berapa banyak jualan
                berjaya dipulihkan.
              </p>
              <ReprocessPanel orders={filteredOrders} />
            </section>
          </div>
        )}

        {tab === "promo" && (
          <div className="space-y-6 sm:space-y-8">
            <PromoPlanner />
          </div>
        )}

        <footer className="text-center pt-6">
          <p className="font-mono text-[10px] tracking-[0.2em] text-content-300/30 uppercase">
            Bizapp Analyzer — Diproses secara lokal dalam browser, tiada data dihantar ke server
          </p>
        </footer>
      </main>
    </div>
  );
}
