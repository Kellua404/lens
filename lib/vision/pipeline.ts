// lib/vision/pipeline.ts — the classifier singleton (PLAN §4.1)
//
// Loads the ONNX vision transformer ONCE per warm Lambda instance and caches it on
// globalThis. Loading per request would re-read the weights from disk and blow the
// function timeout. This is the North Star dependency: no paid API, no API key — the
// model runs inside our own serverless function.
import {
  pipeline,
  env,
  type ImageClassificationPipeline,
} from "@huggingface/transformers";

// We vendor the model into ./models (PLAN §4.3) and forbid remote fetches in prod so a
// cold start never waits on the network. In dev we allow remote so the first run can
// populate ./models if it hasn't been vendored yet.
env.allowRemoteModels = process.env.NODE_ENV !== "production";
env.allowLocalModels = true;
env.localModelPath = process.cwd() + "/models"; // <repo>/models/<MODEL_ID>/...
// Vercel's filesystem is read-only except /tmp — point any runtime cache there.
env.cacheDir = "/tmp/transformers-cache";

// ViT-Base ImageNet-1k (1000 classes), ONNX-exported + Transformers.js-compatible
// (verified: config.json carries id2label, preprocessor_config.json present,
// onnx/model_quantized.onnx is ~84MB q8). Swappable via env.
export const MODEL_ID =
  process.env.MODEL_ID ?? "Xenova/vit-base-patch16-224";

// Cache across warm invocations (and across HMR in dev) on globalThis.
const g = globalThis as unknown as {
  __lensPipe?: Promise<ImageClassificationPipeline>;
  __lensColdLoad?: boolean; // true only while the very first load is in flight
};

export function getClassifier(): Promise<ImageClassificationPipeline> {
  if (!g.__lensPipe) {
    g.__lensColdLoad = true;
    g.__lensPipe = pipeline("image-classification", MODEL_ID, {
      // q8 = 8-bit quantized weights (onnx/model_quantized.onnx) → smaller bundle +
      // faster CPU inference on Lambda.
      dtype: "q8",
    }).then((p) => {
      g.__lensColdLoad = false;
      return p as ImageClassificationPipeline;
    }) as Promise<ImageClassificationPipeline>;
  }
  return g.__lensPipe;
}

// True only until the first load resolves — lets the route report an honest coldStart.
export function isWarming(): boolean {
  return g.__lensColdLoad === true;
}

// Has the pipeline finished loading at least once? (Distinguishes "never touched" /
// "still warming" from "warm and ready".)
export function isLoaded(): boolean {
  return Boolean(g.__lensPipe) && g.__lensColdLoad !== true;
}
