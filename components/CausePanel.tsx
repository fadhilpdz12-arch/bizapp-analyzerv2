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
import { Order } from "@/lib/types";
import {
  CauseRecord,
  addCause,
  causeKey,
  exportCauses,
  groupCauses,
  importCauses,
  loadCauseMap,
  loadCauses,
  removeCause,
  saveCauseMap,
  summariseCauses,
  DEFAULT_CAUSES,
  TaggedOrder,
} from "@/lib/returnCause";
import {
  CHART,
  TOOLTIP_STYLE,
  TOOLTIP_ITEM,
  tickStyle,
  tickStyleStrong,
  useAccent,
} from "@/lib/chartTheme";
import { sfxSave } from "@/lib/sfx";
import CountUp from "./CountUp";

const PALETTE = ["#E8203C", "#C67C08", "#7C4DFF", "#12A150", "#4F46E5", "#0D9488", "#8B96AD"];

function rm(n: number) {
  return `RM ${Math.round(n).toLocaleString()}`;
}

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CausePanel({ orders }: { orders: Order[] }) {
  const accent = useAccent();
  const [map, setMap] = useState<Record<string, CauseRecord>>({});
  const [causes, setCauses] = useState<string[]>([...DEFAULT_CAUSES]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [onlyUntagged, setOnlyUntagged] = useState(true);
  const [newCause, setNewCause] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMap(loadCauseMap());
    setCauses(loadCauses());
    setReady(true);
  }, []);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  }, []);

  // Only RETURN orders can carry a cause.
  const returns = useMemo(
    () =>
      orders.filter(
        (o) =>
          o.status === "RETURN" &&
          o.trackingNo &&
          o.trackingNo.toUpperCase() !== "BATAL"
      ),
    [orders]
  );

  const tagged: TaggedOrder[] = useMemo(
    () =>
      returns
        .map((o) => {
          const rec = map[causeKey(o.trackingNo)];
          return rec
            ? {
                trackingNo: o.trackingNo,
                product: o.product,
                amount: o.amount,
                region: o.region,
                agent: o.agent,
                cause: rec.cause,
              }
            : null;
        })
        .filter((t): t is TaggedOrder => t !== null),
    [returns, map]
  );

  const stats = useMemo(() => summariseCauses(tagged), [tagged]);
  const groups = useMemo(() => groupCauses(tagged), [tagged]);
  const untaggedCount = returns.length - tagged.length;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return returns
      .filter((o) => {
        if (onlyUntagged && map[causeKey(o.trackingNo)]) return false;
        if (!q) return true;
        return (
          o.customerName.toLowerCase().includes(q) ||
          o.phone.toLowerCase().includes(q) ||
          o.trackingNo.toLowerCase().includes(q) ||
          o.product.toLowerCase().includes(q)
        );
      })
      .slice(0, 150);
  }, [returns, map, query, onlyUntagged]);

  const tag = useCallback(
    (tracking: string, cause: string) => {
      const k = causeKey(tracking);
      setMap((prev) => {
        const next = { ...prev };
        if (!cause) {
          delete next[k];
        } else {
          next[k] = { cause, updatedAt: new Date().toISOString() };
        }
        if (!saveCauseMap(next)) {
          flash("Gagal menyimpan — storan browser mungkin penuh.");
          return prev;
        }
        if (cause) sfxSave();
        return next;
      });
    },
    [flash]
  );

  const doImport = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = importCauses(String(reader.result), map);
        if (!res.ok || !res.merged) {
          flash(res.message);
          return;
        }
        setMap(res.merged);
        saveCauseMap(res.merged);
        setCauses(loadCauses());
        flash(res.message);
      };
      reader.readAsText(file);
    },
    [map, flash]
  );

  if (!ready) {
    return <div className="ticket p-6"><p className="text-content-300 text-[13px]">Memuatkan…</p></div>;
  }

  if (returns.length === 0) {
    return (
      <div className="ticket px-6 py-10 text-center">
        <p className="font-display font-bold text-lg text-content-100 mb-1">
          Tiada order RETURN untuk ditanda
        </p>
        <p className="text-content-300 text-[13.5px]">
          Muat naik fail yang mengandungi order berstatus RETURN.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="notice notice-info px-4 py-3 text-[13px] text-content-100">{toast}</div>
      )}

      {/* Coverage — how much of the picture is actually known */}
      <div className="ticket p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/60">
              Sebab Sebenar Return
            </p>
            <p className="text-content-300/70 text-[13px] mt-1.5 max-w-lg leading-relaxed">
              Status kurier hanya beritahu parcel dipulangkan — bukan kenapa. Tanda sebab
              sebenar selepas menghubungi customer, dan sistem akan tunjuk punca mana paling
              banyak merugikan.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-display font-extrabold text-[1.9rem] text-content-100 leading-none">
              <CountUp value={tagged.length} />
              <span className="text-content-300/50 text-[1.1rem] font-body font-normal">
                {" "}/ {returns.length}
              </span>
            </p>
            <p className="font-mono text-[10.5px] text-content-300/60 mt-1">sudah ditanda</p>
          </div>
        </div>

        <div className="h-1.5 bg-surface-700 rounded-full overflow-hidden mt-4">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${returns.length ? (tagged.length / returns.length) * 100 : 0}%`,
              background: accent,
            }}
          />
        </div>

        {untaggedCount > 0 && (
          <p className="text-[12.5px] text-content-300/70 mt-2.5">
            {untaggedCount} order belum ditanda. Semakin banyak ditanda, semakin tepat analisis
            di bawah.
          </p>
        )}
      </div>

      {/* Analysis — only meaningful once tagging has begun */}
      {tagged.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <GroupCard
              label="Order Palsu"
              hint="Joy Buyers"
              count={groups.fakeOrders}
              value={groups.fakeValue}
              tone="red"
              action="Ketatkan borang order — minta pengesahan sebelum hantar."
            />
            <GroupCard
              label="Masalah Penghantaran"
              hint="Tiada Inform Dari Rider"
              count={groups.delivery}
              value={groups.deliveryValue}
              tone="amber"
              action="Bawa isu ini kepada kurier, atau tukar kurier untuk kawasan tersebut."
            />
            <GroupCard
              label="Masalah Customer"
              hint="Confirmation Reply/Done Reminder · Confirmation Tidak Reply/Done Reminder · Whatsapp Tidak Reply/Done Reminder · Done Reminder · Confirmation Reply · Confirmation Tidak Reply · Cancel Order · Lain-lain"
              count={groups.customer}
              value={groups.customerValue}
              tone="accent"
              action="Perbaiki susulan sebelum hantar — sahkan melalui WhatsApp dahulu."
            />
          </div>

          <div className="ticket p-5 sm:p-6">
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/60 mb-1">
              Sebab Paling Banyak
            </p>
            <p className="text-content-300/70 text-[12.5px] mb-4">
              Berdasarkan {tagged.length} order yang sudah ditanda.
            </p>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats} layout="vertical" margin={{ left: 8, right: 20 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke={CHART.grid} horizontal={false} />
                  <XAxis type="number" tick={tickStyle} axisLine={{ stroke: CHART.axisLine }} tickLine={false} />
                  <YAxis
                    type="category"
                    dataKey="cause"
                    tick={tickStyleStrong}
                    axisLine={false}
                    tickLine={false}
                    width={170}
                  />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    itemStyle={TOOLTIP_ITEM}
                    cursor={{ fill: CHART.cursor }}
                  />
                  <Bar dataKey="count" name="Order" radius={[0, 3, 3, 0]}>
                    {stats.map((s, i) => (
                      <Cell key={s.cause} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="overflow-x-auto scroll-hint mt-4">
              <table className="w-full text-[12.5px] min-w-[520px]">
                <thead>
                  <tr className="text-content-300/50 font-mono text-[9.5px] uppercase tracking-wider border-b border-surface-600">
                    <th className="text-left font-medium pb-2">Sebab</th>
                    <th className="text-right font-medium pb-2">Order</th>
                    <th className="text-right font-medium pb-2">% </th>
                    <th className="text-right font-medium pb-2">Nilai Hilang</th>
                    <th className="text-left font-medium pb-2 pl-4">Produk Paling Terjejas</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.cause} className="border-b border-surface-600/60 last:border-0">
                      <td className="py-2.5 text-content-100/90">{s.cause}</td>
                      <td className="py-2.5 text-right font-mono text-content-300">{s.count}</td>
                      <td className="py-2.5 text-right font-mono text-content-100">{s.pct}%</td>
                      <td className="py-2.5 text-right font-mono text-stamp-red">{rm(s.value)}</td>
                      <td className="py-2.5 pl-4 text-content-300/80 truncate max-w-[200px]">
                        {s.topProduct}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Tagging list */}
      <div className="ticket p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/60">
              Tanda Sebab
            </p>
            <p className="text-content-300/70 text-[12.5px] mt-1">
              Pilih sebab untuk setiap order. Disimpan automatik.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setManageOpen((v) => !v)} className="btn-soft">
              Urus Senarai Sebab
            </button>
            <button
              onClick={() => {
                download(`sebab-return-${new Date().toISOString().slice(0, 10)}.json`, exportCauses(map));
                flash("Fail sebab dimuat turun.");
              }}
              className="btn-soft"
            >
              Eksport
            </button>
            <button onClick={() => importRef.current?.click()} className="btn-soft">Import</button>
            <input
              ref={importRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => { doImport(e.target.files?.[0]); e.target.value = ""; }}
            />
          </div>
        </div>

        {manageOpen && (
          <div className="border border-surface-600 rounded-xl p-4 mb-4 space-y-3">
            <p className="font-mono text-[9px] uppercase tracking-wider text-content-300/50">
              Senarai sebab
            </p>
            <div className="flex flex-wrap gap-2">
              {causes.map((c) => {
                const isDefault = (DEFAULT_CAUSES as readonly string[]).includes(c);
                return (
                  <span
                    key={c}
                    className="flex items-center gap-1.5 text-[12px] border border-surface-600 rounded-full px-2.5 py-1 text-content-100"
                  >
                    {c}
                    {!isDefault && (
                      <button
                        onClick={() => setCauses(removeCause(c))}
                        className="text-content-300/60 hover:text-stamp-red"
                        aria-label={`Buang ${c}`}
                      >
                        ×
                      </button>
                    )}
                  </span>
                );
              })}
            </div>
            <div className="flex gap-2">
              <input
                value={newCause}
                onChange={(e) => setNewCause(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newCause.trim()) {
                    setCauses(addCause(newCause));
                    setNewCause("");
                  }
                }}
                placeholder="Contoh: Tukar fikiran"
                className="input flex-1"
              />
              <button
                onClick={() => {
                  if (newCause.trim()) {
                    setCauses(addCause(newCause));
                    setNewCause("");
                  }
                }}
                className="btn-accent"
              >
                Tambah
              </button>
            </div>
            <p className="text-content-300/60 text-[11.5px]">
              Sebab asal tidak boleh dibuang. Sebab tambahan anda akan muncul untuk semua order.
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari nama, telefon, tracking…"
            className="input flex-1 min-w-[200px]"
          />
          <label className="flex items-center gap-2 text-[12.5px] text-content-300 cursor-pointer">
            <input
              type="checkbox"
              checked={onlyUntagged}
              onChange={(e) => setOnlyUntagged(e.target.checked)}
              className="[accent-color:rgb(var(--accent))]"
            />
            Belum ditanda sahaja
          </label>
        </div>

        <div className="space-y-2">
          {visible.map((o) => {
            const k = causeKey(o.trackingNo);
            const rec = map[k];
            return (
              <div
                key={k}
                className="border border-surface-600 rounded-xl px-3.5 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-medium text-content-100">{o.customerName}</p>
                  <p className="text-[12px] text-content-300/80 mt-0.5">
                    {o.product} · {o.phone} · RM {o.amount}
                  </p>
                </div>
                <select
                  value={rec?.cause ?? ""}
                  onChange={(e) => tag(o.trackingNo, e.target.value)}
                  className={`input sm:w-[230px] ${rec ? "border-accent/50" : ""}`}
                >
                  <option value="">— Pilih sebab —</option>
                  {causes.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            );
          })}

          {visible.length === 0 && (
            <p className="text-content-300 text-[13px] py-8 text-center">
              {onlyUntagged
                ? "Semua order sudah ditanda. Nyahtanda kotak di atas untuk semak semula."
                : "Tiada order sepadan dengan carian."}
            </p>
          )}
        </div>

        {returns.length > 150 && visible.length === 150 && (
          <p className="font-mono text-[11px] text-content-300/60 mt-3">
            Menunjukkan 150 baris pertama. Gunakan carian untuk menyempitkan.
          </p>
        )}
      </div>

      <p className="text-content-300/60 text-[11.5px] leading-relaxed">
        Tag disimpan dalam browser komputer ini. Gunakan <strong>Eksport</strong> dan{" "}
        <strong>Import</strong> untuk berkongsi dengan rakan sepasukan — bila dua orang menanda
        order yang sama, tag terbaharu digunakan.
      </p>
    </div>
  );
}

function GroupCard({
  label,
  hint,
  count,
  value,
  tone,
  action,
}: {
  label: string;
  hint: string;
  count: number;
  value: number;
  tone: "red" | "amber" | "accent";
  action: string;
}) {
  const colour =
    tone === "red" ? "text-stamp-red" : tone === "amber" ? "text-stamp-amber" : "text-accent";
  return (
    <div className="ticket p-4 sm:p-5">
      <p className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-content-300/60">
        {label}
      </p>
      <p className={`font-display font-extrabold text-[1.8rem] leading-none mt-1.5 ${colour}`}>
        <CountUp value={count} />
      </p>
      <p className="text-[12px] text-content-300/70 mt-1">{rm(value)} hilang · {hint}</p>
      <p className="text-[11.5px] text-content-300/60 mt-2.5 pt-2.5 border-t border-surface-600 leading-relaxed">
        {action}
      </p>
    </div>
  );
}
