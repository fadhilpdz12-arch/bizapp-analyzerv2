"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BADGES,
  Badge,
  BadgeContext,
  StreakState,
  evaluateBadges,
  loadStreak,
  streakAlive,
} from "@/lib/engagement";
import { sfxMilestone } from "@/lib/sfx";
import { useConfetti } from "./useConfetti";
import CountUp from "./CountUp";

export default function StreakPanel({
  ctx,
  refreshKey,
}: {
  ctx: BadgeContext;
  /** Bump to re-read storage after the admin logs something. */
  refreshKey: number;
}) {
  const [streak, setStreak] = useState<StreakState | null>(null);
  const [fresh, setFresh] = useState<Badge[]>([]);
  const burst = useConfetti();

  useEffect(() => {
    const s = loadStreak();
    setStreak(s);
    const { fresh: newly } = evaluateBadges(s, ctx);
    if (newly.length) {
      setFresh(newly);
      burst(140);
      sfxMilestone();
      // The banner is a moment, not a permanent fixture.
      const t = setTimeout(() => setFresh([]), 9000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey, ctx.processedCount, ctx.reorderCount, ctx.recoveredTotal]);

  const earned = useMemo(
    () => (streak ? evaluateBadges(streak, ctx).earned : []),
    [streak, ctx]
  );
  const earnedIds = useMemo(() => new Set(earned.map((b) => b.id)), [earned]);

  if (!streak) return null;

  const alive = streakAlive(streak);

  return (
    <div className="space-y-4">
      {fresh.length > 0 && (
        <div className="notice notice-info px-4 py-3.5">
          <p className="font-display font-bold text-[15px] text-content-100">
            Pencapaian baharu dibuka
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {fresh.map((b) => (
              <span
                key={b.id}
                className="flex items-center gap-1.5 text-[12.5px] bg-surface-700 border border-surface-600 rounded-full px-2.5 py-1"
              >
                <span>{b.icon}</span>
                <span className="font-medium text-content-100">{b.name}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="ticket p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-6">
          <div className="text-center shrink-0">
            <p className="text-[2.2rem] leading-none">{alive && streak.current > 0 ? "🔥" : "💤"}</p>
            <p className="font-display font-extrabold text-[1.9rem] text-content-100 leading-none mt-1.5">
              <CountUp value={alive ? streak.current : 0} />
            </p>
            <p className="font-mono text-[9.5px] uppercase tracking-wider text-content-300/60 mt-1">
              hari berturut
            </p>
          </div>

          <div className="min-w-0 flex-1">
            <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/60">
              Rekod Kerja
            </p>
            <p className="text-[13.5px] text-content-100 mt-1.5">
              {alive && streak.current > 1
                ? `${streak.current} hari berturut-turut — teruskan momentum.`
                : alive && streak.current === 1
                ? "Hari pertama. Kembali esok untuk mula streak."
                : "Streak terhenti. Proses satu return untuk mula semula."}
            </p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2.5 font-mono text-[11.5px] text-content-300/80">
              <span>Rekod terbaik: <strong className="text-content-100">{streak.best} hari</strong></span>
              <span>Jumlah tindakan: <strong className="text-content-100">{streak.totalActions}</strong></span>
              <span>
                Lencana: <strong className="text-content-100">{earned.length}/{BADGES.length}</strong>
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-surface-600">
          <p className="font-mono text-[9px] uppercase tracking-wider text-content-300/50 mb-3">
            Pencapaian
          </p>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2.5">
            {BADGES.map((b) => {
              const got = earnedIds.has(b.id);
              return (
                <div
                  key={b.id}
                  title={`${b.name} — ${b.desc}`}
                  className={`flex flex-col items-center text-center rounded-xl border px-2 py-3 transition-colors ${
                    got
                      ? "border-surface-600 bg-surface-700"
                      : "border-dashed border-surface-600 opacity-45"
                  }`}
                >
                  <span className={`text-[1.3rem] ${got ? "" : "grayscale"}`}>{b.icon}</span>
                  <span className="text-[10px] text-content-300 mt-1 leading-tight">
                    {b.name}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
