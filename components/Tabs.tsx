"use client";

import { useEffect } from "react";

export interface TabDef {
  id: string;
  label: string;
  icon: string;
  /** Optional count shown as a badge — used to surface things needing action. */
  badge?: number;
  /** Badge turns red when the count represents a problem. */
  badgeTone?: "alert" | "neutral";
}

export default function Tabs({
  tabs,
  active,
  onChange,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
}) {
  // Number keys jump between tabs — quick for a daily-use tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = parseInt(e.key, 10);
      if (Number.isInteger(n) && n >= 1 && n <= tabs.length) {
        onChange(tabs[n - 1].id);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tabs, onChange]);

  return (
    <div className="tabbar sticky top-[74px] sm:top-[78px] z-20 px-1.5 py-1.5 overflow-x-auto scroll-hint no-print">
      <div className="flex items-center gap-1 min-w-max" role="tablist">
        {tabs.map((t, i) => {
          const isActive = t.id === active;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              data-active={isActive}
              onClick={() => onChange(t.id)}
              title={`Tekan ${i + 1}`}
              className="tab flex items-center gap-1.5 px-3 sm:px-3.5 py-2 min-h-[38px] text-[13px] font-medium text-content-300"
            >
              <span aria-hidden className="text-[13px]">{t.icon}</span>
              <span>{t.label}</span>
              {typeof t.badge === "number" && t.badge > 0 && (
                <span
                  className={`ml-0.5 font-mono text-[10px] leading-none px-1.5 py-1 rounded-full ${
                    t.badgeTone === "alert"
                      ? "bg-stamp-red/10 text-stamp-red"
                      : "bg-surface-700 text-content-300"
                  }`}
                >
                  {t.badge > 999 ? "999+" : t.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
