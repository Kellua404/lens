// app/api/analyze/warm/route.ts — warm-up route (PLAN §4.5 note / §7)
//
// The client pings this on first paint so BOTH engines (the ONNX classifier and the
// Tesseract worker) load while the user is still choosing an image. Turns the one real
// weakness — cold start — into honest "warming the engine" theater instead of a surprise
// delay on the first analysis. The /api/analyze/warm trace key in next.config.ts ships the
// same model + native libs + (critically) the Tesseract worker's transitive deps so the
// worker can spawn — see the TESSERACT note in next.config.ts.
//
// Each engine loads under its own timeout race so a misbehaving engine degrades gracefully
// instead of pinning the lambda to its 60s ceiling, and we report per-engine timing.
import { NextResponse } from "next/server";
import { getClassifier, MODEL_ID } from "@/lib/vision/pipeline";
import { getWorker } from "@/lib/vision/ocr";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

async function timed<T>(name: string, p: Promise<T>, ms: number) {
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
  const ocr = await timed("ocr-worker", getWorker(), 15_000);
  if (!classify.ok || !ocr.ok) {
    console.error("[warm] engine load issue:", JSON.stringify({ classify, ocr }));
  }
  const ready = classify.ok && ocr.ok;
  return NextResponse.json(
    { ready, model: MODEL_ID, classify, ocr },
    { status: ready ? 200 : 207 },
  );
}
