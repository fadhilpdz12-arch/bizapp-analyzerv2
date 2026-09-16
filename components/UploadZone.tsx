"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { quoteOfTheMoment, greeting, LOADING_STEPS } from "@/lib/motivation";

interface UploadZoneProps {
  onFiles: (files: File[]) => void;
  loading: boolean;
  error: string | null;
}

export default function UploadZone({ onFiles, loading, error }: UploadZoneProps) {
  const [dragOver, setDragOver] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Avoid hydration mismatch: greeting/quote depend on current time.
  useEffect(() => setMounted(true), []);

  const hi = useMemo(() => greeting(), [mounted]);
  const quote = useMemo(() => quoteOfTheMoment(), [mounted]);

  useEffect(() => {
    if (!loading) {
      setStep(0);
      return;
    }
    const iv = setInterval(() => {
      setStep((s) => (s + 1) % LOADING_STEPS.length);
    }, 550);
    return () => clearInterval(iv);
  }, [loading]);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || !files.length) return;
      onFiles(Array.from(files));
    },
    [onFiles]
  );

  return (
    <div className="min-h-[100dvh] flex items-center justify-center blueprint-grid px-5 py-10 sm:px-6">
      <div className="max-w-xl w-full fade-up">
        {/* Greeting */}
        <div className="text-center mb-6 sm:mb-7">
          <p className="font-mono text-[10px] sm:text-[11px] tracking-[0.3em] text-accent uppercase mb-3">
            Analisis Return & Penghantaran
          </p>
          <h1 className="font-display font-extrabold text-[2.6rem] leading-[0.92] sm:text-6xl text-content-100">
            BIZAPP
            <br />
            ANALYZER
          </h1>
          {mounted && (
            <p className="text-content-100/80 mt-4 text-[15px] sm:text-[16px]">
              {hi.hello}, Nurul. <span className="text-content-300/55">{hi.nudge}</span>
            </p>
          )}
        </div>

        {/* Motivation quote — ticket stub */}
        {mounted && (
          <figure className="ticket px-5 py-4 sm:px-6 sm:py-5 mb-6 fade-up">
            <div className="flex items-start gap-3">
              <span className="font-display font-extrabold text-accent text-3xl leading-none select-none">
                &ldquo;
              </span>
              <div className="min-w-0">
                <blockquote className="text-content-100/90 text-[14px] sm:text-[15px] leading-relaxed">
                  {quote.text}
                </blockquote>
                <figcaption className="font-mono text-[9.5px] sm:text-[10px] tracking-[0.22em] uppercase text-content-300/45 mt-2">
                  {quote.tag}
                </figcaption>
              </div>
            </div>
          </figure>
        )}

        {/* Drop zone */}
        <label
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={`relative block cursor-pointer rounded-sm border-2 border-dashed transition-colors ${
            dragOver ? "border-accent bg-accent/5" : "border-surface-500/60 hover:border-accent/60 active:border-accent"
          } px-6 py-10 sm:px-8 sm:py-14 text-center`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
            disabled={loading}
          />

          {loading ? (
            <div className="space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full border-2 border-accent/30 border-t-accent animate-spin" />
              <p className="font-mono text-[12px] sm:text-[13px] tracking-[0.12em] text-accent uppercase">
                {LOADING_STEPS[step]}
              </p>
              <div className="h-0.5 w-full max-w-[220px] mx-auto bg-surface-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-500 ease-out"
                  style={{ width: `${((step + 1) / LOADING_STEPS.length) * 100}%` }}
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full border-2 border-accent/50 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="text-accent">
                  <path
                    d="M12 3v12m0 0-4-4m4 4 4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-content-100 font-medium text-[15px] sm:text-[16px]">
                <span className="text-accent underline underline-offset-4">Pilih fail Bizapp</span>
                <span className="hidden sm:inline text-content-300/60"> atau seret ke sini</span>
              </p>
              <p className="text-content-300/55 text-[12.5px] sm:text-[13px]">
                Boleh pilih beberapa fail sekali gus untuk banding antara bulan
              </p>
              <p className="text-content-300/40 text-[11.5px] font-mono">.XLSX · .XLS · .CSV</p>
            </div>
          )}
        </label>

        {error && (
          <div className="mt-4 border border-stamp-red/40 bg-stamp-red/10 text-stamp-red text-[13px] px-4 py-3 rounded-sm">
            {error}
          </div>
        )}

        {/* Reassurance strip */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-center">
          {[
            "Diproses dalam browser",
            "Tiada data dihantar keluar",
            "Banyak fail digabung automatik",
          ].map((t) => (
            <span key={t} className="flex items-center gap-1.5 font-mono text-[10px] sm:text-[10.5px] text-content-300/40 uppercase tracking-wider">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className="text-stamp-green shrink-0">
                <path d="m5 13 4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
