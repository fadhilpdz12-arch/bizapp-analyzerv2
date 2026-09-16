"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  PromoPlan,
  PlanStatus,
  PLAN_STATUSES,
  newPlan,
  loadPlans,
  savePlans,
  compressImage,
  storageUsedKB,
  exportPlans,
  importPlans,
} from "@/lib/promoPlanner";

const STATUS_STYLE: Record<PlanStatus, string> = {
  Draf: "text-content-300 border-surface-500 bg-surface-700",
  Aktif: "text-stamp-green border-stamp-green/40 bg-stamp-green/10",
  Selesai: "text-accent border-accent/40 bg-accent/10",
  Arkib: "text-content-300/70 border-surface-500 bg-surface-700",
};

function download(name: string, content: string) {
  const blob = new Blob([content], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtDate(d: string): string {
  if (!d) return "";
  const dt = new Date(d);
  return isNaN(dt.getTime())
    ? d
    : dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Days until the campaign starts, or how long it has left. */
function timing(plan: PromoPlan): { text: string; tone: string } | null {
  if (!plan.startDate && !plan.endDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = plan.startDate ? new Date(plan.startDate) : null;
  const end = plan.endDate ? new Date(plan.endDate) : null;

  if (start && start > today) {
    const days = Math.ceil((start.getTime() - today.getTime()) / 86400000);
    return { text: `Mula dalam ${days} hari`, tone: "text-stamp-amber" };
  }
  if (end && end < today) {
    return { text: "Tamat", tone: "text-content-300/60" };
  }
  if (end) {
    const days = Math.ceil((end.getTime() - today.getTime()) / 86400000);
    return { text: `${days} hari lagi`, tone: "text-stamp-green" };
  }
  return { text: "Sedang berjalan", tone: "text-stamp-green" };
}

export default function PromoPlanner() {
  const [plans, setPlans] = useState<PromoPlan[]>([]);
  const [ready, setReady] = useState(false);
  const [editing, setEditing] = useState<PromoPlan | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const posterRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPlans(loadPlans());
    setReady(true);
  }, []);

  const flash = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3500);
  }, []);

  const persist = useCallback(
    (next: PromoPlan[]) => {
      setPlans(next);
      const res = savePlans(next);
      if (!res.ok && res.message) flash(res.message);
      return res.ok;
    },
    [flash]
  );

  const visible = useMemo(
    () => plans.filter((p) => (showArchived ? true : p.status !== "Arkib")),
    [plans, showArchived]
  );

  const usedKB = useMemo(() => storageUsedKB(plans), [plans]);

  // ── Actions ──────────────────────────────────────────────────────────────
  const startNew = () => setEditing(newPlan());

  const commit = () => {
    if (!editing) return;
    if (!editing.title.trim()) {
      flash("Beri tajuk untuk rancangan ini dahulu.");
      return;
    }
    const stamped = { ...editing, updatedAt: new Date().toISOString() };
    const exists = plans.some((p) => p.id === stamped.id);
    const next = exists
      ? plans.map((p) => (p.id === stamped.id ? stamped : p))
      : [stamped, ...plans];
    if (persist(next)) {
      setEditing(null);
      flash(exists ? "Rancangan dikemas kini." : "Rancangan disimpan.");
    }
  };

  const remove = (id: string) => {
    const plan = plans.find((p) => p.id === id);
    if (!plan) return;
    if (!confirm(`Padam "${plan.title}"? Tindakan ini tidak boleh dibatalkan.`)) return;
    persist(plans.filter((p) => p.id !== id));
    flash("Rancangan dipadam.");
  };

  const setStatus = (id: string, status: PlanStatus) => {
    persist(
      plans.map((p) =>
        p.id === id ? { ...p, status, updatedAt: new Date().toISOString() } : p
      )
    );
  };

  const addPosters = async (files: FileList | null) => {
    if (!files || !editing) return;
    const added: string[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      try {
        added.push(await compressImage(file));
      } catch (err) {
        flash(err instanceof Error ? err.message : "Gagal memproses gambar.");
      }
    }
    if (added.length) {
      setEditing({ ...editing, posters: [...editing.posters, ...added] });
    }
  };

  const doImport = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = importPlans(String(reader.result), plans);
      if (!res.ok || !res.merged) {
        flash(res.message);
        return;
      }
      persist(res.merged);
      flash(res.message);
    };
    reader.readAsText(file);
  };

  if (!ready) {
    return (
      <div className="ticket p-6">
        <p className="text-content-300 text-[13px]">Memuatkan rancangan…</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {toast && (
        <div className="notice notice-info px-4 py-3 text-[13px] text-content-100">{toast}</div>
      )}

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div className="ticket p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/60">
              Perancangan Promosi
            </p>
            <p className="text-content-300/70 text-[12.5px] mt-1">
              Rancang pakej, skrip tawaran dan poster untuk memujuk customer return kembali.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={startNew} className="btn-accent">+ Rancangan Baharu</button>
            <button onClick={() => download(`promo-plans-${new Date().toISOString().slice(0,10)}.json`, exportPlans(plans))} className="btn-soft">
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

        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-surface-600">
          <label className="flex items-center gap-2 text-[12.5px] text-content-300 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="[accent-color:rgb(var(--accent))]"
            />
            Tunjuk arkib
          </label>
          <span className="font-mono text-[11px] text-content-300/60">
            {plans.length} rancangan · {usedKB} KB digunakan
          </span>
          {usedKB > 3500 && (
            <span className="font-mono text-[11px] text-stamp-red">
              Hampir penuh — arkibkan atau padam poster lama
            </span>
          )}
        </div>
      </div>

      {/* ── Editor ────────────────────────────────────────────────────── */}
      {editing && (
        <div className="ticket p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="font-display font-bold text-lg text-content-100">
              {plans.some((p) => p.id === editing.id) ? "Edit Rancangan" : "Rancangan Baharu"}
            </p>
            <button onClick={() => setEditing(null)} className="btn-soft">Batal</button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <L label="Tajuk Rancangan *">
              <input
                value={editing.title}
                onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                placeholder="Contoh: Win-back Ogos — Trial Pack"
                className="input"
              />
            </L>
            <L label="Status">
              <select
                value={editing.status}
                onChange={(e) => setEditing({ ...editing, status: e.target.value as PlanStatus })}
                className="input"
              >
                {PLAN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </L>
            <L label="Tema Promo">
              <input
                value={editing.theme}
                onChange={(e) => setEditing({ ...editing, theme: e.target.value })}
                placeholder="Contoh: Raya — kembali kepada rutin sihat"
                className="input"
              />
            </L>
            <L label="Pakej Produk">
              <input
                value={editing.productPackage}
                onChange={(e) => setEditing({ ...editing, productPackage: e.target.value })}
                placeholder="Contoh: 2 Kotak Cocoa + free postage"
                className="input"
              />
            </L>
            <L label="Tarikh Mula">
              <input
                type="date"
                value={editing.startDate}
                onChange={(e) => setEditing({ ...editing, startDate: e.target.value })}
                className="input"
              />
            </L>
            <L label="Tarikh Tamat">
              <input
                type="date"
                value={editing.endDate}
                onChange={(e) => setEditing({ ...editing, endDate: e.target.value })}
                className="input"
              />
            </L>
          </div>

          <L label="Skrip Tawaran">
            <textarea
              rows={5}
              value={editing.offerScript}
              onChange={(e) => setEditing({ ...editing, offerScript: e.target.value })}
              placeholder={"Ayat yang admin guna semasa hubungi customer.\n\nContoh: Salam puan, kami perasan parcel puan tak sempat sampai hari tu…"}
              className="input resize-y"
            />
          </L>

          <L label="Catatan Dalaman">
            <textarea
              rows={3}
              value={editing.notes}
              onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
              placeholder="Nota untuk pasukan — bukan untuk customer"
              className="input resize-y"
            />
          </L>

          {/* Links */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-content-300/50">
                Pautan
              </span>
              <button
                onClick={() => setEditing({ ...editing, links: [...editing.links, { label: "", url: "" }] })}
                className="btn-soft text-[11px]"
              >
                + Pautan
              </button>
            </div>
            <div className="space-y-2">
              {editing.links.map((lnk, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={lnk.label}
                    onChange={(e) => {
                      const links = [...editing.links];
                      links[i] = { ...links[i], label: e.target.value };
                      setEditing({ ...editing, links });
                    }}
                    placeholder="Nama"
                    className="input w-1/3"
                  />
                  <input
                    value={lnk.url}
                    onChange={(e) => {
                      const links = [...editing.links];
                      links[i] = { ...links[i], url: e.target.value };
                      setEditing({ ...editing, links });
                    }}
                    placeholder="https://…"
                    className="input flex-1"
                  />
                  <button
                    onClick={() => setEditing({ ...editing, links: editing.links.filter((_, j) => j !== i) })}
                    className="btn-soft px-2.5"
                    aria-label="Buang pautan"
                  >
                    ×
                  </button>
                </div>
              ))}
              {editing.links.length === 0 && (
                <p className="text-content-300/50 text-[12px]">
                  Belum ada pautan — contoh: Google Drive poster, katalog produk.
                </p>
              )}
            </div>
          </div>

          {/* Posters */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-[9px] uppercase tracking-wider text-content-300/50">
                Poster & Visual
              </span>
              <button onClick={() => posterRef.current?.click()} className="btn-soft text-[11px]">
                + Muat Naik
              </button>
              <input
                ref={posterRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => { addPosters(e.target.files); e.target.value = ""; }}
              />
            </div>
            {editing.posters.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {editing.posters.map((src, i) => (
                  <div key={i} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Poster ${i + 1}`} className="w-full h-32 object-cover rounded-lg border border-surface-600" />
                    <button
                      onClick={() => setEditing({ ...editing, posters: editing.posters.filter((_, j) => j !== i) })}
                      className="absolute top-1.5 right-1.5 bg-white/95 border border-surface-500 rounded-full w-6 h-6 text-content-100 text-[13px] leading-none shadow"
                      aria-label="Buang poster"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-content-300/50 text-[12px]">
                Gambar dikecilkan automatik sebelum disimpan supaya tidak memenuhi storan.
              </p>
            )}
          </div>

          <div className="flex gap-2 pt-2 border-t border-surface-600">
            <button onClick={commit} className="btn-accent">Simpan</button>
            <button onClick={() => setEditing(null)} className="btn-soft">Batal</button>
          </div>
        </div>
      )}

      {/* ── Plan cards ────────────────────────────────────────────────── */}
      {visible.length === 0 ? (
        <div className="ticket px-6 py-10 text-center">
          <p className="font-display font-bold text-lg text-content-100 mb-1">
            Belum ada rancangan promosi
          </p>
          <p className="text-content-300 text-[13.5px] mb-4">
            Cipta rancangan untuk pakej, skrip tawaran dan poster yang akan digunakan
            semasa menghubungi customer return.
          </p>
          <button onClick={startNew} className="btn-accent">+ Rancangan Baharu</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visible.map((p) => {
            const t = timing(p);
            return (
              <div key={p.id} className="ticket p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display font-bold text-[1.1rem] text-content-100 leading-snug">
                      {p.title}
                    </p>
                    {p.theme && (
                      <p className="text-content-300/80 text-[12.5px] mt-0.5">{p.theme}</p>
                    )}
                  </div>
                  <span className={`font-mono text-[9.5px] uppercase tracking-wider border rounded-full px-2 py-1 whitespace-nowrap ${STATUS_STYLE[p.status]}`}>
                    {p.status}
                  </span>
                </div>

                {(p.startDate || p.endDate) && (
                  <div className="flex items-center gap-2 mt-3 text-[12px]">
                    <span className="text-content-300/70">
                      {fmtDate(p.startDate)}{p.endDate && ` — ${fmtDate(p.endDate)}`}
                    </span>
                    {t && <span className={`font-medium ${t.tone}`}>· {t.text}</span>}
                  </div>
                )}

                {p.productPackage && (
                  <p className="text-[12.5px] text-content-100/90 mt-3">
                    <span className="text-content-300/60">Pakej: </span>{p.productPackage}
                  </p>
                )}

                {p.offerScript && (
                  <p className="text-[12.5px] text-content-300 mt-2 line-clamp-3 whitespace-pre-wrap">
                    {p.offerScript}
                  </p>
                )}

                {p.posters.length > 0 && (
                  <div className="flex gap-2 mt-3">
                    {p.posters.slice(0, 4).map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img key={i} src={src} alt="" className="w-14 h-14 object-cover rounded-md border border-surface-600" />
                    ))}
                  </div>
                )}

                {p.links.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {p.links.filter((l) => l.url).map((l, i) => (
                      <a
                        key={i}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-mono text-[11px] text-accent border border-accent/30 rounded-full px-2.5 py-1 hover:bg-accent/10 transition-colors"
                      >
                        {l.label || "Pautan"} ↗
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-surface-600">
                  <button onClick={() => setEditing(p)} className="btn-soft text-[11.5px]">Edit</button>
                  {p.status !== "Arkib" ? (
                    <button onClick={() => setStatus(p.id, "Arkib")} className="btn-soft text-[11.5px]">
                      Arkib
                    </button>
                  ) : (
                    <button onClick={() => setStatus(p.id, "Draf")} className="btn-soft text-[11.5px]">
                      Pulihkan
                    </button>
                  )}
                  <button
                    onClick={() => remove(p.id)}
                    className="btn-soft text-[11.5px] text-stamp-red border-stamp-red/30 hover:bg-stamp-red/10 ml-auto"
                  >
                    Padam
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="text-content-300/60 text-[11.5px] leading-relaxed">
        Rancangan disimpan dalam browser komputer ini. Gunakan <strong>Eksport</strong> dan{" "}
        <strong>Import</strong> untuk berkongsi dengan rakan sepasukan.
      </p>
    </div>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[9px] uppercase tracking-wider text-content-300/50">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}
