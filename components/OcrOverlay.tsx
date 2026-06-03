"use client";

// components/OcrOverlay.tsx — draw OCR word boxes ON the specimen (PLAN §5.3).
// Word boxes come back in NATURAL image px; we scale them to the displayed image size and
// recompute on resize (ResizeObserver). Each box: optical-cyan hairline + ~18% fill, with
// the recognized text + confidence on hover. The boxes are decorative enhancement — the
// same text is real, copyable output in the Readout — so this layer is aria-hidden.
import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Word } from "@/lib/types";

export function OcrOverlay({
  words,
  naturalWidth,
  naturalHeight,
  play,
}: {
  words: Word[];
  naturalWidth: number;
  naturalHeight: number;
  play: boolean; // true once results have landed (drives the fade-in)
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const el = ref.current;
    if (!el || !naturalWidth) return;
    const measure = () => setScale(el.clientWidth / naturalWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [naturalWidth]);

  if (!words.length || !naturalWidth || !naturalHeight) {
    // Still mount the ref node so measurement works the instant words arrive.
    return <div ref={ref} className="pointer-events-none absolute inset-0" aria-hidden="true" />;
  }

  return (
    <div ref={ref} className="absolute inset-0 z-10" aria-hidden="true">
      {scale > 0 &&
        words.map((w, i) => (
          <motion.div
            key={`${i}-${w.text}`}
            className="group absolute"
            style={{
              left: w.box.x * scale,
              top: w.box.y * scale,
              width: w.box.w * scale,
              height: w.box.h * scale,
            }}
            initial={reduced ? false : { opacity: 0, scale: 0.92 }}
            animate={play ? { opacity: 1, scale: 1 } : { opacity: 0 }}
            transition={
              reduced
                ? { duration: 0 }
                : { duration: 0.28, delay: 0.25 + Math.min(i * 0.035, 0.6) }
            }
          >
            <div className="pointer-events-auto h-full w-full rounded-[2px] border border-scan/80 bg-scan/[0.18] transition-colors group-hover:bg-scan/30" />
            {/* hover label — recognized word + confidence */}
            <div className="pointer-events-none absolute -top-6 left-0 z-30 hidden whitespace-nowrap rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] leading-none text-text shadow-lg ring-1 ring-line group-hover:block">
              {w.text} <span className="text-text-dim">{w.confidence}%</span>
            </div>
          </motion.div>
        ))}
    </div>
  );
}
