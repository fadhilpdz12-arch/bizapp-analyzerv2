"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Cell,
} from "recharts";
import * as XLSX from "xlsx";
import { Order } from "@/lib/types";
import {
  ReprocessRow,
  ReprocessStatus,
  STATUSES,
  TrackingState,
  buildWorkList,
  loadTracking,
  saveTracking,
  summarise,
  recoveryByReason,
  recoveryByProduct,
  statusBreakdown,
  exportTracking,
  importTracking,
  trackingKey,
  blankState,
} from "@/lib/reprocess";
import {
  CHART,
  SERIES,
  TOOLTIP_STYLE,
  TOOLTIP_ITEM,
  tickStyle,
  tickStyleStrong,
  useAccent,
} from "@/lib/chartTheme";
import CountUp from "./CountUp";
import RecoveryGoal from "./RecoveryGoal";
import StreakPanel from "./StreakPanel";
import { sfxSuccess, sfxSave, sfxError } from "@/lib/sfx";
import { recordActivity } from "@/lib/engagement";

const STATUS_STYLE: Record<ReprocessStatus, string> = {
  "Belum Hubungi": "text-content-300 border-surface-500 bg-surface-700",
  "Cuba Hubungi": "text-stamp-amber border-stamp-amber/40 bg-stamp-amber/10",
  "Berjaya Re-order": "text-stamp-green border-stamp-green/40 bg-stamp-green/10",
  "Tolak": "text-stamp-red border-stamp-red/40 bg-stamp-red/10",
  "Tak Dapat Dihubungi": "text-content-300 border-surface-500 bg-surface-700",
};

const STATUS_FILL: Record<ReprocessStatus, string> = {
  "Belum Hubungi": "#C3CBD9",
  "Cuba Hubungi": SERIES.amber,
  "Berjaya Re-order": SERIES.green,
  "Tolak": SERIES.red,
  "Tak Dapat Dihubungi": "#8B96AD",
};

function rm(n: number): string {
  return `RM ${n.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

function download(name: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function ReprocessPanel({ orders }: { orders: Order[] }) {
  const accent = useAccent();
  const [tracking, setTracking] = useState<Record<string, TrackingState>>({});
  const [ready, setReady] = useState(false);
  const [filter, setFilter] = useState<ReprocessStatus | "semua">("semua");
  const [query, setQuery] = useState("");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [activityTick, setActivityTick] = useState(0);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTracking(loadTracking());
    setReady(true);
  }, []);

  const flash = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const rows = useMemo(
    () => buildWorkList(orders, tracking),
    [orders, tracking]
  );
  const summary = useMemo(() => summarise(rows), [rows]);
  const byReason = useMemo(() => recoveryByReason(rows).slice(0, 8), [rows]);
  const byProduct = useMemo(() => recoveryByProduct(rows).slice(0, 8), [rows]);
  const byStatus = useMemo(() => statusBreakdown(rows), [rows]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filter !== "semua" && r.state.status !== filter) return false;
      if (!q) return true;
      return (
        r.customerName.toLowerCase().includes(q) ||
        r.phone.toLowerCase().includes(q) ||
        r.trackingNo.toLowerCase().includes(q) ||
        r.product.toLowerCase().includes(q)
      );
    });
  }, [rows, filter, query]);

  const update = useCallback(
    (row: ReprocessRow, patch: Partial<TrackingState>) => {
      const k = trackingKey(row.trackingNo);
      setTracking((prev) => {
        const base = prev[k] ?? blankState();
        const next = {
          ...prev,
          [k]: { ...base, ...patch, updatedAt: new Date().toISOString() },
        };
        if (!saveTracking(next)) {
          flash("Gagal menyimpan — storan browser mungkin penuh.");
          sfxError();
          return prev;
        }
        // A recovery is the moment worth hearing; other edits get a soft tick.
        if (patch.status === "Berjaya Re-order" && base.status !== "Berjaya Re-order") {
          sfxSuccess();
          recordActivity(patch.reorderAmount ?? row.originalAmount);
        } else if (patch.status) {
          sfxSave();
          recordActivity(0);
        }
        if (patch.status) setActivityTick((t) => t + 1);
        return next;
      });
    },
    [flash]
  );

  const doExport = useCallback(() => {
    download(
      `jejak-reprocess-${new Date().toISOString().slice(0, 10)}.json`,
      exportTracking(tracking)
    );
    flash("Fail jejak dimuat turun. Hantar kepada rakan sepasukan untuk digabungkan.");
  }, [tracking, flash]);

  const doImport = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = importTracking(String(reader.result), tracking);
        if (!res.ok || !res.merged) {
          flash(res.message);
          return;
        }
        setTracking(res.merged);
        saveTracking(res.merged);
        flash(res.message);
      };
      reader.readAsText(file);
    },
    [tracking, flash]
  );

  const exportExcel = useCallback(() => {
    const data = rows.map((r) => ({
      "No. Tracking": r.trackingNo,
      Customer: r.customerName,
      Telefon: r.phone,
      Produk: r.product,
      "Nilai Asal (RM)": r.originalAmount,
      Kuantiti: r.quantity,
      Ejen: r.agent,
      "Sebab Return": r.returnReason,
      Kawasan: r.region,
      Status: r.state.status,
      "Tarikh Dihubungi": r.state.contactedAt ?? "",
      "Nilai Re-order (RM)": r.state.reorderAmount ?? "",
      "Unit Re-order": r.state.reorderUnits ?? "",
      "Dikendali Oleh": r.state.handledBy ?? "",
      Catatan: r.state.note ?? "",
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), "Reprocess");
    XLSX.writeFile(wb, `reprocess-return-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [rows]);

  if (!ready) {
    return (
      <div className="ticket p-6">
        <p className="text-content-300 text-[13px]">Memuatkan rekod jejak…</p>
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="ticket px-6 py-10 text-center">
        <p className="font-display font-bold text-lg text-content-100 mb-1">
          Tiada order RETURN dalam fail ini
        </p>
        <p className="text-content-300 text-[13.5px]">
          Muat naik fail Bizapp yang mengandungi order berstatus RETURN untuk mula
          memproses semula.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {toast && (
        <div className="notice notice-info px-4 py-3 text-[13px] text-content-100">
          {toast}
        </div>
      )}

      <StreakPanel
        refreshKey={activityTick}
        ctx={{
          recoveredTotal: summary.recoveredSales,
          reorderCount: summary.reorder,
          processedCount: summary.processed,
          totalReturns: summary.total,
        }}
      />

      <RecoveryGoal recovered={summary.recoveredSales} />

      {/* ── KPI tiles ─────────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Tile label="Jumlah Return" value={summary.total} sub="dalam senarai kerja" />
        <Tile
          label="Telah Diproses"
          value={summary.processed}
          sub={`${summary.contactRate}% dihubungi`}
          tone="accent"
        />
        <Tile
          label="Belum Diproses"
          value={summary.pending}
          sub="perlu dihubungi"
          tone="amber"
        />
        <Tile
          label="Berjaya Re-order"
          value={summary.reorder}
          sub={`${summary.recoveryRate}% kadar pemulihan`}
          tone="green"
        />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <Tile
          label="Jualan Dipulihkan"
          value={summary.recoveredSales}
          money
          sub={`purata ${rm(summary.avgReorderValue)} sepemulihan`}
          tone="green"
        />
        <Tile label="Unit Dipulihkan" value={summary.recoveredUnits} sub="unit dihantar semula" />
        <Tile
          label="Nilai Hilang"
          value={summary.lostValue}
          money
          sub={`${summary.declined + summary.unreachable} tolak / tak dapat dihubungi`}
          tone="red"
        />
      </section>

      {/* ── Charts ────────────────────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 sm:gap-6">
        <div className="ticket p-5 sm:p-6">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/60 mb-4">
            Taburan Status
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byStatus} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" tick={tickStyle} axisLine={{ stroke: CHART.axisLine }} tickLine={false} />
                <YAxis type="category" dataKey="status" tick={tickStyleStrong} axisLine={false} tickLine={false} width={130} />
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} cursor={{ fill: CHART.cursor }} />
                <Bar dataKey="count" name="Order" radius={[0, 3, 3, 0]}>
                  {byStatus.map((s) => (
                    <Cell key={s.status} fill={STATUS_FILL[s.status]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="ticket p-5 sm:p-6">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/60 mb-1">
            Jualan Dipulihkan Mengikut Produk
          </p>
          <p className="text-content-300/70 text-[12.5px] mb-3">
            Produk mana paling berbaloi dikejar semula.
          </p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byProduct} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" tick={tickStyle} axisLine={{ stroke: CHART.axisLine }} tickLine={false} />
                <YAxis type="category" dataKey="product" tick={tickStyleStrong} axisLine={false} tickLine={false} width={140} />
                <Tooltip contentStyle={TOOLTIP_STYLE} itemStyle={TOOLTIP_ITEM} cursor={{ fill: CHART.cursor }} />
                <Bar dataKey="recovered" name="Dipulihkan (RM)" fill={accent} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* ── Which reasons convert ─────────────────────────────────────── */}
      <div className="ticket p-5 sm:p-6">
        <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/60 mb-1">
          Kadar Pemulihan Mengikut Sebab Return
        </p>
        <p className="text-content-300/70 text-[12.5px] mb-4">
          Sebab yang paling mudah dipulihkan patut diutamakan dalam senarai panggilan.
        </p>
        <div className="overflow-x-auto scroll-hint">
          <table className="w-full text-[12.5px] min-w-[520px]">
            <thead>
              <tr className="text-content-300/50 font-mono text-[9.5px] uppercase tracking-wider border-b border-surface-600">
                <th className="text-left font-medium pb-2">Sebab Return</th>
                <th className="text-right font-medium pb-2">Jumlah</th>
                <th className="text-right font-medium pb-2">Re-order</th>
                <th className="text-right font-medium pb-2">Kadar</th>
                <th className="text-right font-medium pb-2">Dipulihkan</th>
              </tr>
            </thead>
            <tbody>
              {byReason.map((r) => (
                <tr key={r.reason} className="border-b border-surface-600/60 last:border-0">
                  <td className="py-2.5 text-content-100/90">{r.reason}</td>
                  <td className="py-2.5 text-right font-mono text-content-300">{r.total}</td>
                  <td className="py-2.5 text-right font-mono text-stamp-green">{r.reorder}</td>
                  <td className="py-2.5 text-right font-mono text-content-100">{r.rate}%</td>
                  <td className="py-2.5 text-right font-mono text-accent">{rm(r.recovered)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Work list ─────────────────────────────────────────────────── */}
      <div className="ticket p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/60">
              Senarai Kerja
            </p>
            <p className="text-content-300/70 text-[12.5px] mt-1">
              Klik mana-mana baris untuk kemas kini status. Perubahan disimpan automatik.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportExcel} className="btn-soft">Excel</button>
            <button onClick={doExport} className="btn-soft">Eksport Jejak</button>
            <button onClick={() => importRef.current?.click()} className="btn-soft">
              Import Jejak
            </button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                doImport(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, telefon, tracking…"
            className="flex-1 min-w-[200px] bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-[13px] focus:border-accent focus:outline-none"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as ReprocessStatus | "semua")}
            className="bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-[13px] min-h-[38px]"
          >
            <option value="semua">Semua status ({rows.length})</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s} ({rows.filter((r) => r.state.status === s).length})
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          {visible.slice(0, 200).map((r) => {
            const k = trackingKey(r.trackingNo);
            const isOpen = openRow === k;
            return (
              <div key={k} className="border border-surface-600 rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenRow(isOpen ? null : k)}
                  className="w-full flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-3 text-left hover:bg-surface-700/60 transition-colors"
                >
                  <span
                    className={`font-mono text-[9.5px] uppercase tracking-wider border rounded-full px-2 py-1 whitespace-nowrap ${STATUS_STYLE[r.state.status]}`}
                  >
                    {r.state.status}
                  </span>
                  <span className="text-[13.5px] text-content-100 font-medium truncate max-w-[190px]">
                    {r.customerName}
                  </span>
                  <span className="font-mono text-[12px] text-content-300/80">{r.phone}</span>
                  <span className="text-[12.5px] text-content-300 truncate max-w-[200px] hidden sm:inline">
                    {r.product}
                  </span>
                  <span className="ml-auto font-mono text-[13px] text-content-100 font-semibold">
                    {rm(r.originalAmount)}
                  </span>
                </button>

                {isOpen && (
                  <div className="border-t border-surface-600 bg-surface-950/40 px-3.5 py-4 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                      <Meta label="Tracking" value={r.trackingNo} mono />
                      <Meta label="Sebab Return" value={r.returnReason} />
                      <Meta label="Ejen" value={r.agent || "—"} />
                      <Meta label="Kawasan" value={r.region || "—"} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      <Field label="Status">
                        <select
                          value={r.state.status}
                          onChange={(e) =>
                            update(r, { status: e.target.value as ReprocessStatus })
                          }
                          className="input"
                        >
                          {STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </Field>

                      <Field label="Tarikh Dihubungi">
                        <input
                          type="date"
                          value={r.state.contactedAt ?? ""}
                          onChange={(e) => update(r, { contactedAt: e.target.value })}
                          className="input"
                        />
                      </Field>

                      <Field label="Nilai Re-order (RM)">
                        <input
                          type="number"
                          min={0}
                          placeholder={String(r.originalAmount)}
                          value={r.state.reorderAmount ?? ""}
                          onChange={(e) =>
                            update(r, {
                              reorderAmount: e.target.value === "" ? undefined : Number(e.target.value),
                            })
                          }
                          className="input"
                        />
                      </Field>

                      <Field label="Unit Re-order">
                        <input
                          type="number"
                          min={0}
                          placeholder={String(r.quantity)}
                          value={r.state.reorderUnits ?? ""}
                          onChange={(e) =>
                            update(r, {
                              reorderUnits: e.target.value === "" ? undefined : Number(e.target.value),
                            })
                          }
                          className="input"
                        />
                      </Field>

                      <Field label="Dikendali Oleh">
                        <input
                          value={r.state.handledBy ?? ""}
                          onChange={(e) => update(r, { handledBy: e.target.value })}
                          placeholder="Nama admin"
                          className="input"
                        />
                      </Field>

                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Catatan">
                          <input
                            value={r.state.note ?? ""}
                            onChange={(e) => update(r, { note: e.target.value })}
                            placeholder="Contoh: minta call semula minggu depan"
                            className="input"
                          />
                        </Field>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {visible.length > 200 && (
          <p className="font-mono text-[11px] text-content-300/60 mt-3">
            Menunjukkan 200 daripada {visible.length} baris. Gunakan carian untuk menyempitkan.
          </p>
        )}
        {visible.length === 0 && (
          <p className="text-content-300 text-[13px] py-6 text-center">
            Tiada baris sepadan dengan tapisan ini.
          </p>
        )}
      </div>

      <p className="text-content-300/60 text-[11.5px] leading-relaxed">
        Rekod jejak disimpan dalam browser komputer ini sahaja. Untuk berkongsi dengan
        rakan sepasukan, tekan <strong>Eksport Jejak</strong> dan hantar fail itu — mereka
        tekan <strong>Import Jejak</strong>. Bila dua orang mengedit rekod yang sama,
        kemas kini terbaharu akan digunakan.
      </p>
    </div>
  );
}

// ── Small building blocks ──────────────────────────────────────────────────

function Tile({
  label,
  value,
  sub,
  money,
  tone = "ink",
}: {
  label: string;
  value: number;
  sub?: string;
  money?: boolean;
  tone?: "ink" | "accent" | "green" | "red" | "amber";
}) {
  const colour =
    tone === "accent" ? "text-accent"
    : tone === "green" ? "text-stamp-green"
    : tone === "red" ? "text-stamp-red"
    : tone === "amber" ? "text-stamp-amber"
    : "text-content-100";

  return (
    <div className="ticket px-4 py-3.5 sm:px-5 sm:py-4">
      <p className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-content-300/60">
        {label}
      </p>
      <p className={`font-display font-extrabold text-[1.6rem] sm:text-[1.9rem] leading-none mt-1.5 ${colour}`}>
        {money ? <CountUp value={value} prefix="RM " /> : <CountUp value={value} />}
      </p>
      {sub && <p className="text-[11.5px] text-content-300/70 mt-1.5">{sub}</p>}
    </div>
  );
}

function Meta({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-wider text-content-300/50">{label}</p>
      <p className={`mt-0.5 text-content-100/90 ${mono ? "font-mono text-[11.5px]" : "text-[12.5px]"}`}>
        {value}
      </p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] uppercase tracking-wider text-content-300/50">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
