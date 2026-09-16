"use client";

import { useState } from "react";
import { FilterState, FilterOptions, countActive, EMPTY_FILTER } from "@/lib/filters";

function Group({
  label,
  options,
  selected,
  onToggle,
}: {
  label: string;
  options: { key: string; label: string }[];
  selected: string[];
  onToggle: (key: string) => void;
}) {
  if (!options.length) return null;
  return (
    <div>
      <p className="font-mono text-[9.5px] tracking-[0.2em] uppercase text-content-300/40 mb-2">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => {
          const on = selected.includes(o.key);
          return (
            <button
              key={o.key}
              onClick={() => onToggle(o.key)}
              className={`text-[11.5px] px-2.5 py-1.5 rounded-sm border transition-colors max-w-[220px] truncate ${
                on
                  ? "border-accent text-accent bg-accent/10"
                  : "border-surface-600 text-content-300/50 hover:text-content-100 hover:border-surface-500"
              }`}
              title={o.label}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function FilterBar({
  options,
  filters,
  onChange,
  resultCount,
  totalCount,
}: {
  options: FilterOptions;
  filters: FilterState;
  onChange: (f: FilterState) => void;
  resultCount: number;
  totalCount: number;
}) {
  const [open, setOpen] = useState(false);
  const active = countActive(filters);

  const toggle = (field: keyof FilterState, key: string) => {
    const cur = filters[field];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    onChange({ ...filters, [field]: next });
  };

  const asOpts = (arr: string[]) => arr.map((a) => ({ key: a, label: a }));

  return (
    <div className="ticket px-6 py-4 fade-up no-print">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-wider text-content-300/60 hover:text-content-100 transition-colors"
        >
          <span className={`transition-transform ${open ? "rotate-90" : ""}`}>▸</span>
          Penapis
          {active > 0 && (
            <span className="text-accent border border-accent/40 rounded-sm px-1.5 py-0.5 text-[10px]">
              {active} aktif
            </span>
          )}
        </button>

        <div className="flex items-center gap-4">
          <span className="font-mono text-[11.5px] text-content-300/50">
            {resultCount.toLocaleString()} / {totalCount.toLocaleString()} order
          </span>
          {active > 0 && (
            <button
              onClick={() => onChange(EMPTY_FILTER)}
              className="font-mono text-[11px] uppercase tracking-wider text-stamp-red hover:underline"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="ticket-tear mt-4 pt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
          <Group label="Bulan" options={options.months} selected={filters.months} onToggle={(k) => toggle("months", k)} />
          <Group
            label="Jenis Penghantaran"
            options={asOpts(options.shipTypes)}
            selected={filters.shipTypes}
            onToggle={(k) => toggle("shipTypes", k)}
          />
          <Group
            label="Status"
            options={asOpts(options.statuses)}
            selected={filters.statuses}
            onToggle={(k) => toggle("statuses", k)}
          />
          <Group
            label="Kurier"
            options={asOpts(options.couriers)}
            selected={filters.couriers}
            onToggle={(k) => toggle("couriers", k)}
          />
          <Group
            label="Ejen"
            options={asOpts(options.agents)}
            selected={filters.agents}
            onToggle={(k) => toggle("agents", k)}
          />
          <Group
            label="Produk"
            options={asOpts(options.products)}
            selected={filters.products}
            onToggle={(k) => toggle("products", k)}
          />
        </div>
      )}
    </div>
  );
}
