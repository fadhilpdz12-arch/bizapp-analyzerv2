"use client";

import { useEffect, useState } from "react";

/**
 * Chart styling shared by every Recharts view.
 *
 * Recharts needs concrete colour values, so the neutrals are repeated here.
 * The accent is read from the live CSS variable instead, which lets charts
 * follow the theme picker without threading a colour through every chart.
 */

export const CHART = {
  grid: "#E8ECF3",
  axisLine: "#D4DBE8",
  tick: "#8B96AD",
  tickStrong: "#3C475E",
  cursor: "rgba(90, 103, 132, 0.07)",
} as const;

export const SERIES = {
  green: "#12A150",
  red: "#E8203C",
  amber: "#C67C08",
  slate: "#8B96AD",
} as const;

export const TOOLTIP_STYLE = {
  background: "#FFFFFF",
  border: "1px solid #E8ECF3",
  borderRadius: 10,
  fontFamily: "var(--font-mono)",
  fontSize: 12,
  boxShadow: "0 8px 24px -12px rgba(26,34,51,0.35)",
} as const;

export const TOOLTIP_ITEM = { color: "#1A2233" } as const;

export const tickStyle = {
  fill: CHART.tick,
  fontSize: 10,
  fontFamily: "var(--font-mono)",
} as const;

export const tickStyleStrong = {
  fill: CHART.tickStrong,
  fontSize: 11,
} as const;

const FALLBACK_ACCENT = "rgb(232,32,60)";

/**
 * The current accent as an rgb() string, re-read whenever the theme changes so
 * a theme switch repaints the charts too.
 */
export function useAccent(): string {
  const [accent, setAccent] = useState(FALLBACK_ACCENT);

  useEffect(() => {
    const read = () => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue("--accent")
        .trim();
      // Stored as space-separated RGB channels, e.g. "232 32 60"
      if (/^\d+\s+\d+\s+\d+$/.test(raw)) {
        setAccent(`rgb(${raw.split(/\s+/).join(",")})`);
      }
    };
    read();

    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["style", "data-accent"],
    });
    return () => mo.disconnect();
  }, []);

  return accent;
}

/** Tooltip label colour follows the accent. */
export function tooltipLabel(accent: string) {
  return { color: accent };
}
