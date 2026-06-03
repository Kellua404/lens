"use client";

// components/LightTable.tsx — the specimen surface (PLAN §3/§6). Holds the uploaded image,
// the scan-line sweep, and the OCR overlay, plus the empty + warming states. The image is
// rendered at w-full/h-auto so its element box exactly equals the image content box — the
// OCR overlay (inset-0) then maps natural px → displayed px with a single scale factor.
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ScanLine, type ScanPhase } from "./ScanLine";
import { OcrOverlay } from "./OcrOverlay";
import type { Status } from "@/store/useLens";
import type { AnalysisResult } from "@/lib/types";

export function LightTable({
  imageUrl,
  status,
  result,
}: {
  imageUrl: string | null;
  status: Status;
  result: AnalysisResult | null;
}) {
  const reduced = useReducedMotion();
  const [revealKey, setRevealKey] = useState(0);
  const wasDone = useRef(false);

  // Fire one reveal sweep on the transition into "done".
  useEffect(() => {
    if (status === "done" && !wasDone.current) {
      setRevealKey((k) => k + 1);
      wasDone.current = true;
    }
    if (status !== "done") wasDone.current = false;
  }, [status]);

  const busy = status === "warming" || status === "analyzing";
  const phase: ScanPhase = busy ? "scanning" : status === "done" ? "reveal" : "none";

  // ── empty table ────────────────────────────────────────────────────────────
  if (!imageUrl) {
    return (
      <div className="relative flex aspect-[4/3] w-full items-center justify-center overflow-hidden rounded-lg border border-line bg-surface">
        <CornerTicks />
        <div className="flex flex-col items-center gap-4 px-6 text-center">
          <svg width="46" height="46" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="breathe text-scan/70">
            <circle cx="16" cy="16" r="11.5" stroke="currentColor" strokeWidth="1.2" />
            <circle cx="16" cy="16" r="3" stroke="currentColor" strokeWidth="1.2" />
            <path d="M16 2v6M16 24v6M2 16h6M24 16h6" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
          <p className="max-w-[22ch] font-display text-[0.95rem] text-text-dim">
            Drop an image on the table — or paste / pick one.
          </p>
        </div>
      </div>
    );
  }

  // ── seated specimen ──────────────────────────────────────────────────────────
  return (
    <div className="relative overflow-hidden rounded-lg border border-line bg-surface">
      {/* lit-table glow under the specimen */}
      <div
        className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 0%, rgba(56,225,214,0.07), transparent 60%)",
        }}
      />
      <CornerTicks />

      <motion.div
        className="relative z-[1]"
        initial={reduced ? false : { opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={
            result?.labels[0]
              ? `User-supplied image — the model's top reading: ${result.labels[0].label}`
              : "User-supplied image on the analysis table"
          }
          className="block h-auto w-full select-none"
          draggable={false}
        />

        {result && (
          <OcrOverlay
            words={result.words}
            naturalWidth={result.dimensions.width}
            naturalHeight={result.dimensions.height}
            play={status === "done"}
          />
        )}

        <ScanLine phase={phase} revealKey={revealKey} />

        {/* warming/analyzing veil — honest, never a fake progress bar */}
        {busy && (
          <div className="absolute inset-0 z-[15] flex items-end justify-start bg-bg/30 p-3">
            <span className="rounded bg-surface-2/90 px-2 py-1 font-mono text-[11px] tracking-wide text-scan ring-1 ring-line">
              {status === "warming"
                ? "cold start — warming the vision engine…"
                : "analyzing…"}
            </span>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// Forensic registration ticks at each corner of the table.
function CornerTicks() {
  const base = "pointer-events-none absolute z-[5] text-scan/40";
  return (
    <>
      <span className={`${base} left-2 top-2 h-3 w-3 border-l border-t border-current`} />
      <span className={`${base} right-2 top-2 h-3 w-3 border-r border-t border-current`} />
      <span className={`${base} bottom-2 left-2 h-3 w-3 border-b border-l border-current`} />
      <span className={`${base} bottom-2 right-2 h-3 w-3 border-b border-r border-current`} />
    </>
  );
}
