"use client";

// components/ScanLine.tsx — the optical-cyan scan sweep (PLAN §3 motion law / §12).
//   • "scanning": a slow looping sweep while the engines work (calm "examining" motion).
//   • "reveal":  one decisive top→bottom pass when results land (OCR boxes fade in behind
//                it). Plays once via a remount key.
//   • reduced motion: render nothing — results just cross-fade in (handled by consumers).
import { motion, useReducedMotion } from "framer-motion";

export type ScanPhase = "none" | "scanning" | "reveal";

export function ScanLine({
  phase,
  revealKey,
}: {
  phase: ScanPhase;
  revealKey: number;
}) {
  const reduced = useReducedMotion();
  if (reduced || phase === "none") return null;

  const looping = phase === "scanning";

  return (
    <motion.div
      // Remount on each reveal so the one-shot sweep replays.
      key={looping ? "scan-loop" : `scan-reveal-${revealKey}`}
      aria-hidden="true"
      className="pointer-events-none absolute inset-x-0 top-0 z-20 h-px"
      style={{
        // a thin cyan core with a soft glow trail above it
        background:
          "linear-gradient(to bottom, rgba(56,225,214,0) 0%, rgba(56,225,214,0.9) 100%)",
        boxShadow: "0 0 14px 2px rgba(56,225,214,0.55)",
        height: looping ? "56px" : "40px",
        marginTop: looping ? "-56px" : "-40px",
      }}
      initial={{ top: "0%", opacity: looping ? 0.7 : 1 }}
      animate={{ top: "100%", opacity: looping ? 0.7 : [1, 1, 0] }}
      transition={
        looping
          ? { duration: 1.7, ease: "easeInOut", repeat: Infinity }
          : { duration: 0.8, ease: [0.4, 0, 0.2, 1] }
      }
    />
  );
}
