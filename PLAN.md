# Lens — Build Plan (A→Z)

> The *how*. Read with `PRODUCT.md` (the *soul*) and the Phase-2 section of the root
> `PORTFOLIO_PLAN.md`. When a decision isn't covered here, decide in favor of `PRODUCT.md`.
> Reference-code blocks are marked **"reference — adapt"**: they exist so a build session
> never has to *guess* the hard parts. Adapt names/styling freely; keep the architecture.
>
> **Portfolio context:** B3, the 3rd and final backend project — computer vision. B1
> Resonance proved "real NLP model server-side." B2 Conveyor proved "distributed systems."
> Lens proves **vision** (classification + OCR, self-hosted, $0). Different domain,
> different look (§3). The Aurora method is the *bar*, not a template — Lens earns its own
> identity.
>
> **⚠️ READ THIS FIRST — the one thing that can sink this project.** Lens runs real models
> inside a Vercel serverless function, which has a **hard 250 MB unzipped size limit**.
> Resonance (B1) nearly died on exactly this. §0.5 + §4 + §13 tell you precisely how to
> stay under it. **Do §11 step 1 (prove inference + check function size on a live deploy)
> before building any UI.** If you skip that, you will waste a day. This plan reuses
> Resonance's production-proven `next.config.ts` / `.npmrc` / model-vendoring recipe
> verbatim — do not reinvent it.

---

## §0 — North Star + the feeling to protect

**North Star:** *Real vision models — an ONNX image classifier and a Tesseract OCR engine —
run inside our own Vercel serverless function, with no third-party Vision API and no API
key, and their output is drawn directly onto the image so you can see exactly what the
machine perceived.*

**Two feelings to protect (every tradeoff serves these):**
1. **"There's a real model running, on their server, for free."** Honest telemetry; results
   drawn on the specimen; no faked labels/boxes. A CV engineer must trust it on sight.
2. **"It's calm and forensic."** One slow scan, results that settle into place under good
   light. Examining a specimen, not an "AI magic" fireworks show.

If a choice makes it feel faked, or frantic/flashy, it's the wrong choice.

---

## §0.5 — THE SIZE BUDGET (non-negotiable; the reason the user paused before this project)

Vercel Hobby serverless functions must be **< 250 MB unzipped**. Resonance landed at
~183 MB (a 122 MB model + 34 MB onnxruntime CPU + 16 MB sharp + 8 MB transformers). Lens's
pieces are *smaller*, so it fits with MORE headroom — **only if** you keep these rules:

| Piece | Budget | Rule |
| ----- | ------ | ---- |
| Image classifier (small q8 ONNX) | ~10–45 MB | **Small model only.** No captioning (BLIP/GIT), no CLIP-large (400 MB–1 GB → instant fail). |
| Tesseract OCR (core wasm + `eng.traineddata.gz`) | ~10–15 MB | Vendor the `.gz`; ship `tesseract.js-core`. |
| onnxruntime-node CPU + `@huggingface/transformers` | ~42 MB | Same as Resonance. |
| `sharp` + `@img` linux libs | ~16 MB | **Genuinely used here** (decode/resize/palette) — and transformers imports it anyway. |
| Vendored model + tessdata in repo | counts toward the function | Traced in via `outputFileTracingIncludes`. |
| **Estimated function total** | **~90–130 MB** | Comfortably under 250 — more headroom than Resonance. |

**Three rules, no exceptions:**
1. **Pick the model by size budget first** (§4.0). Verify a `q8` ONNX export exists.
2. **Reuse Resonance's exact tracing recipe** (§4.4) — include the 2 CPU onnxruntime files
   *by name*, never glob `linux/x64/*`; exclude all `*providers*` (GPU) libs.
3. **Verify function size on deploy #1** with `VERCEL_ANALYZE_BUILD_OUTPUT=1` (§11 step 1),
   before any UI exists.

**Documented escape hatch (don't use unless forced):** if a model you truly need is too big,
move *only the inference* to a free **Hugging Face Space** and let Vercel host the UI + call
it. Keeps $0; costs you a second host + cold-start hop. v1 should not need this.

---

## §1 — Goal & scope

**In scope (v1):**
- Upload **one image** (drop / pick / paste; cap ~4 MB — see §13 body-size note).
- Server-side **classification** (top-k labels + confidence) via a small ONNX vision model.
- Server-side **OCR** (extracted text + per-word boxes + confidence) via Tesseract.
- **Palette** (dominant colors) quantized from the real pixels.
- Results drawn **on the image**: a single scan sweep, OCR word-boxes overlaid, a ranked
  classification readout, a palette strip.
- Honest **telemetry**: model id, classify ms, OCR ms, dimensions, top-1 confidence, words.
- Real output: a **shareable analysis card** (image + readout) — downloadable PNG +
  permalink + results JSON (+ copy extracted text / copy palette).

**Out of scope (v1):** accounts/history, object detection, face recognition (privacy),
captioning / CLIP-large, video, multi-language OCR (English only), batch upload, any paid
API. See §15 for stretch.

---

## §2 — Tech stack (with reasons)

| Choice | Why |
| ------ | --- |
| **Next.js 16 (App Router), TypeScript** | API Route Handlers = our serverless backend on Vercel; one repo, one deploy. (Resonance uses `next@16`, `react@19` — match it; read `node_modules/next/dist/docs/` for the current API, per Resonance's `AGENTS.md`.) |
| **`@huggingface/transformers` `^4.2`** | Runs the ONNX **image-classification** pipeline server-side, CPU, `dtype:'q8'`. No API key. **Note:** v4 uses `top_k` (snake_case); `topk` silently returns only one label. |
| **`onnxruntime-node`** (transitive, but pin/treat as external) | The native inference runtime. Source of the 250 MB GPU-lib trap — handled in §4.4 + `.npmrc`. |
| **`tesseract.js` `^6` + `tesseract.js-core`** | Server-side OCR (WASM) in the Node function. The read-only-FS gotcha is handled in §5. |
| **`sharp`** | Decode/normalize the upload + downscale for palette. Genuinely used (not dead weight like in Resonance). transformers also imports it. |
| **Zustand** | Tiny client store for the analysis result + UI state. |
| **Framer Motion** | The scan sweep + the settle-in of results. |
| **Tailwind CSS v4** | Control-surface styling with the §3 tokens. |
| **lucide-react** | Crisp technical icons (scan, type, palette, download). |
| **Fonts: Schibsted Grotesk + DM Mono** | Optical grotesque + lab-readout mono. New pairing — distinct from the other three projects. Load via `next/font/google`. |

> **No paid services.** Models run in our function ($0). The "server-side, no Vision API,
> no key, $0" fact is surfaced in the UI as the flex.

---

## §3 — Design language

**Mood:** forensic light table / darkroom optical bench (see `PRODUCT.md`). Cool, precise,
calm.

**Color tokens** (dark darkroom base; one optical-cyan signal; palette comes from the image):
```
--bg:        #07090c   /* near-black darkroom */
--surface:   #0d1014   /* light-table panel */
--surface-2: #14181e   /* card / readout */
--line:      #20262f   /* hairline grid + borders */
--text:      #eaf0f6   /* primary */
--text-dim:  #828d9b   /* labels, secondary */
--scan:      #38e1d6   /* OPTICAL CYAN — scan line + active accent */
--ok:        #4cc38a   /* high-confidence / success */
--warn:      #e6b450   /* low-confidence hint */
--err:       #e5675b   /* error */
/* OCR word-box: --scan @ ~18% fill, --scan solid hairline stroke */
```
**Type scale:** Schibsted Grotesk for display/UI (wordmark 700, tight tracking; headings
600). DM Mono for *all* numbers, IDs, confidence %, dimensions, latencies. Readouts should
feel like instrument output.

**Layout (desktop, single screen):**
```
┌──────────────────────────────────────────────────────────────────┐
│  LENS  ▸ optical analysis            [server · onnx + tesseract · $0]│ header + env proof
├───────────────────────────────────┬──────────────────────────────┤
│  LIGHT TABLE                       │  READOUT                      │
│  ┌─────────────────────────────┐   │  CLASSIFY                     │
│  │  [ the image ]              │   │   tabby cat        0.91 ▓▓▓▓▓ │  ranked top-k
│  │   ┌──┐ OCR boxes drawn over │   │   tiger cat        0.04 ▓     │
│  │   └──┘ detected words       │   │  READ                         │
│  │   ░ scan line sweeps once ░ │   │   "CAT CAFE  OPEN 9–6"  (copy)│  extracted text
│  └─────────────────────────────┘   │  PALETTE                      │
│  drop · paste · pick               │   ▆▆▆▆▆▆  (6 swatches, copy)  │
├───────────────────────────────────┴──────────────────────────────┤
│  TELEMETRY  model … · classify 180ms · ocr 240ms · 1024×768 · 7 words │ mono readout
└──────────────────────────────────────────────────────────────────┘
```
Mobile: light table on top (full width), readout stacks below, telemetry last.

**Motion law:** on analyze, the **scan line** (cyan) sweeps top→bottom once (~700ms). As it
passes, OCR boxes fade in *in place* and the readout values tween up. Nothing strobes.
`prefers-reduced-motion` → no sweep; results cross-fade in. (§12 details.)

---

## §4 — THE HARD PART, as reference code (Vercel-safe server-side vision inference)

> This is what a weaker model gets wrong: model choice/size, the `globalThis` singleton,
> `transformers` `env` setup, the model-vendoring script, and **the `next.config.ts`
> tracing recipe that keeps the function under 250 MB**. Written near-verbatim, adapted
> from Resonance's production code. **Reference — adapt.**

### §4.0 — Choose the model (do this first, by size)
Pick a **small image-classification model** with a `q8` ONNX export and a
`preprocessor_config.json`. Candidates (verify on HF Hub before committing — confirm the
repo actually ships `onnx/model_quantized.onnx`, exactly like Resonance's "confirm the
model id" note):
- **`Xenova/vit-base-patch16-224`** — ImageNet-1k (1000 classes), recognizable labels,
  q8 ≈ 22 MB. **Recommended default** (good accuracy/size balance).
- **`Xenova/mobilenet_v2_1.0_224`** — tiny (q8 ≈ 5–10 MB), lower accuracy. Size fallback.
- **`Xenova/resnet-50`** — solid, q8 ≈ 25–30 MB.
> Whichever you pick: update `FILES` in `scripts/fetch-model.mjs` (§4.3) and the label
> handling. ImageNet labels come from the model `config.json` (`id2label`) — no separate
> vocab needed. **Do NOT** pick captioning/CLIP-large (§0.5).

### §4.1 — `lib/vision/pipeline.ts` — the classifier singleton (adapted from Resonance)
```ts
// Loads the ONNX vision model ONCE per warm Lambda and caches on globalThis. Loading per
// request would re-read weights from disk and blow the timeout. North Star dependency:
// no paid API — the model runs inside our own serverless function.
import { pipeline, env, type ImageClassificationPipeline } from "@huggingface/transformers";

// Vendor the model into ./models (§4.3); forbid remote fetches in prod so a cold start
// never waits on the network. Allow remote in dev to populate ./models on first run.
env.allowRemoteModels = process.env.NODE_ENV !== "production";
env.allowLocalModels = true;
env.localModelPath = process.cwd() + "/models";        // <repo>/models/<MODEL_ID>/...
env.cacheDir = "/tmp/transformers-cache";              // Vercel FS is read-only except /tmp

export const MODEL_ID = process.env.MODEL_ID ?? "Xenova/vit-base-patch16-224";

const g = globalThis as unknown as {
  __lensPipe?: Promise<ImageClassificationPipeline>;
  __lensColdLoad?: boolean;
};

export function getClassifier(): Promise<ImageClassificationPipeline> {
  if (!g.__lensPipe) {
    g.__lensColdLoad = true;
    g.__lensPipe = pipeline("image-classification", MODEL_ID, { dtype: "q8" }) // q8 → model_quantized.onnx
      .then((p) => { g.__lensColdLoad = false; return p as ImageClassificationPipeline; });
  }
  return g.__lensPipe;
}
export const isWarming = () => g.__lensColdLoad === true;
export const isLoaded = () => Boolean(g.__lensPipe) && g.__lensColdLoad !== true;
```

### §4.2 — `lib/vision/classify.ts` — run classification on an uploaded image
```ts
import { RawImage } from "@huggingface/transformers";
import { getClassifier, MODEL_ID } from "./pipeline";

export type Label = { label: string; score: number };

// `bytes` = the uploaded image as a Buffer/Uint8Array (decoded by transformers' processor).
export async function classify(bytes: Uint8Array, topK = 5): Promise<{ labels: Label[]; ms: number }> {
  const t0 = performance.now();
  const classifier = await getClassifier();
  const image = await RawImage.fromBlob(new Blob([bytes]));   // decode → RawImage
  const out = (await classifier(image, { top_k: topK })) as Label[]; // v4: top_k (snake_case!)
  return { labels: out.map((l) => ({ label: l.label, score: Number(l.score) || 0 })),
           ms: Math.round(performance.now() - t0) };
}
export { MODEL_ID };
```

### §4.3 — `scripts/fetch-model.mjs` — vendor the model (adapt Resonance's script)
Copy `resonance/scripts/fetch-model.mjs` verbatim and change only `MODEL_ID` + the `FILES`
list. **Vision models need different files than NLP** (no tokenizer/vocab; yes a
preprocessor config):
```js
const MODEL_ID = process.env.MODEL_ID ?? "Xenova/vit-base-patch16-224";
const FILES = [
  { rel: "config.json", minBytes: 100 },                 // contains id2label (the class names)
  { rel: "preprocessor_config.json", minBytes: 50 },     // image processor (resize/normalize)
  { rel: "onnx/model_quantized.onnx", minBytes: 5_000_000 }, // q8 weights; floor ~5MB (set per chosen model)
];
```
Wire it into `package.json` exactly like Resonance:
```json
"scripts": { "fetch-model": "node scripts/fetch-model.mjs",
             "build": "node scripts/fetch-model.mjs && next build" }
```

### §4.4 — `next.config.ts` — THE SIZE RECIPE (copy from Resonance, add Tesseract)
> This is the file that keeps the function under 250 MB. Copy `resonance/next.config.ts`
> and extend the route name + add the Tesseract packages. **Never glob `linux/x64/*`** in
> the includes — that's the GPU-lib trap that nearly killed Resonance.
```ts
import type { NextConfig } from "next";

const ONNX_CPU = [
  "./node_modules/onnxruntime-node/bin/**/linux/x64/libonnxruntime.so.1",
  "./node_modules/onnxruntime-node/bin/**/linux/x64/onnxruntime_binding.node",
];
const SHARP = ["./node_modules/sharp/**", "./node_modules/@img/**"];
const TESSERACT = ["./node_modules/tesseract.js/**", "./node_modules/tesseract.js-core/**", "./tessdata/**"];
const ONNX_EXCLUDE = [
  "./node_modules/onnxruntime-node/bin/**/darwin/**",
  "./node_modules/onnxruntime-node/bin/**/win32/**",
  "./node_modules/onnxruntime-node/bin/**/linux/arm64/**",
  "./node_modules/onnxruntime-node/bin/**/*providers*",   // CUDA/TensorRT GPU libs — Vercel has no GPU
];

const nextConfig: NextConfig = {
  // Don't bundle the native inference libs; let Node require them at runtime.
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "tesseract.js", "sharp"],

  // Ship the model, the onnxruntime CPU native libs (loaded via dlopen — tracer can't see
  // them), sharp's native libs, and Tesseract's wasm core + the vendored traineddata.
  outputFileTracingIncludes: {
    "/api/analyze": ["./models/**/*", ...ONNX_CPU, ...SHARP, ...TESSERACT],
  },
  // Drop non-linux onnxruntime + the GPU provider libs (belt-and-suspenders guard).
  outputFileTracingExcludes: {
    "/api/analyze": [...ONNX_EXCLUDE],
  },
};
export default nextConfig;
```
Plus **`.npmrc`** (copy Resonance's verbatim) so onnxruntime's postinstall never downloads
the CUDA/TensorRT libs:
```
onnxruntime-node-install=skip
```

### §4.5 — `app/api/analyze/route.ts` — the route (orchestrates classify + OCR + palette)
```ts
import { NextResponse } from "next/server";
import { classify, MODEL_ID } from "@/lib/vision/classify";
import { ocr } from "@/lib/vision/ocr";        // §5.1
import { palette, dimensions } from "@/lib/vision/palette"; // §5.2
import { isWarming, isLoaded } from "@/lib/vision/pipeline";

export const runtime = "nodejs";       // onnxruntime + tesseract need Node, NOT edge
export const maxDuration = 60;         // cold start + 2 models needs headroom
export const dynamic = "force-dynamic";

const MAX_BYTES = 4 * 1024 * 1024;     // ~4MB — Vercel request-body limit (§13)

export async function POST(req: Request) {
  const t0 = performance.now();
  const form = await req.formData().catch(() => null);
  const file = form?.get("image");
  if (!(file instanceof Blob)) return NextResponse.json({ error: "Send an image." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Image too large (max 4MB)." }, { status: 413 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const coldStart = isWarming() || !isLoaded();

  try {
    const dims = await dimensions(bytes);
    // classify + OCR are independent → run in parallel; palette is cheap CPU.
    const [cls, read, pal] = await Promise.all([classify(bytes), ocr(bytes, dims), palette(bytes)]);

    return NextResponse.json({
      dimensions: dims,
      labels: cls.labels,
      text: read.text,
      words: read.words,                 // [{text, confidence, box:{x,y,w,h}}] in image px
      palette: pal,                      // ["#rrggbb", ...]
      telemetry: {
        model: MODEL_ID,
        classifyMs: cls.ms, ocrMs: read.ms,
        width: dims.width, height: dims.height,
        topConfidence: cls.labels[0]?.score ?? 0,
        wordCount: read.words.length,
        totalMs: Math.round(performance.now() - t0),
        backend: "server · onnx + tesseract · no-api",
        coldStart,
      },
    });
  } catch (err) {
    console.error("[analyze] failed:", err);
    return NextResponse.json({ error: "The engine couldn't read that image — try another." }, { status: 500 });
  }
}
```
> Also add a **warm-up route** `app/api/analyze/warm/route.ts` (mirror Resonance) that
> triggers `getClassifier()` + warms the OCR worker and returns `{ ready: true }`, plus the
> same trace-includes key for `/api/analyze/warm` in `next.config.ts`. The client pings it
> on load so the first real analysis is warm.

---

## §5 — Second hard system, as reference code (OCR-on-Vercel + palette)

> **OCR on Vercel is the second landmine** (parallel to Resonance's onnxruntime dance):
> Tesseract.js wants to download/cache the language data, but Vercel's filesystem is
> **read-only except `/tmp`**. Fix: **vendor `eng.traineddata.gz` into `./tessdata`**, point
> `langPath` at it, set `cachePath:'/tmp'`, cache a worker on `globalThis`. **Reference — adapt.**

### §5.1 — `lib/vision/ocr.ts` — Tesseract worker singleton + recognize
```ts
import { createWorker, type Worker } from "tesseract.js";
import path from "node:path";

const g = globalThis as unknown as { __lensOcr?: Promise<Worker> };

function getWorker(): Promise<Worker> {
  if (!g.__lensOcr) {
    g.__lensOcr = createWorker("eng", 1, {
      langPath: path.join(process.cwd(), "tessdata"), // contains eng.traineddata.gz (vendored, §10)
      cachePath: "/tmp",                              // Vercel: only writable dir
      gzip: true,                                     // we ship the .gz
      // corePath/workerPath resolve from node_modules; traced via next.config TESSERACT
    });
  }
  return g.__lensOcr;
}

export type Word = { text: string; confidence: number; box: { x: number; y: number; w: number; h: number } };

export async function ocr(bytes: Uint8Array, dims: { width: number; height: number }):
  Promise<{ text: string; words: Word[]; ms: number }> {
  const t0 = performance.now();
  const worker = await getWorker();
  const { data } = await worker.recognize(Buffer.from(bytes), {}, { blocks: true });
  // Filter low-confidence noise; map bbox (image px) → our box shape.
  const words: Word[] = (data.words ?? [])
    .filter((w) => w.confidence > 40 && w.text.trim())
    .map((w) => ({ text: w.text, confidence: Math.round(w.confidence),
      box: { x: w.bbox.x0, y: w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0 } }));
  return { text: (data.text ?? "").trim(), words, ms: Math.round(performance.now() - t0) };
}
```
> **Gotchas to respect (write into README):** (1) vendor `eng.traineddata.gz` — do NOT rely
> on runtime download (read-only FS + cold-start latency). (2) `cachePath` MUST be `/tmp`.
> (3) ensure `tesseract.js`, `tesseract.js-core`, and `./tessdata` are traced (§4.4).
> (4) one shared worker on `globalThis` — creating a worker per request is slow.
> **Fallback if the server worker fights Vercel:** run Tesseract **client-side** (browser
> WASM) and keep classification server-side — documented escape hatch, costs the "OCR is
> backend too" point. Try server-side first (§11 step 2 proves it).

### §5.2 — `lib/vision/palette.ts` — dominant colors from real pixels (sharp, $0)
```ts
import sharp from "sharp";

export async function dimensions(bytes: Uint8Array) {
  const m = await sharp(Buffer.from(bytes)).metadata();
  return { width: m.width ?? 0, height: m.height ?? 0 };
}

// Downscale to 64×64, read raw RGB, bucket into a coarse 3-bit-per-channel histogram,
// return the top N buckets as hex. Simple, fast, deterministic — no model, no deps.
export async function palette(bytes: Uint8Array, n = 6): Promise<string[]> {
  const { data, info } = await sharp(Buffer.from(bytes))
    .resize(64, 64, { fit: "inside" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const buckets = new Map<number, { r: number; g: number; b: number; c: number }>();
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = (r >> 5 << 6) | (g >> 5 << 3) | (b >> 5);   // 3 bits/channel
    const e = buckets.get(key) ?? { r: 0, g: 0, b: 0, c: 0 };
    e.r += r; e.g += g; e.b += b; e.c++; buckets.set(key, e);
  }
  return [...buckets.values()].sort((a, b) => b.c - a.c).slice(0, n)
    .map((e) => "#" + [e.r, e.g, e.b].map((v) => Math.round(v / e.c).toString(16).padStart(2, "0")).join(""));
}
```

### §5.3 — drawing OCR boxes on the image (client)
The image renders at a displayed size that differs from its natural px. Store the natural
`dimensions` from telemetry; render boxes in an absolutely-positioned overlay scaled by
`displayedWidth / naturalWidth`. Each box: `--scan` hairline stroke + ~18% fill, word text
in a tooltip on hover. Recompute scale on resize (ResizeObserver).

---

## §6 — Component breakdown

- `app/page.tsx` — the light table: `<Dropzone>`/`<LightTable>` + `<Readout>` + `<Telemetry>`, wired to the store.
- `app/run/[id]/page.tsx` *(optional permalink)* — re-render a saved analysis (see §8 / §15 for storage tradeoff).
- `LightTable` — holds the image + the **scan-line** overlay + the **OcrOverlay** boxes.
- `Dropzone` — drop / paste / file-pick; **client-side downscale** large images before upload (canvas → ≤ ~1600px, JPEG ~0.85) to stay under 4 MB and speed inference; preview instantly.
- `OcrOverlay` — absolutely-positioned word boxes scaled to displayed size (§5.3).
- `ScanLine` — the cyan sweep on analyze (Framer Motion); reduced-motion → none.
- `Readout` — three blocks: `Classify` (ranked top-k bars), `Read` (extracted text, copy button), `Palette` (swatch strip, click-to-copy hex).
- `Telemetry` — mono readout: model id, classify ms, ocr ms, dims, top-1 confidence, words, env-proof line.
- `AnalysisCard` — composited share card (image + readout) → download PNG (`html-to-image`) + copy permalink + download results JSON.
- `Wordmark` — "LENS" in Schibsted Grotesk 700 + a small aperture/loupe glyph.

---

## §7 — State / data model + key systems

- **Server contract** (the `/api/analyze` JSON in §4.5): `dimensions`, `labels[]`, `text`,
  `words[]` (box in natural px), `palette[]`, `telemetry`. Put this type in `lib/types.ts`.
- **Client store (`store/useLens.ts`, Zustand):** `status` (`idle|uploading|analyzing|done|error`),
  `imageUrl` (object URL of the upload), `result` (the contract), `error`. One action
  `analyze(file)`: set preview → POST FormData → set result/error. UI is a pure function of this.
- **Warm-up:** ping `/api/analyze/warm` on mount so the first analysis is warm (honest
  `coldStart` flag still reported).

---

## §8 — The "real output" system

1. **Analysis card PNG** — `<AnalysisCard>` node → `html-to-image` `toPng` → download. The
   image + top labels + extracted text + palette + telemetry. A keepable artifact.
2. **Copy** — copy extracted text; click a swatch to copy its hex.
3. **Results JSON** — download the full contract (labels, text+boxes, palette, telemetry) —
   proof the analysis was real and structured.
4. **Permalink** *(optional, see §15):* persisting requires storing the image — adds a blob
   store (Vercel Blob free tier) or skip and keep v1 stateless. Default v1: **no server
   storage**; share = the downloaded card. (Honest scope cut.)

---

## §9 — File / folder structure
```
lens/
  app/
    layout.tsx                       # fonts (Schibsted Grotesk + DM Mono), tokens, metadata
    page.tsx                         # the light table
    globals.css                      # §3 tokens
    api/
      analyze/route.ts               # §4.5 classify + ocr + palette
      analyze/warm/route.ts          # warm-up (mirror Resonance)
  lib/
    vision/
      pipeline.ts                    # §4.1 classifier singleton
      classify.ts                    # §4.2
      ocr.ts                         # §5.1 Tesseract worker + recognize
      palette.ts                     # §5.2 dimensions + palette
    types.ts                         # the server contract type
    downscale.ts                     # client-side image downscale helper
    exportCard.ts                    # html-to-image wrapper
  store/useLens.ts                   # §7
  components/
    LightTable.tsx  Dropzone.tsx  OcrOverlay.tsx  ScanLine.tsx
    Readout.tsx  Telemetry.tsx  AnalysisCard.tsx  Wordmark.tsx
  scripts/fetch-model.mjs            # §4.3 vendor the model
  models/                            # VENDORED model (gitignored; fetched at build)
  tessdata/                          # eng.traineddata.gz (VENDORED — committed or fetched, §10)
  next.config.ts                     # §4.4 the size recipe
  .npmrc                             # onnxruntime-node-install=skip
  .vercelignore                      # node_modules / .next / .git / models
  .gitignore                         # + /models  (do NOT gitignore /tessdata if committing it)
  package.json  tsconfig.json  postcss.config.mjs  README.md  AGENTS.md
```

---

## §10 — Setup commands
```bash
npx create-next-app@latest lens --ts --tailwind --app --eslint
cd lens
npm i @huggingface/transformers@^4.2 tesseract.js@^6 sharp zustand framer-motion lucide-react html-to-image

# .npmrc (stops onnxruntime's CUDA/TensorRT download — copy from resonance/.npmrc)
echo "onnxruntime-node-install=skip" > .npmrc

# Vendor the OCR language data into ./tessdata (commit it, OR fetch in the build script):
mkdir -p tessdata
curl -L -o tessdata/eng.traineddata.gz \
  https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_fast/eng.traineddata.gz   # ~4MB (fast variant)

# Vendor the vision model (idempotent; also runs on every build via package.json "build"):
node scripts/fetch-model.mjs

npm run dev
```
> **Fonts:** `next/font/google` → `Schibsted_Grotesk` + `DM_Mono`. **`AGENTS.md`:** copy
> Resonance's — "this is not the Next.js you know; read `node_modules/next/dist/docs/`
> before writing code."

---

## §11 — Build order with milestones

> **Prove inference + function size on a live Vercel deploy FIRST** — the risk is the size
> budget and the two native-runtime setups, not the pixels. Same discipline that saved
> Resonance.

1. **Skeleton + the size proof (THE make-or-break).** `create-next-app`; add `.npmrc`,
   `next.config.ts` (§4.4), `scripts/fetch-model.mjs` (§4.3), vendor `eng.traineddata.gz`.
   Build a minimal `/api/analyze` that ONLY runs `classify()` on a hardcoded test image and
   returns the top label. Push to GitHub (private) → import to Vercel → deploy with
   **`vercel deploy --prod --yes --build-env VERCEL_ANALYZE_BUILD_OUTPUT=1`** and read the
   per-function size from the build log. **Confirm `/api/analyze` < 250 MB. Do not proceed
   until a real classification returns from the live URL and the size is green.**
2. **Add OCR (the second landmine).** Wire `lib/vision/ocr.ts` (§5.1). Re-deploy; confirm
   real extracted text from the live function AND size still < 250 MB. If the server worker
   fights the read-only FS, switch OCR to the client-side fallback (§5.1 note) — but try
   server first.
3. **Add palette + dimensions** (§5.2) and the full `/api/analyze` contract (§4.5) + warm route.
4. **Client store + Dropzone** (drop/paste/pick + client downscale) — get an uploaded image
   analyzed end-to-end, log the JSON.
5. **Light table + image render + ScanLine** — the wow-core: drop an image, watch the scan.
6. **OcrOverlay** — draw the word boxes in place, scaled correctly (§5.3) on resize.
7. **Readout** — classify bars, extracted text + copy, palette swatches + copy.
8. **Telemetry** — the honest mono readout + env-proof line.
9. **Analysis card + JSON export** (§8).
10. **Polish:** motion law (§3/§12), reduced-motion, responsive, cold-start grace, error/empty states.
11. **A11y + perf pass** (§13, §14). **Definition of Done** (§17). **Deploy + close loop** (§18).

Milestones 1–2 are the whole project's risk. If classification **and** OCR both run on a
live deploy under 250 MB, the rest is craft.

---

## §12 — Interaction & motion spec

- **Drop/paste:** instant preview on the light table; a subtle "specimen seated" settle.
- **Analyze:** the cyan **scan line** sweeps top→bottom once (~700ms, ease-in-out). OCR
  boxes fade in *as the line passes their y*; readout numbers tween up (~250ms).
- **Confidence bars:** grow from 0 to score (~400ms). **Palette swatches:** stagger-in.
- **Copy:** quick check-flash on the copied text/swatch.
- **Reduced motion:** no scan sweep; everything cross-fades in; no tweening of numbers.

---

## §13 — Accessibility, fallback, robustness

- **THE REAL RISK = function size + the two native runtimes on Vercel.** Mitigations:
  small model (§4.0), the exact tracing recipe (§4.4), `.npmrc`, vendored model + tessdata,
  and the **size-check on deploy #1** (§11 step 1). Escape hatches: client-side OCR (§5.1),
  HF Space for inference (§0.5).
- **Request body limit:** Vercel serverless caps the request body (~4.5 MB). Cap uploads at
  4 MB AND downscale client-side before upload (§6). Return 413 with a clear message.
- **Cold start:** first analysis loads the model + OCR worker; warm route + an honest
  "warming the engine…" state. Never a fake progress bar.
- **A11y:** WCAG AA contrast on text/accents over the dark surface. Results are never
  color/box-only — extracted text is real copyable text; labels have names + numeric
  scores; palette swatches expose their hex as text. Full keyboard path (upload, copy,
  download) with visible focus. `aria-live="polite"` status ("analysis complete: tabby cat,
  7 words found"). Alt text on the uploaded image = the top label + "user-supplied image."
- **Privacy:** state plainly that the image is processed in-memory server-side and not
  stored (v1 is stateless) — reinforces the honest-backend brand.
- **Bad input:** non-image / corrupt / huge → graceful typed errors, never a stack trace.

---

## §14 — Performance targets

- Lighthouse ≥ 90 (perf/a11y/best-practices).
- Warm classify + OCR comfortably within `maxDuration` (60s); target sub-second warm
  classify, OCR a bit more. Run classify + OCR in parallel (§4.5).
- Client downscale keeps uploads small → faster POST + inference.
- OcrOverlay uses transform-based positioning; no layout thrash on resize (ResizeObserver +
  rAF). Image rendered with intrinsic size; no CLS.

---

## §15 — Stretch goals (captured, not blocking)

Permalink with image persistence (Vercel Blob free tier); a second model toggle (ViT vs
MobileNet, compare size/latency live — a great backend-literacy flex); multi-language OCR
(swap traineddata); zero-shot classification (`Xenova/clip-vit-base-patch16` — only if it
fits the budget); object detection (DETR/YOLO-ONNX — likely too big, note it); EXIF readout;
drag a URL instead of a file; a "what the model focused on" saliency/attention heat overlay;
batch / contact-sheet mode; bridge to Conveyor (run a batch of images through Conveyor's
queue, with Lens as the per-item worker).

---

## §16 — Ready-to-use copy

- **Wordmark:** `LENS`
- **Tagline (header):** `see what the machine sees`
- **Env proof line:** `server-side · onnx classifier + tesseract OCR · no Vision API · $0`
- **Dropzone empty state:** `Drop an image on the table — or paste / pick one.`
- **Readout labels:** `CLASSIFY` `READ` `PALETTE`
- **Telemetry labels:** `MODEL` `CLASSIFY` `OCR` `DIMENSIONS` `CONFIDENCE` `WORDS`
- **Warming state:** `Cold start — warming the vision engine…`
- **No text found:** `No legible text in this image.`
- **Privacy line (footer):** `Processed in-memory on our server. Nothing is stored.`
- **About blurb (footer/modal):** `Every analysis runs inside this Vercel function: a real
  ONNX vision transformer names the image, Tesseract reads its text, and the palette is
  quantized straight from the pixels — no Google/AWS Vision API, no API key, $0. The readout
  is the proof.`

---

## §17 — Definition of Done

- [ ] On the **live Vercel URL**, uploading an image returns real **classification** +
      **OCR text** + **palette** from the server function.
- [ ] `/api/analyze` function is **< 250 MB** (confirmed via `VERCEL_ANALYZE_BUILD_OUTPUT=1`).
- [ ] Classification labels are sensible + ranked with real confidence; OCR boxes land on
      the right words; palette matches the image.
- [ ] Telemetry is honest + live: model id, classify ms, OCR ms, dimensions, confidence, words.
- [ ] Scan sweep + result settle feel calm; OCR boxes scale correctly on resize.
- [ ] Analysis card PNG downloads; results JSON downloads; copy text / copy hex work.
- [ ] Body-size cap + client downscale enforced (413 on oversize); cold-start state honest.
- [ ] AA contrast, keyboard-complete, `prefers-reduced-motion` honored, responsive, privacy stated.
- [ ] Lighthouse ≥ 90. No console errors. README documents the size recipe + OCR/tessdata
      gotcha + `.env`/model notes. `.npmrc` + `next.config.ts` match the recipe.
- [ ] Reads as **real + calm + forensic** — the two feelings in §0.

---

## §18 — Deploy + close the loop

1. `git init`, commit. Confirm `.gitignore` excludes `/models`, `.next`, `node_modules`,
   `.env*`. Decide tessdata: **commit `./tessdata/eng.traineddata.gz`** (small, simplest) OR
   fetch it in the build script — either way it must be present at build. **Audit for
   secrets** before pushing (github-push-rules: nothing sensitive; there are no API keys
   here by design).
2. Create **private** repo `github.com/Kellua404/lens` (default private), push.
3. Import to **Vercel**. Env: `MODEL_ID` (optional override). No secret keys needed (the
   whole point). Ensure the build runs `node scripts/fetch-model.mjs && next build`.
4. Deploy with `--build-env VERCEL_ANALYZE_BUILD_OUTPUT=1`; **confirm `/api/analyze` < 250 MB**.
   Smoke-test the live URL: upload a photo with text → expect labels + extracted text + palette.
5. Update root `PORTFOLIO_PLAN.md`: mark **Lens ✅ Done** with repo + live URL. Phase 2 done.
6. Add Lens's live URL to the portfolio hub site when it's built.

> **Build-session note:** before relying on any SDK signature in §4–§5, confirm the current
> `@huggingface/transformers` (v4: `top_k` snake_case; `RawImage.fromBlob`) and
> `tesseract.js` (v6 worker options) APIs against the installed versions — and confirm the
> chosen model actually ships `onnx/model_quantized.onnx`. The *architecture* here is
> correct and size-safe; verify exact method names/files like Resonance's "confirm the
> model id" note.
