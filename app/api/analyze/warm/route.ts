// app/api/analyze/warm/route.ts — warm-up route (PLAN §4.5 note / §7)
//
// The client pings this on first paint so BOTH engines (the ONNX classifier and the
// Tesseract worker) load while the user is still choosing an image. Turns the one real
// weakness — cold start — into honest "warming the engine" theater instead of a surprise
// delay on the first analysis. The /api/analyze/warm trace key in next.config.ts ships
// the same model + native libs to this lambda.
import { NextResponse } from "next/server";
import { getClassifier, MODEL_ID, isLoaded } from "@/lib/vision/pipeline";
import { getWorker, isOcrLoaded } from "@/lib/vision/ocr";

export const runtime = "nodejs";
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET() {
  const alreadyWarm = isLoaded() && isOcrLoaded();
  try {
    // Load both in parallel; the classifier load dominates (~84MB weights).
    await Promise.all([getClassifier(), getWorker()]);
    return NextResponse.json({
      ready: true,
      model: MODEL_ID,
      wasWarm: alreadyWarm,
    });
  } catch (err) {
    console.error("[warm] engine load failed:", err);
    return NextResponse.json(
      { ready: false, error: "warm-up failed" },
      { status: 503 },
    );
  }
}
