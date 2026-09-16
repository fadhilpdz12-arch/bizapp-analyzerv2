"use client";

/**
 * Sound effects.
 *
 * Tones are synthesised with the Web Audio API rather than shipped as files —
 * no downloads, no bundle weight, and the pitch can be tuned in code.
 *
 * Sound is reserved for moments that actually mean something (a recovery
 * logged, a target reached). Clicking around stays silent, because a tool used
 * all day becomes unbearable otherwise.
 */

const PREF_KEY = "bizapp-sound";

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  try {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
    return ctx;
  } catch {
    return null;
  }
}

export function soundEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Default on — the cue is part of the experience, and muting is one click.
    return localStorage.getItem(PREF_KEY) !== "off";
  } catch {
    return false;
  }
}

export function setSoundEnabled(on: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, on ? "on" : "off");
  } catch {
    /* preference simply won't persist */
  }
}

interface ToneOpts {
  freq: number;
  /** Seconds. */
  dur?: number;
  type?: OscillatorType;
  gain?: number;
  /** Seconds to wait before playing, for building chords into arpeggios. */
  delay?: number;
}

function tone({ freq, dur = 0.18, type = "sine", gain = 0.07, delay = 0 }: ToneOpts): void {
  const ac = audio();
  if (!ac) return;
  try {
    if (ac.state === "suspended") void ac.resume();
    const start = ac.currentTime + delay;

    const osc = ac.createOscillator();
    const amp = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);

    // Short attack then exponential decay reads as a "pluck" rather than a beep.
    amp.gain.setValueAtTime(0.0001, start);
    amp.gain.exponentialRampToValueAtTime(gain, start + 0.012);
    amp.gain.exponentialRampToValueAtTime(0.0001, start + dur);

    osc.connect(amp);
    amp.connect(ac.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
  } catch {
    /* audio is a nicety — never let it break the page */
  }
}

function play(fn: () => void): void {
  if (!soundEnabled()) return;
  fn();
}

/** Soft tick — command palette opening. */
export function sfxTick(): void {
  play(() => tone({ freq: 880, dur: 0.07, type: "triangle", gain: 0.035 }));
}

/** Rising third — a return was recovered. */
export function sfxSuccess(): void {
  play(() => {
    tone({ freq: 659.25, dur: 0.16, type: "sine", gain: 0.075 });            // E5
    tone({ freq: 987.77, dur: 0.26, type: "sine", gain: 0.065, delay: 0.1 }); // B5
  });
}

/** Full arpeggio — a target was reached. */
export function sfxMilestone(): void {
  play(() => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      tone({ freq: f, dur: 0.32, type: "sine", gain: 0.07, delay: i * 0.09 })
    );
  });
}

/** Low double — something failed to save. */
export function sfxError(): void {
  play(() => {
    tone({ freq: 220, dur: 0.14, type: "sawtooth", gain: 0.045 });
    tone({ freq: 165, dur: 0.2, type: "sawtooth", gain: 0.045, delay: 0.11 });
  });
}

/** Neutral confirmation — a record saved. */
export function sfxSave(): void {
  play(() => tone({ freq: 587.33, dur: 0.11, type: "triangle", gain: 0.04 }));
}
