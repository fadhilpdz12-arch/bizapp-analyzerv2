"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Order } from "@/lib/types";
import {
  ReprocessRow,
  ReprocessStatus,
  TrackingState,
  blankState,
  loadTracking,
  saveTracking,
  buildWorkList,
  trackingKey,
} from "@/lib/reprocess";
import { buildLeads, todaysQueue, queueValue, WinBackLead, SCRIPT_TOKENS } from "@/lib/winback";
import { loadPlans, PromoPlan } from "@/lib/promoPlanner";
import { sfxSuccess, sfxSave } from "@/lib/sfx";
import { recordActivity } from "@/lib/engagement";
import CountUp from "./CountUp";

function rm(n: number) {
  return `RM ${n.toLocaleString("en-MY", { maximumFractionDigits: 0 })}`;
}

export default function CallQueuePanel({
  orders,
  onActivity,
}: {
  orders: Order[];
  onActivity?: () => void;
}) {
  const [tracking, setTracking] = useState<Record<string, TrackingState>>({});
  const [plans, setPlans] = useState<PromoPlan[]>([]);
  const [planId, setPlanId] = useState<string>("");
  const [size, setSize] = useState(15);
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    setTracking(loadTracking());
    const p = loadPlans().filter((x) => x.status === "Aktif" || x.status === "Draf");
    setPlans(p);
    // Prefer an active campaign's script as the default message.
    const active = p.find((x) => x.status === "Aktif" && x.offerScript.trim());
    if (active) setPlanId(active.id);
    setReady(true);
  }, []);

  const rows: ReprocessRow[] = useMemo(
    () => buildWorkList(orders, tracking),
    [orders, tracking]
  );

  const script = useMemo(
    () => plans.find((p) => p.id === planId)?.offerScript ?? "",
    [plans, planId]
  );

  const leads = useMemo(
    () => buildLeads({ rows, allOrders: orders, script }),
    [rows, orders, script]
  );

  const queue = useMemo(() => todaysQueue(leads, size), [leads, size]);
  const value = useMemo(() => queueValue(queue), [queue]);

  const update = useCallback(
    (lead: WinBackLead, patch: Partial<TrackingState>) => {
      const k = trackingKey(lead.trackingNo);
      setTracking((prev) => {
        const base = prev[k] ?? blankState();
        const next = {
          ...prev,
          [k]: { ...base, ...patch, updatedAt: new Date().toISOString() },
        };
        if (!saveTracking(next)) return prev;

        const won =
          patch.status === "Berjaya Re-order" && base.status !== "Berjaya Re-order";
        if (won) sfxSuccess();
        else sfxSave();

        recordActivity(won ? patch.reorderAmount ?? lead.originalAmount : 0);
        onActivity?.();
        return next;
      });
    },
    [onActivity]
  );

  const copyScript = useCallback((lead: WinBackLead) => {
    // The wa.me link carries the rendered message; pull it back out so the
    // admin can paste it anywhere, not just WhatsApp.
    const text = decodeURIComponent(lead.waLink.split("?text=")[1] ?? "");
    navigator.clipboard?.writeText(text).then(
      () => {
        setCopied(lead.trackingNo);
        setTimeout(() => setCopied(null), 2000);
      },
      () => setCopied(null)
    );
  }, []);

  if (!ready) {
    return <div className="ticket p-6"><p className="text-content-300 text-[13px]">Menyusun senarai…</p></div>;
  }

  if (rows.length === 0) {
    return (
      <div className="ticket px-6 py-10 text-center">
        <p className="font-display font-bold text-lg text-content-100 mb-1">
          Tiada order return untuk dihubungi
        </p>
        <p className="text-content-300 text-[13.5px]">
          Muat naik fail yang mengandungi order berstatus RETURN.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header + value of today's list */}
      <div className="ticket p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/60">
              Senarai Panggilan Hari Ini
            </p>
            <p className="font-display font-extrabold text-[1.7rem] text-content-100 leading-tight mt-1">
              <CountUp value={value.count} /> panggilan
            </p>
            <p className="text-content-300/80 text-[13px] mt-1">
              Bernilai {rm(value.totalValue)} · anggaran boleh pulih{" "}
              <span className="text-stamp-green font-semibold">{rm(value.expectedValue)}</span>
            </p>
          </div>

          <div className="flex flex-wrap gap-2 items-end">
            <label className="block">
              <span className="font-mono text-[9px] uppercase tracking-wider text-content-300/50">
                Skrip promosi
              </span>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="input mt-1 min-w-[170px]"
              >
                <option value="">Skrip lalai</option>
                {plans.filter((p) => p.offerScript.trim()).map((p) => (
                  <option key={p.id} value={p.id}>{p.title || "Tanpa tajuk"}</option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="font-mono text-[9px] uppercase tracking-wider text-content-300/50">
                Bilangan
              </span>
              <select
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="input mt-1"
              >
                {[10, 15, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
        </div>

        {plans.length === 0 && (
          <p className="text-content-300/70 text-[12px] mt-3 pt-3 border-t border-surface-600">
            Tip: cipta rancangan di tab <strong>Promosi</strong> dengan skrip tawaran, dan ia
            akan muncul di sini. Gunakan {SCRIPT_TOKENS.join(" ")} untuk isi maklumat customer
            secara automatik.
          </p>
        )}
      </div>

      {/* The queue */}
      {queue.length === 0 ? (
        <div className="ticket px-6 py-10 text-center">
          <p className="text-[2rem] mb-2">🎉</p>
          <p className="font-display font-bold text-lg text-content-100 mb-1">
            Semua return dah diproses
          </p>
          <p className="text-content-300 text-[13.5px]">
            Tiada panggilan tertunggak. Kerja bagus.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {queue.map((lead, i) => {
            const k = trackingKey(lead.trackingNo);
            const open = expanded === k;
            return (
              <div key={k} className="ticket overflow-hidden">
                {/* Stacks on phones: the single-row layout leaves no room for
                    the name once price and buttons take their share. */}
                <div className="px-4 py-3.5 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="font-display font-extrabold text-[1.05rem] text-content-300/40 w-6 shrink-0">
                    {i + 1}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14px] font-medium text-content-100">
                        {lead.customerName}
                      </span>
                      {lead.isRepeatCustomer && (
                        <span className="font-mono text-[9px] uppercase tracking-wider text-stamp-green border border-stamp-green/40 bg-stamp-green/10 rounded-full px-1.5 py-0.5">
                          Berulang
                        </span>
                      )}
                      {lead.isSerialReturner && (
                        <span className="font-mono text-[9px] uppercase tracking-wider text-stamp-red border border-stamp-red/40 bg-stamp-red/10 rounded-full px-1.5 py-0.5">
                          Kerap return
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-content-300/80 mt-0.5">
                      {lead.product} · {lead.returnReason}
                    </p>
                  </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pl-9 sm:pl-0">
                  <div className="text-left sm:text-right shrink-0">
                    <p className="font-mono text-[14px] font-semibold text-content-100">
                      {rm(lead.originalAmount)}
                    </p>
                    <p className="text-[11px] text-stamp-green">
                      ~{rm(lead.expectedValue)} boleh pulih
                    </p>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    {lead.waLink && (
                      <a
                        href={lead.waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => update(lead, { status: "Cuba Hubungi", contactedAt: new Date().toISOString().slice(0, 10) })}
                        className="flex items-center gap-1.5 bg-stamp-green/10 text-stamp-green border border-stamp-green/40 rounded-lg px-3 py-2 min-h-[36px] text-[12px] font-medium hover:bg-stamp-green/20 transition-colors"
                      >
                        WhatsApp
                      </a>
                    )}
                    <button
                      onClick={() => setExpanded(open ? null : k)}
                      className="btn-soft px-2.5"
                      aria-label="Butiran"
                    >
                      {open ? "▲" : "▼"}
                    </button>
                  </div>
                  </div>
                </div>

                {open && (
                  <div className="border-t border-surface-600 bg-surface-950/40 px-4 py-4 space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12px]">
                      <Meta label="Telefon" value={lead.phone} mono />
                      <Meta label="Tracking" value={lead.trackingNo} mono />
                      <Meta label="Ejen" value={lead.agent || "—"} />
                      <Meta
                        label="Umur"
                        value={lead.daysSinceReturn !== null ? `${lead.daysSinceReturn} hari` : "—"}
                      />
                    </div>

                    {/* Why this lead ranks where it does */}
                    <div>
                      <p className="font-mono text-[9px] uppercase tracking-wider text-content-300/50 mb-2">
                        Kenapa keutamaan ini · skor {lead.score}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {lead.factors.map((f, j) => (
                          <span
                            key={j}
                            className={`text-[11px] rounded-full px-2.5 py-1 border ${
                              f.points >= 0
                                ? "border-surface-600 text-content-300 bg-surface-700"
                                : "border-stamp-red/40 text-stamp-red bg-stamp-red/10"
                            }`}
                          >
                            {f.label} {f.points >= 0 ? "+" : ""}{f.points}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => copyScript(lead)} className="btn-soft">
                        {copied === lead.trackingNo ? "Disalin ✓" : "Salin Skrip"}
                      </button>
                      <button
                        onClick={() =>
                          update(lead, {
                            status: "Berjaya Re-order",
                            reorderAmount: lead.originalAmount,
                            reorderUnits: lead.quantity,
                            reorderDate: new Date().toISOString().slice(0, 10),
                          })
                        }
                        className="btn-soft text-stamp-green border-stamp-green/40 hover:bg-stamp-green/10"
                      >
                        ✓ Berjaya Re-order
                      </button>
                      <button
                        onClick={() => update(lead, { status: "Tolak" })}
                        className="btn-soft"
                      >
                        Tolak
                      </button>
                      <button
                        onClick={() => update(lead, { status: "Tak Dapat Dihubungi" })}
                        className="btn-soft"
                      >
                        Tak Dapat Dihubungi
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-content-300/60 text-[11.5px] leading-relaxed">
        Susunan dikira dari nilai order, kadar pemulihan sebab return, kesetiaan customer dan
        umur parcel. Semakin banyak keputusan direkod, semakin tepat susunan ini menyesuaikan
        diri dengan corak sebenar perniagaan anda.
      </p>
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
