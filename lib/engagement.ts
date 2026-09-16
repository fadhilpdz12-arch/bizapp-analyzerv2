"use client";

/**
 * Light engagement layer: a daily streak and a set of unlockable badges.
 *
 * The intent is to make steady daily follow-up feel rewarding, since recovery
 * work is repetitive. Nothing here changes the numbers — it only reflects work
 * that actually happened.
 */

const STREAK_KEY = "bizapp-streak";
const BADGE_KEY = "bizapp-badges";

export interface StreakState {
  /** Consecutive days with at least one logged action. */
  current: number;
  best: number;
  /** yyyy-mm-dd of the last day work was logged. */
  lastActive: string;
  /** Total actions ever logged, used for badges. */
  totalActions: number;
  /** Total recovered ringgit ever logged. */
  totalRecovered: number;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const d1 = new Date(`${a}T00:00:00`);
  const d2 = new Date(`${b}T00:00:00`);
  return Math.round((d2.getTime() - d1.getTime()) / 86400000);
}

export function loadStreak(): StreakState {
  const blank: StreakState = {
    current: 0,
    best: 0,
    lastActive: "",
    totalActions: 0,
    totalRecovered: 0,
  };
  if (typeof window === "undefined") return blank;
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    return raw ? { ...blank, ...JSON.parse(raw) } : blank;
  } catch {
    return blank;
  }
}

function persist(s: StreakState): void {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(s));
  } catch {
    /* engagement data is not worth breaking the page over */
  }
}

/**
 * Records that work happened. Returns the updated state so the caller can
 * react to a streak that just grew.
 */
export function recordActivity(recoveredDelta = 0): StreakState {
  const s = loadStreak();
  const t = today();

  if (s.lastActive === t) {
    // Same day — the streak doesn't move, but the totals do.
    s.totalActions += 1;
    s.totalRecovered += recoveredDelta;
    persist(s);
    return s;
  }

  const gap = s.lastActive ? daysBetween(s.lastActive, t) : Infinity;
  // One day later continues the run; a bigger gap starts over.
  s.current = gap === 1 ? s.current + 1 : 1;
  s.best = Math.max(s.best, s.current);
  s.lastActive = t;
  s.totalActions += 1;
  s.totalRecovered += recoveredDelta;
  persist(s);
  return s;
}

/** A streak is only alive if work happened today or yesterday. */
export function streakAlive(s: StreakState): boolean {
  if (!s.lastActive) return false;
  return daysBetween(s.lastActive, today()) <= 1;
}

// ── Badges ─────────────────────────────────────────────────────────────────

export interface Badge {
  id: string;
  name: string;
  desc: string;
  icon: string;
  /** Returns true once the badge has been earned. */
  earned: (s: StreakState, ctx: BadgeContext) => boolean;
}

export interface BadgeContext {
  recoveredTotal: number;
  reorderCount: number;
  processedCount: number;
  totalReturns: number;
}

export const BADGES: Badge[] = [
  {
    id: "first-call",
    name: "Langkah Pertama",
    desc: "Proses return pertama anda",
    icon: "👋",
    earned: (_s, c) => c.processedCount >= 1,
  },
  {
    id: "first-win",
    name: "Pemulihan Pertama",
    desc: "Berjaya pujuk customer re-order",
    icon: "🎉",
    earned: (_s, c) => c.reorderCount >= 1,
  },
  {
    id: "ten-wins",
    name: "Sepuluh Kemenangan",
    desc: "10 order berjaya dipulihkan",
    icon: "🔟",
    earned: (_s, c) => c.reorderCount >= 10,
  },
  {
    id: "rm1k",
    name: "Seribu Pertama",
    desc: "RM1,000 jualan dipulihkan",
    icon: "💰",
    earned: (_s, c) => c.recoveredTotal >= 1000,
  },
  {
    id: "rm5k",
    name: "Lima Ribu",
    desc: "RM5,000 jualan dipulihkan",
    icon: "💎",
    earned: (_s, c) => c.recoveredTotal >= 5000,
  },
  {
    id: "streak3",
    name: "Tiga Hari",
    desc: "Bekerja 3 hari berturut-turut",
    icon: "🔥",
    earned: (s) => s.best >= 3,
  },
  {
    id: "streak7",
    name: "Seminggu Penuh",
    desc: "Bekerja 7 hari berturut-turut",
    icon: "⚡",
    earned: (s) => s.best >= 7,
  },
  {
    id: "half",
    name: "Separuh Jalan",
    desc: "Proses separuh senarai return",
    icon: "🏃",
    earned: (_s, c) => c.totalReturns > 0 && c.processedCount >= c.totalReturns / 2,
  },
  {
    id: "clear",
    name: "Senarai Bersih",
    desc: "Proses semua return dalam senarai",
    icon: "🏆",
    earned: (_s, c) => c.totalReturns > 0 && c.processedCount >= c.totalReturns,
  },
];

/** Badges earned now, and which of those are newly unlocked since last check. */
export function evaluateBadges(
  s: StreakState,
  ctx: BadgeContext
): { earned: Badge[]; fresh: Badge[] } {
  const earned = BADGES.filter((b) => b.earned(s, ctx));

  let known: string[] = [];
  try {
    known = JSON.parse(localStorage.getItem(BADGE_KEY) ?? "[]");
  } catch {
    known = [];
  }

  const fresh = earned.filter((b) => !known.includes(b.id));
  if (fresh.length) {
    try {
      localStorage.setItem(BADGE_KEY, JSON.stringify(earned.map((b) => b.id)));
    } catch {
      /* ignore */
    }
  }

  return { earned, fresh };
}
