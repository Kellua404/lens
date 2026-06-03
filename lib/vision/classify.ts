// lib/vision/classify.ts — run classification on an uploaded image (PLAN §4.2)
import { RawImage } from "@huggingface/transformers";
import { getClassifier, MODEL_ID } from "./pipeline";
import type { Label } from "@/lib/types";

// `bytes` = the uploaded image as a Uint8Array. transformers decodes it via RawImage and
// runs its own preprocessor (resize/normalize per preprocessor_config.json).
export async function classify(
  bytes: Uint8Array,
  topK = 5,
): Promise<{ labels: Label[]; ms: number }> {
  const t0 = performance.now();
  const classifier = await getClassifier();
  const image = await RawImage.fromBlob(new Blob([bytes as BlobPart]));
  // NOTE: transformers.js v4 uses `top_k` (snake_case). `topk` silently returns only the
  // single top label — a subtle trap that would make the ranked readout look broken.
  const out = (await classifier(image, { top_k: topK })) as Label[];
  return {
    labels: out.map((l) => ({
      // ImageNet labels often look like "tabby, tabby cat" — keep the first, cleanest name.
      label: l.label.split(",")[0].trim(),
      score: Number(l.score) || 0,
    })),
    ms: Math.round(performance.now() - t0),
  };
}

export { MODEL_ID };
