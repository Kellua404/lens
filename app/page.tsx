"use client";

// app/page.tsx — the forensic light table (PLAN §3/§6). A single screen: header with the
// env-proof, a two-column body (the specimen on the light table · the instrument readout),
// the export actions, and the honest telemetry strip. The whole UI is a pure function of
// the Zustand store; this file just wires components to it and warms the engine on mount.
import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { useLens } from "@/store/useLens";
import { Wordmark } from "@/components/Wordmark";
import { Dropzone } from "@/components/Dropzone";
import { LightTable } from "@/components/LightTable";
import { Readout } from "@/components/Readout";
import { Telemetry } from "@/components/Telemetry";
import { Actions } from "@/components/Actions";

export default function Home() {
  const {
    status,
    imageUrl,
    result,
    error,
    toast,
    warm,
    analyze,
  } = useLens();

  // Warm both engines on first paint so the first analysis is fast (cold start still
  // reported honestly in the telemetry).
  useEffect(() => {
    warm();
  }, [warm]);

  return (
    <div className="relative min-h-full">
      {/* the hairline technical grid that backs the darkroom */}
      <div className="grid-field pointer-events-none fixed inset-0 z-0 opacity-[0.5]" aria-hidden="true" />
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            "radial-gradient(80% 50% at 50% -10%, rgba(56,225,214,0.06), transparent 70%)",
        }}
        aria-hidden="true"
      />

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 py-6 sm:px-8 sm:py-8">
        {/* ── header ─────────────────────────────────────────────────────── */}
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
          <div className="flex items-baseline gap-3">
            <Wordmark />
            <span className="font-mono text-[12px] text-text-dim">
              ▸ see what the machine sees
            </span>
          </div>
          <span className="rounded-full border border-line bg-surface px-3 py-1 font-mono text-[11px] text-text-dim">
            server · onnx + tesseract · <span className="text-ok">$0</span>
          </span>
        </header>

        {/* ── body ───────────────────────────────────────────────────────── */}
        <div className="grid flex-1 gap-7 py-7 lg:grid-cols-2">
          {/* light table */}
          <section aria-label="Light table">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-mono text-[11px] tracking-[0.18em] text-text-dim">
                LIGHT TABLE
              </h2>
              {imageUrl && (
                <span className="font-mono text-[11px] text-text-dim">
                  drop · paste · pick to replace
                </span>
              )}
            </div>

            <Dropzone onFile={analyze}>
              <LightTable imageUrl={imageUrl} status={status} result={result} />
            </Dropzone>

            {error && (
              <div
                role="alert"
                className="mt-3 flex items-center gap-2 rounded-md border border-err/40 bg-err/10 px-3 py-2 font-mono text-[12px] text-err"
              >
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            {status === "done" && result && imageUrl && (
              <div className="mt-4">
                <Actions result={result} imageUrl={imageUrl} />
              </div>
            )}
          </section>

          {/* readout */}
          <section aria-label="Readout">
            <h2 className="mb-3 font-mono text-[11px] tracking-[0.18em] text-text-dim">
              READOUT
            </h2>
            <Readout result={result} />
          </section>
        </div>

        {/* ── telemetry ─────────────────────────────────────────────────── */}
        <section aria-label="Telemetry" className="pb-2">
          <Telemetry result={result} />
        </section>

        {/* ── footer ────────────────────────────────────────────────────── */}
        <footer className="mt-5 flex flex-col gap-1 border-t border-line pt-5 font-mono text-[11px] leading-relaxed text-text-dim">
          <p>
            Every analysis runs inside this Vercel function: a real ONNX vision transformer
            names the image, Tesseract reads its text, and the palette is quantized straight
            from the pixels — no Google/AWS Vision API, no API key, $0.
          </p>
          <p className="text-text-dim">
            Processed in-memory on our server. Nothing is stored.
          </p>
        </footer>
      </main>

      {/* aria-live status for screen readers (PLAN §13) */}
      <p className="sr-only" role="status" aria-live="polite">
        {statusMessage(status, result)}
      </p>

      {/* transient copy/download confirmation */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-full border border-line bg-surface-2 px-4 py-2 font-mono text-[12px] text-text shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function statusMessage(
  status: ReturnType<typeof useLens.getState>["status"],
  result: ReturnType<typeof useLens.getState>["result"],
): string {
  if (status === "warming") return "Cold start — warming the vision engine.";
  if (status === "analyzing") return "Analyzing the image.";
  if (status === "error") return "Analysis failed.";
  if (status === "done" && result) {
    const top = result.labels[0]?.label ?? "unknown";
    const words = result.telemetry.wordCount;
    return `Analysis complete: ${top}. ${
      words > 0 ? `${words} words found.` : "No legible text."
    }`;
  }
  return "";
}
