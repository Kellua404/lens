// app/api/analyze/route.ts — the analyze route (PLAN §4.5)
//
// Orchestrates THREE real, server-side vision operations on one uploaded image —
// classification (ONNX ViT), OCR (Tesseract), and palette (sharp) — and returns a typed
// contract with HONEST telemetry (model id, real per-stage latency, real dimensions, real
// confidence, real word count). No third-party Vision API, no API key, $0 per request.
import { NextResponse } from "next/server";
import { classify, MODEL_ID } from "@/lib/vision/classify";
import { ocr, isOcrWarming, isOcrLoaded } from "@/lib/vision/ocr";
import { palette, dimensions } from "@/lib/vision/palette";
import { isWarming, isLoaded } from "@/lib/vision/pipeline";
import type { AnalysisResult } from "@/lib/types";

// onnxruntime + tesseract need the Node runtime (NOT edge). Cold start loads an 84MB model
// + the OCR worker, so raise the cap. force-dynamic: never cache an inference response.
export const runtime = "nodejs";
export const maxDuration = 60; // Hobby allows up to 60s; cold start needs headroom
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024; // ~4MB — under Vercel's request-body limit (PLAN §13)

export async function POST(req: Request) {
  const t0 = performance.now();

  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Send an image." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image too large (max 4MB)." },
      { status: 413 },
    );
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  // Honest cold-start flag: true if EITHER model still needs its first load this instance.
  const coldStart =
    isWarming() || !isLoaded() || isOcrWarming() || !isOcrLoaded();

  try {
    // Dimensions are needed first + cheap; classify and OCR are independent → run in
    // parallel; palette is cheap CPU and rides along. OCR is wrapped so a worker hiccup
    // degrades to an honest "no text" result instead of failing the whole analysis —
    // classification + palette are the load-bearing outputs.
    const dims = await dimensions(bytes);
    const [cls, read, pal] = await Promise.all([
      classify(bytes),
      ocr(bytes).catch((err) => {
        console.error("[analyze] ocr failed (continuing without text):", err);
        return { text: "", words: [], ms: 0 };
      }),
      palette(bytes),
    ]);

    const result: AnalysisResult = {
      dimensions: dims,
      labels: cls.labels,
      text: read.text,
      words: read.words,
      palette: pal,
      telemetry: {
        model: MODEL_ID,
        classifyMs: cls.ms,
        ocrMs: read.ms,
        width: dims.width,
        height: dims.height,
        topConfidence: cls.labels[0]?.score ?? 0,
        wordCount: read.words.length,
        totalMs: Math.round(performance.now() - t0),
        backend: "server · onnx + tesseract · no-api",
        coldStart,
      },
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[analyze] failed:", err);
    return NextResponse.json(
      { error: "The engine couldn't read that image — try another." },
      { status: 500 },
    );
  }
}
