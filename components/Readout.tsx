"use client";

// components/Readout.tsx — the instrument readout (PLAN §3/§6): three blocks drawn from
// REAL model output — CLASSIFY (ranked top-k with confidence bars), READ (extracted text,
// copyable), PALETTE (pixel-true swatches, click-to-copy hex). Never color/box-only:
// labels carry names + numeric scores, text is real selectable text, swatches expose hex.
import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import { useLens } from "@/store/useLens";

export function Readout({ result }: { result: AnalysisResult | null }) {
  return (
    <div className="flex flex-col gap-7">
      <Classify result={result} />
      <Read result={result} />
      <Palette result={result} />
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-mono text-[11px] font-medium tracking-[0.18em] text-scan">
      {children}
    </h2>
  );
}

function confidenceColor(score: number): string {
  if (score >= 0.6) return "var(--color-ok)";
  if (score >= 0.25) return "var(--color-scan)";
  return "var(--color-warn)";
}

function Classify({ result }: { result: AnalysisResult | null }) {
  const reduced = useReducedMotion();
  const labels = result?.labels ?? [];

  return (
    <section>
      <Label>CLASSIFY</Label>
      {labels.length === 0 ? (
        <Placeholder lines={3} />
      ) : (
        <ul className="flex flex-col gap-2.5">
          {labels.map((l, i) => (
            <li key={l.label + i}>
              <div className="mb-1 flex items-baseline justify-between gap-3">
                <span className="font-display text-[0.95rem] capitalize leading-tight text-text">
                  {l.label}
                </span>
                <span className="shrink-0 font-mono text-[0.8rem] text-text-dim">
                  {(l.score * 100).toFixed(1)}%
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: confidenceColor(l.score) }}
                  initial={reduced ? false : { width: 0 }}
                  animate={{ width: `${Math.max(2, l.score * 100)}%` }}
                  transition={
                    reduced
                      ? { duration: 0 }
                      : { duration: 0.5, delay: 0.3 + i * 0.06, ease: "easeOut" }
                  }
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Read({ result }: { result: AnalysisResult | null }) {
  const copyText = useLens((s) => s.copyText);
  const [copied, setCopied] = useState(false);
  const text = result?.text ?? "";
  const hasText = text.trim().length > 0;

  const onCopy = () => {
    copyText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <Label>READ</Label>
        {hasText && (
          <button
            onClick={onCopy}
            className="-mt-3 flex items-center gap-1.5 rounded px-1.5 py-1 font-mono text-[11px] text-text-dim transition-colors hover:text-text"
            aria-label="Copy extracted text"
          >
            {copied ? (
              <Check size={13} className="text-ok" />
            ) : (
              <Copy size={13} />
            )}
            {copied ? "copied" : "copy"}
          </button>
        )}
      </div>
      {!result ? (
        <Placeholder lines={2} />
      ) : hasText ? (
        <pre className="max-h-40 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-surface-2 p-3 font-mono text-[0.82rem] leading-relaxed text-text">
          {text}
        </pre>
      ) : (
        <p className="rounded-md border border-dashed border-line bg-surface px-3 py-3 font-mono text-[0.8rem] text-text-dim">
          No legible text in this image.
        </p>
      )}
    </section>
  );
}

function Palette({ result }: { result: AnalysisResult | null }) {
  const reduced = useReducedMotion();
  const copyHex = useLens((s) => s.copyHex);
  const palette = result?.palette ?? [];

  return (
    <section>
      <Label>PALETTE</Label>
      {palette.length === 0 ? (
        <div className="flex gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 flex-1 animate-pulse rounded-md bg-surface-2" />
          ))}
        </div>
      ) : (
        <div className="flex gap-2">
          {palette.map((hex, i) => (
            <motion.button
              key={hex + i}
              onClick={() => copyHex(hex)}
              className="group relative h-12 flex-1 overflow-hidden rounded-md ring-1 ring-inset ring-white/10 transition-transform hover:-translate-y-0.5"
              style={{ background: hex }}
              initial={reduced ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={
                reduced ? { duration: 0 } : { duration: 0.3, delay: 0.35 + i * 0.05 }
              }
              aria-label={`Copy color ${hex}`}
              title={`${hex} — click to copy`}
            >
              <span className="absolute inset-x-0 bottom-0 bg-bg/70 py-0.5 text-center font-mono text-[9px] uppercase tracking-wide text-text opacity-0 transition-opacity group-hover:opacity-100">
                {hex}
              </span>
            </motion.button>
          ))}
        </div>
      )}
    </section>
  );
}

function Placeholder({ lines }: { lines: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 rounded bg-surface-2" style={{ width: `${90 - i * 18}%` }} />
      ))}
    </div>
  );
}
