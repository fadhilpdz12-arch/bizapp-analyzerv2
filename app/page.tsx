"use client";

import { useState, useCallback, useMemo } from "react";
import UploadZone from "@/components/UploadZone";
import Dashboard from "@/components/Dashboard";
import { parseWorkbook, mergeParsedResults } from "@/lib/parser";
import { computeAnalytics } from "@/lib/analytics";
import { ParsedResult } from "@/lib/types";
import { FilterState, EMPTY_FILTER, applyFilters, buildFilterOptions } from "@/lib/filters";

function readFile(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
    reader.onerror = () => reject(new Error(`Gagal membaca ${file.name}`));
    reader.readAsArrayBuffer(file);
  });
}

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedResult | null>(null);
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTER);
  const [processMs, setProcessMs] = useState(0);

  const handleFiles = useCallback(async (files: File[]) => {
    if (!files.length) return;
    setLoading(true);
    setError(null);
    const started = performance.now();

    try {
      const results: ParsedResult[] = [];
      const failed: string[] = [];

      for (const file of files) {
        try {
          const buffer = await readFile(file);
          const result = parseWorkbook(buffer, file.name);
          // Keep going if one file is unreadable — the rest may still be fine.
          if (result.orders.length === 0) failed.push(file.name);
          else results.push(result);
        } catch {
          failed.push(file.name);
        }
      }

      if (results.length === 0) {
        setError(
          files.length === 1
            ? "Tiada order dapat dikesan dalam fail ini. Pastikan ia export Bizapp yang sah."
            : "Tiada order dapat dikesan dalam mana-mana fail yang dipilih."
        );
        setLoading(false);
        return;
      }

      const merged = mergeParsedResults(results);
      if (failed.length) {
        merged.warnings.push(
          `${failed.length} fail dilangkau kerana tiada order dikesan: ${failed.join(", ")}.`
        );
      }
      if (merged.duplicatesRemoved > 0) {
        merged.warnings.push(
          `${merged.duplicatesRemoved.toLocaleString()} order bertindih antara fail telah digabungkan (dikira sekali sahaja).`
        );
      }

      const elapsed = performance.now() - started;
      // Hold the loading state briefly so the progress steps don't flash by.
      const MIN_VISIBLE = 1400;
      const wait = Math.max(0, MIN_VISIBLE - elapsed);
      setTimeout(() => {
        setProcessMs(elapsed);
        setParsed(merged);
        setFilters(EMPTY_FILTER);
        setLoading(false);
      }, wait);
    } catch (err) {
      console.error(err);
      setError("Gagal memproses fail. Pastikan format .xlsx / .xls / .csv yang sah.");
      setLoading(false);
    }
  }, []);

  const filterOptions = useMemo(
    () => (parsed ? buildFilterOptions(parsed.orders) : null),
    [parsed]
  );

  const filteredOrders = useMemo(
    () => (parsed ? applyFilters(parsed.orders, filters) : []),
    [parsed, filters]
  );

  const analytics = useMemo(
    () => (filteredOrders.length ? computeAnalytics(filteredOrders) : null),
    [filteredOrders]
  );

  const handleReset = useCallback(() => {
    setParsed(null);
    setFilters(EMPTY_FILTER);
    setError(null);
  }, []);

  if (parsed && filterOptions) {
    if (!analytics) {
      return (
        <div className="min-h-screen blueprint-grid flex items-center justify-center px-6">
          <div className="ticket p-8 max-w-md text-center">
            <p className="text-content-100 mb-4">Tiada order sepadan dengan penapis yang dipilih.</p>
            <button
              onClick={() => setFilters(EMPTY_FILTER)}
              className="font-mono text-[11px] uppercase tracking-wider border border-accent/40 text-accent px-4 py-2 rounded-sm hover:bg-accent/10 transition-colors"
            >
              Reset Penapis
            </button>
          </div>
        </div>
      );
    }
    return (
      <Dashboard
        analytics={analytics}
        parsed={parsed}
        onReset={handleReset}
        filters={filters}
        filterOptions={filterOptions}
        onFilterChange={setFilters}
        filteredOrders={filteredOrders}
        processMs={processMs}
      />
    );
  }

  return <UploadZone onFiles={handleFiles} loading={loading} error={error} />;
}
