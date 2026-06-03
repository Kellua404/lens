"use client";

// components/Telemetry.tsx — the honest instrument readout (PLAN §3/§6/§16). Every value
// is real measured output from the server function: model id, per-stage latency, image
// dimensions, top-1 confidence, word count — plus the env-proof line that is the whole
// flex: it all ran server-side, on onnx + tesseract, with no Vision API and no key, $0.
import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { AnalysisResult } from "@/lib/types";

export function Telemetry({ result }: { result: AnalysisResult | null }) {
  const t = result?.telemetry;
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-line bg-surface px-4 py-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-7 sm:gap-y-2">
      <Field label="MODEL" value={t ? shortModel(t.model) : "—"} title={t?.model} wide />
      <Field label="CLASSIFY" value={t ? <Ms n={t.classifyMs} /> : "—"} />
      <Field label="OCR" value={t ? <Ms n={t.ocrMs} /> : "—"} />
      <Field
        label="DIMENSIONS"
        value={t ? `${t.width}×${t.height}` : "—"}
      />
      <Field
        label="CONFIDENCE"
        value={t ? `${(t.topConfidence * 100).toFixed(1)}%` : "—"}
      />
      <Field label="WORDS" value={t ? String(t.wordCount) : "—"} />

      <div className="ml-auto flex items-center gap-2 font-mono text-[11px]">
        <span className="inline-block h-1.5 w-1.5 rounded-full bg-ok" aria-hidden="true" />
        <span className="text-text-dim">
          server · onnx + tesseract · no Vision API · $0
          {t?.coldStart ? " · cold start" : ""}
        </span>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  title,
  wide,
}: {
  label: string;
  value: React.ReactNode;
  title?: string;
  wide?: boolean;
}) {
  return (
    <div className={`flex items-baseline gap-2 ${wide ? "min-w-0" : ""}`} title={title}>
      <span className="font-mono text-[10px] tracking-[0.16em] text-text-dim">
        {label}
      </span>
      <span className="truncate font-mono text-[0.82rem] text-text">{value}</span>
    </div>
  );
}

// Count the latency up so the readout "settles" like an instrument (PLAN §12).
function Ms({ n }: { n: number }) {
  const reduced = useReducedMotion();
  const [v, setV] = useState(0);
  const raf = useRef<number>(0);

  useEffect(() => {
    if (reduced) return; // reduced motion shows the final value directly (see render)
    const start = performance.now();
    const dur = 420;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setV(Math.round(n * eased));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [n, reduced]);

  return <>{reduced ? n : v} ms</>;
}

function shortModel(id: string): string {
  // "Xenova/vit-base-patch16-224" → "vit-base-patch16-224"
  return id.includes("/") ? id.split("/").slice(1).join("/") : id;
}
