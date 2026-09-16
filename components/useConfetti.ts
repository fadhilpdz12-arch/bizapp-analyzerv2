"use client";

import { useCallback, useEffect, useRef } from "react";

interface Piece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
}

const COLORS = ["#E8203C", "#12A150", "#C67C08", "#7C4DFF", "#4F46E5", "#0D9488"];

/**
 * A one-shot confetti burst.
 *
 * Rendered on a fixed canvas above the page. The animation stops itself once
 * every piece has fallen out of view, so nothing keeps running in the
 * background after the moment has passed.
 */
export function useConfetti() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const piecesRef = useRef<Piece[]>([]);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = document.createElement("canvas");
    canvas.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:60;";
    document.body.appendChild(canvas);
    canvasRef.current = canvas;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      canvas.remove();
    };
  }, []);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    ctx.clearRect(0, 0, W, H);

    const pieces = piecesRef.current;
    for (let i = pieces.length - 1; i >= 0; i--) {
      const p = pieces[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.16; // gravity
      p.vx *= 0.995;
      p.rot += p.vr;

      if (p.y > H + 30) {
        pieces.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.92;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    if (pieces.length) {
      rafRef.current = requestAnimationFrame(loop);
    } else {
      rafRef.current = null;
      ctx.clearRect(0, 0, W, H);
    }
  }, []);

  return useCallback(
    (count = 120) => {
      if (
        typeof window === "undefined" ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }
      const W = window.innerWidth;
      for (let i = 0; i < count; i++) {
        piecesRef.current.push({
          x: W / 2 + (Math.random() - 0.5) * W * 0.55,
          y: -20 - Math.random() * 120,
          vx: (Math.random() - 0.5) * 5,
          vy: 2 + Math.random() * 4,
          w: 6 + Math.random() * 6,
          h: 9 + Math.random() * 8,
          rot: Math.random() * Math.PI * 2,
          vr: (Math.random() - 0.5) * 0.3,
          color: COLORS[Math.floor(Math.random() * COLORS.length)],
        });
      }
      if (!rafRef.current) rafRef.current = requestAnimationFrame(loop);
    },
    [loop]
  );
}
