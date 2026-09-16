"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { sfxMilestone } from "@/lib/sfx";
import { useConfetti } from "./useConfetti";
import CountUp from "./CountUp";

const GOAL_KEY = "bizapp-recovery-goal";
const HIT_KEY = "bizapp-recovery-goal-hit";

/**
 * A target for recovered sales, with a ring that fills as the team works.
 *
 * The celebration fires once per target: the value that triggered it is stored,
 * so re-opening the page or logging another recovery doesn't replay it.
 */
export default function RecoveryGoal({ recovered }: { recovered: number }) {
  const [goal, setGoal] = useState<number>(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [ready, setReady] = useState(false);
  const burst = useConfetti();
  const celebrated = useRef(false);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem(GOAL_KEY));
      if (Number.isFinite(saved) && saved > 0) setGoal(saved);
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const save = useCallback((value: number) => {
    setGoal(value);
    try {
      localStorage.setItem(GOAL_KEY, String(value));
      // A new target means the old celebration no longer applies.
      localStorage.removeItem(HIT_KEY);
    } catch {
      /* ignore */
    }
    celebrated.current = false;
  }, []);

  const pct = goal > 0 ? Math.min(recovered / goal, 1) : 0;
  const reached = goal > 0 && recovered >= goal;

  useEffect(() => {
    if (!ready || !reached || celebrated.current) return;
    let already = false;
    try {
      already = localStorage.getItem(HIT_KEY) === String(goal);
    } catch {
      /* ignore */
    }
    if (already) {
      celebrated.current = true;
      return;
    }
    celebrated.current = true;
    try {
      localStorage.setItem(HIT_KEY, String(goal));
    } catch {
      /* ignore */
    }
    burst(160);
    sfxMilestone();
  }, [ready, reached, goal, burst]);

  const R = 52;
  const C = 2 * Math.PI * R;

  if (!ready) return null;

  return (
    <div className="ticket p-5 sm:p-6">
      <div className="flex flex-wrap items-center gap-5">
        <div className="relative shrink-0">
          <svg width="128" height="128" viewBox="0 0 128 128" className="-rotate-90">
            <circle
              cx="64" cy="64" r={R}
              fill="none" stroke="currentColor" strokeWidth="11"
              className="text-surface-700"
            />
            <circle
              cx="64" cy="64" r={R}
              fill="none"
              stroke="currentColor"
              strokeWidth="11"
              strokeLinecap="round"
              className={reached ? "text-stamp-green" : "text-accent"}
              strokeDasharray={C}
              strokeDashoffset={C * (1 - pct)}
              style={{ transition: "stroke-dashoffset 900ms cubic-bezier(.2,.7,.2,1)" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className={`font-display font-extrabold text-[1.5rem] leading-none ${
                reached ? "text-stamp-green" : "text-content-100"
              }`}
            >
              {goal > 0 ? `${Math.round(pct * 100)}%` : "—"}
            </span>
            {reached && <span className="text-[10px] text-stamp-green mt-0.5">Tercapai</span>}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-content-300/60">
            Sasaran Pemulihan
          </p>

          {goal > 0 ? (
            <>
              <p className="font-display font-extrabold text-[1.7rem] text-content-100 leading-tight mt-1">
                <CountUp value={recovered} prefix="RM " />
                <span className="text-content-300/60 text-[1rem] font-body font-normal">
                  {" "}/ RM {goal.toLocaleString()}
                </span>
              </p>
              <p className="text-[12.5px] text-content-300/80 mt-1">
                {reached
                  ? "Tahniah — sasaran bulan ini tercapai."
                  : `Baki RM ${(goal - recovered).toLocaleString()} untuk capai sasaran.`}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-content-300 mt-1.5">
              Tetapkan sasaran pemulihan supaya pasukan ada nombor untuk dikejar.
            </p>
          )}

          {editing ? (
            <div className="flex flex-wrap gap-2 mt-3">
              <input
                type="number"
                min={0}
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = Number(draft);
                    if (v > 0) save(v);
                    setEditing(false);
                  }
                  if (e.key === "Escape") setEditing(false);
                }}
                placeholder="Contoh: 5000"
                className="input w-[150px]"
              />
              <button
                onClick={() => {
                  const v = Number(draft);
                  if (v > 0) save(v);
                  setEditing(false);
                }}
                className="btn-accent"
              >
                Simpan
              </button>
              <button onClick={() => setEditing(false)} className="btn-soft">Batal</button>
            </div>
          ) : (
            <button
              onClick={() => {
                setDraft(goal > 0 ? String(goal) : "");
                setEditing(true);
              }}
              className="btn-soft mt-3"
            >
              {goal > 0 ? "Tukar Sasaran" : "Tetapkan Sasaran"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
