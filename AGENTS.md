<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Lens — agent notes

- **The size budget is sacred.** `/api/analyze` must stay under Vercel's 250 MB unzipped
  limit. Never glob `onnxruntime-node/bin/**/linux/x64/*` (GPU-provider trap). The recipe
  lives in `next.config.ts` + `.npmrc` — read PLAN §0.5 / §4.4 before touching either.
- **Everything is real.** No faked labels, boxes, or telemetry. The model + OCR + palette
  run inside our own serverless function ($0, no Vision API, no key) and the readout proves
  it. If a value can't be measured honestly, don't show it.
- **transformers.js v4 gotcha:** the option is `top_k` (snake_case). `topk` silently
  returns only one label.
- **OCR on Vercel:** `cachePath` MUST be `/tmp` (read-only FS elsewhere); `eng.traineddata.gz`
  is vendored in `./tessdata`; one shared worker on `globalThis`. See `lib/vision/ocr.ts`.
