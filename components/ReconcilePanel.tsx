"use client";

import { useCallback, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Order } from "@/lib/types";
import {
  reconcile,
  extractPayments,
  splitPastedRows,
  toTSV,
  ReconResult,
  ReconStatus,
} from "@/lib/reconcile";

const STATUS_META: Record<ReconStatus, { label: string; cls: string }> = {
  beza: { label: "Beza", cls: "text-stamp-red border-stamp-red/50" },
  "tiada-bizapp": { label: "Tiada Di Bizapp", cls: "text-stamp-amber border-stamp-amber/50" },
  padan: { label: "Padan", cls: "text-stamp-green border-stamp-green/50" },
};

const FILTERS: { key: ReconStatus | "semua"; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "beza", label: "Beza Amaun" },
  { key: "tiada-bizapp", label: "Tiada Di Bizapp" },
  { key: "padan", label: "Padan" },
];

const PLACEHOLDER = `2026-08-12 21:58\tZaharuddin\t138829319\t79
2026-08-12 21:25\tMd Isa Daud\t60124758876\t139`;

export default function ReconcilePanel({ orders }: { orders: Order[] }) {
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<ReconResult | null>(null);
  const [view, setView] = useState<ReconStatus | "semua">("semua");
  const [copied, setCopied] = useState(false);

  const run = useCallback(
    (rows: string[][]) => {
      const { entries, warnings } = extractPayments(rows);
      const res = reconcile(orders, entries);
      res.warnings.unshift(...warnings);
      setResult(res);
      setView(res.summary.mismatched > 0 ? "beza" : "semua");
      setCopied(false);
    },
    [orders]
  );

  const handlePaste = useCallback(() => {
    if (!pasted.trim()) return;
    run(splitPastedRows(pasted));
  }, [pasted, run]);

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = XLSX.read(e.target?.result as ArrayBuffer, { type: "array" });
          const rows: string[][] = [];
          for (const name of wb.SheetNames) {
            const sheet = XLSX.utils.sheet_to_json(wb.Sheets[name], {
              header: 1,
              raw: false,
              defval: "",
              blankrows: false,
            }) as unknown[][];
            for (const r of sheet) rows.push(r.map((c) => (c == null ? "" : String(c).trim())));
          }
          run(rows);
        } catch {
          setResult(null);
        }
      };
      reader.readAsArrayBuffer(file);
    },
    [run]
  );

  const copyResult = useCallback(async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(toTSV(result.rows));
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  }, [result]);

  const visibleRows = useMemo(() => {
    if (!result) return [];
    const rows = view === "semua" ? result.rows : result.rows.filter((r) => r.status === view);
    return rows.slice(0, 300);
  }, [result, view]);

  const s = result?.summary;

  return (
    <div className="ticket p-5 sm:p-6 fade-up">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 text-left"
      >
        <div className="min-w-0">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/50">
            Semakan Bayaran
          </p>
          <p className="text-content-100 text-[14px] sm:text-[15px] mt-1">
            Isi Seller &amp; Tracking automatik, kesan amaun berbeza dari Bizapp
          </p>
        </div>
        <span className="font-mono text-[11px] text-accent shrink-0">{open ? "Tutup" : "Buka"}</span>
      </button>

      {open && (
        <div className="mt-5 space-y-5">
          <div className="space-y-3">
            <p className="text-content-300/55 text-[13px] leading-relaxed">
              Tampal rekod bayaran (tarikh, nama, telefon, amaun) terus dari Google Sheets.
              Padanan dibuat guna no. telefon — kolum Seller dan Tracking akan diisi automatik
              dari Bizapp.
            </p>
            <textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={5}
              placeholder={PLACEHOLDER}
              className="w-full bg-surface-900 border border-surface-600 rounded-sm px-3 py-2.5 font-mono text-[12px] text-content-100 placeholder:text-content-300/25 focus:border-accent/60 focus:outline-none resize-y"
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={handlePaste}
                disabled={!pasted.trim()}
                className="font-mono text-[11px] uppercase tracking-wider border border-accent/50 text-accent px-4 py-2 rounded-sm hover:bg-accent/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors min-h-[38px]"
              >
                Semak Sekarang
              </button>
              <label className="font-mono text-[11px] uppercase tracking-wider border border-surface-500 text-content-300/70 px-4 py-2 rounded-sm hover:bg-surface-700 cursor-pointer transition-colors min-h-[38px] flex items-center">
                Atau Muat Naik Fail
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  className="hidden"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                />
              </label>
              {result && (
                <button
                  onClick={copyResult}
                  className="font-mono text-[11px] uppercase tracking-wider border border-stamp-green/50 text-stamp-green px-4 py-2 rounded-sm hover:bg-stamp-green/10 transition-colors min-h-[38px] ml-auto"
                >
                  {copied ? "Disalin ✓" : "Salin Untuk Sheets"}
                </button>
              )}
            </div>
          </div>

          {result && s && (
            <>
              {result.warnings.length > 0 && (
                <div className="border border-stamp-amber/40 bg-stamp-amber/10 text-stamp-amber text-[12.5px] px-3.5 py-2.5 rounded-sm space-y-1">
                  {result.warnings.map((w, i) => (
                    <p key={i}>{w}</p>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="border border-surface-600 rounded-sm px-3.5 py-3">
                  <p className="font-mono text-[9.5px] uppercase tracking-wider text-content-300/45">
                    Rekod Bayaran
                  </p>
                  <p className="font-display font-bold text-[1.3rem] text-content-100 mt-1">
                    {s.totalRows}
                  </p>
                  <p className="text-[11.5px] text-content-300/50 mt-0.5">
                    {s.autoFilledTracking} tracking diisi
                  </p>
                </div>
                <div className="border border-stamp-green/40 rounded-sm px-3.5 py-3">
                  <p className="font-mono text-[9.5px] uppercase tracking-wider text-content-300/45">
                    Padan
                  </p>
                  <p className="font-display font-bold text-[1.3rem] text-stamp-green mt-1">
                    {s.matched}
                  </p>
                  <p className="text-[11.5px] text-content-300/50 mt-0.5">amaun sama</p>
                </div>
                <div className="border border-stamp-red/40 rounded-sm px-3.5 py-3">
                  <p className="font-mono text-[9.5px] uppercase tracking-wider text-content-300/45">
                    Beza Amaun
                  </p>
                  <p className="font-display font-bold text-[1.3rem] text-stamp-red mt-1">
                    {s.mismatched}
                  </p>
                  <p className="text-[11.5px] text-content-300/50 mt-0.5">
                    kurang RM {Math.abs(s.shortfall).toLocaleString()}
                  </p>
                </div>
                <div className="border border-stamp-amber/40 rounded-sm px-3.5 py-3">
                  <p className="font-mono text-[9.5px] uppercase tracking-wider text-content-300/45">
                    Tiada Di Bizapp
                  </p>
                  <p className="font-display font-bold text-[1.3rem] text-stamp-amber mt-1">
                    {s.unmatched}
                  </p>
                  <p className="text-[11.5px] text-content-300/50 mt-0.5">perlu semak manual</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {FILTERS.map((f) => {
                  const count =
                    f.key === "semua"
                      ? result.rows.length
                      : result.rows.filter((r) => r.status === f.key).length;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setView(f.key)}
                      className={`font-mono text-[10.5px] uppercase tracking-wider px-3 py-1.5 rounded-sm border transition-colors min-h-[34px] ${
                        view === f.key
                          ? "border-accent text-accent bg-accent/10"
                          : "border-surface-600 text-content-300/50 hover:text-content-100"
                      }`}
                    >
                      {f.label} ({count})
                    </button>
                  );
                })}
              </div>

              <div className="overflow-x-auto scroll-hint">
                <table className="w-full text-[12.5px] min-w-[760px]">
                  <thead>
                    <tr className="text-content-300/40 font-mono text-[9.5px] uppercase tracking-wider border-b border-surface-600">
                      <th className="text-left font-medium pb-2">Status</th>
                      <th className="text-left font-medium pb-2">Customer</th>
                      <th className="text-left font-medium pb-2">Telefon</th>
                      <th className="text-left font-medium pb-2">Seller</th>
                      <th className="text-left font-medium pb-2">Tracking</th>
                      <th className="text-right font-medium pb-2">Diterima</th>
                      <th className="text-right font-medium pb-2">Bizapp</th>
                      <th className="text-right font-medium pb-2">Beza</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleRows.map((r, i) => (
                      <tr key={r.phone + i} className="border-b border-surface-700/60 last:border-0">
                        <td className="py-2.5 pr-2">
                          <span
                            className={`font-mono text-[9.5px] uppercase tracking-wider border rounded-sm px-1.5 py-0.5 whitespace-nowrap ${STATUS_META[r.status].cls}`}
                          >
                            {STATUS_META[r.status].label}
                          </span>
                        </td>
                        <td className="py-2.5 pr-2 text-content-100/85 truncate max-w-[150px]">
                          {r.customerName}
                        </td>
                        <td className="py-2.5 pr-2 font-mono text-[11.5px] text-content-300/60">
                          {r.phone}
                        </td>
                        <td className="py-2.5 pr-2 text-content-300/70 truncate max-w-[130px]">
                          {r.seller}
                        </td>
                        <td className="py-2.5 pr-2 font-mono text-[11px] text-accent">
                          {r.trackingNo}
                        </td>
                        <td className="py-2.5 text-right font-mono text-content-100/85">
                          {r.paidAmount === null ? "—" : r.paidAmount.toFixed(2)}
                        </td>
                        <td className="py-2.5 text-right font-mono text-content-300/70">
                          {r.bizappAmount === null ? "—" : r.bizappAmount.toFixed(2)}
                        </td>
                        <td
                          className={`py-2.5 text-right font-mono font-semibold ${
                            r.difference === null
                              ? "text-content-300/30"
                              : r.difference < 0
                              ? "text-stamp-red"
                              : r.difference > 0
                              ? "text-stamp-amber"
                              : "text-stamp-green"
                          }`}
                        >
                          {r.difference === null
                            ? "—"
                            : `${r.difference > 0 ? "+" : ""}${r.difference.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
