// lib/vision/ocr.ts — Tesseract worker singleton + recognize (PLAN §5.1)
//
// OCR on Vercel is the second landmine (parallel to the onnxruntime size dance):
// Tesseract.js wants to download/cache its language data, but Vercel's FS is read-only
// except /tmp. The fixes, all here:
//   • VENDOR eng.traineddata.gz into ./tessdata and point langPath at it (no runtime
//     network fetch on cold start). gzip:true → it reads the .gz directly.
//   • cachePath MUST be /tmp (the only writable dir on Vercel).
//   • ONE shared worker cached on globalThis — creating a worker per request is slow.
//   • tesseract.js + tesseract.js-core + ./tessdata are traced into the function via
//     next.config.ts (they're loaded at runtime, not statically imported).
import { createWorker, type Worker } from "tesseract.js";
import path from "node:path";
import type { Word } from "@/lib/types";

const g = globalThis as unknown as {
  __lensOcr?: Promise<Worker>;
  __lensOcrCold?: boolean;
};

export function getWorker(): Promise<Worker> {
  if (!g.__lensOcr) {
    g.__lensOcrCold = true;
    g.__lensOcr = createWorker("eng", 1, {
      langPath: path.join(process.cwd(), "tessdata"), // eng.traineddata.gz (vendored)
      cachePath: "/tmp", // Vercel: only writable dir
      gzip: true, // we ship the .gz
      // corePath/workerPath resolve from node_modules; traced via next.config TESSERACT.
    }).then((w) => {
      g.__lensOcrCold = false;
      return w;
    });
  }
  return g.__lensOcr;
}

export function isOcrWarming(): boolean {
  return g.__lensOcrCold === true;
}
export function isOcrLoaded(): boolean {
  return Boolean(g.__lensOcr) && g.__lensOcrCold !== true;
}

export async function ocr(
  bytes: Uint8Array,
): Promise<{ text: string; words: Word[]; ms: number }> {
  const t0 = performance.now();
  const worker = await getWorker();
  // blocks:true makes the result include the hierarchical geometry tree (data.blocks).
  const { data } = await worker.recognize(
    Buffer.from(bytes),
    {},
    { blocks: true },
  );

  // tesseract.js v6 removed the flat `data.words`; per-word geometry now lives in the
  // block tree: blocks[] → paragraphs[] → lines[] → words[], each with {text, confidence,
  // bbox:{x0,y0,x1,y1}} in image px. Flatten it.
  const rawWords = (data.blocks ?? []).flatMap((b) =>
    (b.paragraphs ?? []).flatMap((p) =>
      (p.lines ?? []).flatMap((l) => l.words ?? []),
    ),
  );

  // Filter noise honestly. On textureless images Tesseract emits short fragments
  // ("45", ":", "j") at mid confidence — keep only tokens that are ≥60% confident, at
  // least 2 chars, and contain an alphanumeric. Then one corroboration rule: a SINGLE
  // surviving word that isn't strongly confident (<80%) is almost always noise (a lone
  // "45"@61 on a cat photo), so drop it — but keep a single high-confidence word like a
  // "STOP" sign. This favors precision: we never draw a box we don't believe.
  let words: Word[] = rawWords
    .filter(
      (w) =>
        w.confidence >= 60 &&
        w.text.trim().length >= 2 &&
        /[a-z0-9]/i.test(w.text),
    )
    .map((w) => ({
      text: w.text.trim(),
      confidence: Math.round(w.confidence),
      box: {
        x: w.bbox.x0,
        y: w.bbox.y0,
        w: w.bbox.x1 - w.bbox.x0,
        h: w.bbox.y1 - w.bbox.y0,
      },
    }));
  if (words.length === 1 && words[0].confidence < 80) words = [];

  // Honesty gate: Tesseract hallucinates low-confidence noise into `data.text` even on
  // images with no text. If nothing cleared the confidence filter, there is no legible
  // text — return "" so the UI shows the honest "no legible text" state rather than junk.
  const text = words.length > 0 ? (data.text ?? "").trim() : "";

  return {
    text,
    words,
    ms: Math.round(performance.now() - t0),
  };
}
