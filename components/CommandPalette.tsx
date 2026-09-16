"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sfxTick, soundEnabled, setSoundEnabled } from "@/lib/sfx";

export interface Command {
  id: string;
  label: string;
  hint?: string;
  group: string;
  icon?: string;
  run: () => void;
}

/**
 * Matches if every character of the query appears in order — so "prm" finds
 * "Promosi" and "rprc" finds "Reprocess". Returns a score so closer matches
 * (fewer gaps, earlier start) rank first.
 */
function fuzzy(text: string, query: string): number | null {
  if (!query) return 0;
  const t = text.toLowerCase();
  const q = query.toLowerCase();
  let ti = 0;
  let gaps = 0;
  let start = -1;

  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return null;
    if (start === -1) start = found;
    if (ti !== 0) gaps += found - ti;
    ti = found + 1;
  }
  return gaps * 2 + start;
}

export default function CommandPalette({
  commands,
  open,
  onOpenChange,
}: {
  commands: Command[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // ⌘K / Ctrl+K anywhere, Escape to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        onOpenChange(!open);
        if (!open) sfxTick();
      }
      if (e.key === "Escape" && open) onOpenChange(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCursor(0);
      // Focus after the dialog paints, or the caret lands nowhere.
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const scored = commands
      .map((c) => {
        const s = fuzzy(`${c.label} ${c.group}`, query);
        return s === null ? null : { cmd: c, score: s };
      })
      .filter((x): x is { cmd: Command; score: number } => x !== null);
    scored.sort((a, b) => a.score - b.score);
    return scored.map((s) => s.cmd).slice(0, 30);
  }, [commands, query]);

  const runAt = useCallback(
    (i: number) => {
      const cmd = results[i];
      if (!cmd) return;
      onOpenChange(false);
      cmd.run();
    },
    [results, onOpenChange]
  );

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      runAt(cursor);
    }
  };

  // Keep the highlighted row in view while arrowing through a long list.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-i="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor]);

  if (!open) return null;

  let lastGroup = "";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4 no-print"
      role="dialog"
      aria-modal="true"
      aria-label="Palet arahan"
    >
      <div
        className="absolute inset-0 bg-content-100/25 backdrop-blur-[2px]"
        onClick={() => onOpenChange(false)}
      />

      <div className="ticket relative w-full max-w-[560px] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-surface-600">
          <span className="text-content-300/60 text-[14px]">⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Taip arahan… (contoh: reprocess, tema, eksport)"
            className="flex-1 bg-transparent text-[14px] text-content-100 placeholder:text-content-300/45 focus:outline-none"
          />
          <kbd className="font-mono text-[10px] text-content-300/60 border border-surface-600 rounded px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1.5">
          {results.length === 0 && (
            <p className="px-4 py-6 text-center text-[13px] text-content-300/70">
              Tiada arahan sepadan.
            </p>
          )}

          {results.map((cmd, i) => {
            const showGroup = cmd.group !== lastGroup;
            lastGroup = cmd.group;
            return (
              <div key={cmd.id}>
                {showGroup && (
                  <p className="px-4 pt-2.5 pb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-content-300/50">
                    {cmd.group}
                  </p>
                )}
                <button
                  data-i={i}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => runAt(i)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors ${
                    i === cursor ? "bg-accent-wash" : "hover:bg-surface-700"
                  }`}
                >
                  {cmd.icon && <span className="text-[14px]">{cmd.icon}</span>}
                  <span
                    className={`text-[13.5px] ${
                      i === cursor ? "text-accent-ink font-medium" : "text-content-100"
                    }`}
                  >
                    {cmd.label}
                  </span>
                  {cmd.hint && (
                    <span className="ml-auto font-mono text-[10.5px] text-content-300/60">
                      {cmd.hint}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-surface-600 bg-surface-950/50">
          <Key label="↑↓" text="pilih" />
          <Key label="⏎" text="jalankan" />
          <Key label="⌘K" text="buka/tutup" />
        </div>
      </div>
    </div>
  );
}

function Key({ label, text }: { label: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="font-mono text-[9.5px] text-content-300/70 border border-surface-600 rounded px-1.5 py-0.5">
        {label}
      </kbd>
      <span className="text-[10.5px] text-content-300/60">{text}</span>
    </span>
  );
}

/** Convenience for the sound toggle, which several places need. */
export function soundCommand(onChange: () => void): Command {
  const on = soundEnabled();
  return {
    id: "sound",
    label: on ? "Matikan bunyi" : "Hidupkan bunyi",
    group: "Tetapan",
    icon: on ? "🔇" : "🔊",
    run: () => {
      setSoundEnabled(!on);
      onChange();
    },
  };
}
