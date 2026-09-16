"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** Each preset supplies the accent, a darker ink for text, and a tinted wash. */
const THEMES = [
  { id: "crimson", name: "Merah", accent: "232 32 60", ink: "180 20 44", wash: "255 241 243" },
  { id: "indigo", name: "Indigo", accent: "79 70 229", ink: "60 52 190", wash: "238 240 255" },
  { id: "teal", name: "Teal", accent: "13 148 136", ink: "9 116 106", wash: "233 249 246" },
  { id: "violet", name: "Ungu", accent: "124 77 255", ink: "98 56 214", wash: "243 238 255" },
  { id: "amber", name: "Amber", accent: "217 119 6", ink: "170 92 4", wash: "255 247 232" },
  { id: "slate", name: "Slate", accent: "71 85 105", ink: "51 65 85", wash: "241 245 249" },
] as const;

const STORAGE_KEY = "bizapp-accent";

function apply(theme: (typeof THEMES)[number]) {
  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-ink", theme.ink);
  root.style.setProperty("--accent-wash", theme.wash);
  // The chart hook watches this attribute to repaint.
  root.setAttribute("data-accent", theme.id);
}

export default function ThemePicker() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<string>(THEMES[0].id);
  const boxRef = useRef<HTMLDivElement>(null);

  // Restore the saved choice on mount.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      const found = THEMES.find((t) => t.id === saved);
      if (found) {
        apply(found);
        setActive(found.id);
      }
    } catch {
      /* storage unavailable — fall back to the default accent */
    }
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = useCallback((theme: (typeof THEMES)[number]) => {
    apply(theme);
    setActive(theme.id);
    setOpen(false);
    try {
      localStorage.setItem(STORAGE_KEY, theme.id);
    } catch {
      /* not fatal — the theme still applies for this session */
    }
  }, []);

  const current = THEMES.find((t) => t.id === active) ?? THEMES[0];

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Tukar warna tema"
        aria-expanded={open}
        className="flex items-center gap-2 border border-surface-600 rounded-full px-3 py-2 min-h-[38px] hover:bg-surface-700 transition-colors"
      >
        <span
          className="w-4 h-4 rounded-full border border-black/10"
          style={{ background: `rgb(${current.accent})` }}
        />
        <span className="font-mono text-[10.5px] uppercase tracking-wider text-content-300 hidden sm:inline">
          Tema
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 z-30 ticket p-2 w-[190px]">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-content-300/60 px-2 py-1.5">
            Warna Aksen
          </p>
          {THEMES.map((t) => (
            <button
              key={t.id}
              onClick={() => choose(t)}
              className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left transition-colors ${
                t.id === active ? "bg-surface-700" : "hover:bg-surface-700"
              }`}
            >
              <span
                className="w-4 h-4 rounded-full border border-black/10 shrink-0"
                style={{ background: `rgb(${t.accent})` }}
              />
              <span className="text-[13px] text-content-100">{t.name}</span>
              {t.id === active && (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" className="ml-auto text-accent">
                  <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="3"
                    strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
