// app/api/analyze/warm/route.ts — warm-up route (PLAN §4.5 note / §7)
//
// The client pings this on first paint so BOTH engines (the ONNX classifier and the
// Tesseract worker) load while the user is still choosing an image. Turns the one real
// weakness — cold start — into honest "warming the engine" theater instead of a surprise
// delay on the first analysis. The /api/analyze/warm trace key in next.config.ts ships
// the same model + native libs to this lambda.
//
// DIAGNOSTIC MODE: each engine is loaded under its own timeout race so neither can hang
// the lambda silently. The response reports per-engine timing/errors so we can see on a
// live deploy which engine misbehaves (the OCR worker is the documented landmine, §5).
import { NextResponse } from "next/server";
import { getClassifier, MODEL_ID } from "@/lib/vision/pipeline";
import { getWorker } from "@/lib/vision/ocr";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function timed<T>(
  name: string,
  p: Promise<T>,
  ms: number,
): Promise<{ name: string; ok: boolean; ms: number; error?: string }> {
  const t0 = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      p,
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error(`timeout after ${ms}ms`)), ms);
      }),
    ]);
    return { name, ok: true, ms: Math.round(performance.now() - t0) };
  } catch (err) {
    return {
      name,
      ok: false,
      ms: Math.round(performance.now() - t0),
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function GET() {
  const classify = await timed("classifier", getClassifier(), 45_000);
  console.log("[warm] classifier:", JSON.stringify(classify));
  const ocr = await timed("ocr-worker", getWorker(), 12_000);
  console.log("[warm] ocr-worker:", JSON.stringify(ocr));

  const ready = classify.ok && ocr.ok;
  return NextResponse.json(
    { ready, model: MODEL_ID, classify, ocr },
    { status: ready ? 200 : 207 },
  );
}
