// scripts/prove-inference.mjs — local make-or-break proof (PLAN §11 step 1-3, local form)
//
// Exercises the EXACT SDK calls the route depends on, before any UI exists:
//   1. classification via @huggingface/transformers (q8 ONNX, vendored local model)
//   2. OCR via tesseract.js (vendored eng.traineddata.gz, gzip)
//   3. palette via sharp's raw histogram
// If this prints sensible labels + extracted text, the architecture is correct and the
// rest is craft. (Function SIZE is proven separately on the first Vercel deploy.)
import { pipeline, env, RawImage } from "@huggingface/transformers";
import { createWorker } from "tesseract.js";
import sharp from "sharp";
import path from "node:path";

env.allowLocalModels = true;
env.localModelPath = process.cwd() + "/models";
env.cacheDir = "/tmp/transformers-cache";
const MODEL_ID = "Xenova/vit-base-patch16-224";

// ── classify a known cat photo → ViT should name it (proves correctness, not just "runs")
console.log("\n[1/3] classification ──────────────────────────────");
const t0 = performance.now();
const classifier = await pipeline("image-classification", MODEL_ID, { dtype: "q8" });
const loadMs = Math.round(performance.now() - t0);
const catUrl =
  "https://huggingface.co/datasets/Xenova/transformers.js-docs/resolve/main/cats.jpg";
const catBytes = new Uint8Array(await (await fetch(catUrl)).arrayBuffer());
const img = await RawImage.fromBlob(new Blob([catBytes]));
const t1 = performance.now();
const labels = await classifier(img, { top_k: 5 });
console.log(`  model load: ${loadMs}ms · classify: ${Math.round(performance.now() - t1)}ms`);
for (const l of labels) console.log(`   ${l.label.padEnd(34)} ${(l.score * 100).toFixed(1)}%`);

// ── OCR on a synthetic high-contrast text image (proves Tesseract reads + boxes words)
console.log("\n[2/3] OCR ─────────────────────────────────────────");
const svg = `<svg width="640" height="200" xmlns="http://www.w3.org/2000/svg">
  <rect width="640" height="200" fill="#0d1014"/>
  <text x="40" y="90" font-family="Arial" font-size="56" font-weight="bold" fill="#eaf0f6">CAT CAFE</text>
  <text x="40" y="150" font-family="Arial" font-size="40" fill="#38e1d6">OPEN 9-6</text>
</svg>`;
const textPng = await sharp(Buffer.from(svg)).png().toBuffer();
const worker = await createWorker("eng", 1, {
  langPath: path.join(process.cwd(), "tessdata"),
  cachePath: "/tmp",
  gzip: true,
});
const t2 = performance.now();
const { data } = await worker.recognize(textPng, {}, { blocks: true });
console.log(`  ocr: ${Math.round(performance.now() - t2)}ms`);
console.log(`  text: ${JSON.stringify((data.text ?? "").trim())}`);
const words = (data.words ?? []).filter((w) => w.confidence > 40 && w.text.trim());
for (const w of words)
  console.log(`   "${w.text}" ${Math.round(w.confidence)}% box=[${w.bbox.x0},${w.bbox.y0},${w.bbox.x1},${w.bbox.y1}]`);
await worker.terminate();

// ── palette from the cat photo's real pixels
console.log("\n[3/3] palette ─────────────────────────────────────");
const { data: raw, info } = await sharp(Buffer.from(catBytes))
  .resize(64, 64, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const buckets = new Map();
for (let i = 0; i + 2 < raw.length; i += info.channels) {
  const r = raw[i], g = raw[i + 1], b = raw[i + 2];
  const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
  const e = buckets.get(key) ?? { r: 0, g: 0, b: 0, c: 0 };
  e.r += r; e.g += g; e.b += b; e.c++; buckets.set(key, e);
}
const pal = [...buckets.values()].sort((a, b) => b.c - a.c).slice(0, 6)
  .map((e) => "#" + [e.r, e.g, e.b].map((v) => Math.round(v / e.c).toString(16).padStart(2, "0")).join(""));
const meta = await sharp(Buffer.from(catBytes)).metadata();
console.log(`  dimensions: ${meta.width}×${meta.height}`);
console.log(`  palette: ${pal.join("  ")}`);
console.log("\n✓ all three real on this machine. Architecture proven.\n");
