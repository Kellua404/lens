"use client";

// components/Actions.tsx — the "real output" controls (PLAN §8): download the composited
// analysis card (PNG), download the full results JSON (proof the analysis was structured +
// real), and reset to analyze another image. Only shown once there's a result to export.
import { useState } from "react";
import { Download, FileJson, RotateCcw } from "lucide-react";
import type { AnalysisResult } from "@/lib/types";
import { downloadCard, downloadJSON } from "@/lib/exportCard";
import { useLens } from "@/store/useLens";

export function Actions({
  result,
  imageUrl,
}: {
  result: AnalysisResult;
  imageUrl: string;
}) {
  const reset = useLens((s) => s.reset);
  const showToast = useLens((s) => s.showToast);
  const [rendering, setRendering] = useState(false);

  const onCard = async () => {
    setRendering(true);
    try {
      await downloadCard(result, imageUrl);
      showToast("Analysis card downloaded");
    } catch {
      showToast("Couldn't render the card — try again.");
    } finally {
      setRendering(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onCard}
        disabled={rendering}
        className="flex items-center gap-2 rounded-md border border-scan/40 bg-scan/10 px-3 py-2 font-mono text-[12px] text-scan transition-colors hover:bg-scan/20 disabled:opacity-60"
      >
        <Download size={14} />
        {rendering ? "rendering…" : "analysis card"}
      </button>
      <button
        onClick={() => {
          downloadJSON(result);
          showToast("Results JSON downloaded");
        }}
        className="flex items-center gap-2 rounded-md border border-line bg-surface-2 px-3 py-2 font-mono text-[12px] text-text-dim transition-colors hover:text-text"
      >
        <FileJson size={14} />
        results json
      </button>
      <button
        onClick={reset}
        className="ml-auto flex items-center gap-2 rounded-md px-3 py-2 font-mono text-[12px] text-text-dim transition-colors hover:text-text"
      >
        <RotateCcw size={14} />
        new image
      </button>
    </div>
  );
}
