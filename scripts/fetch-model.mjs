// scripts/fetch-model.mjs — vendor the ONNX vision model into ./models (PLAN §4.3)
//
// Downloads exactly the files Transformers.js needs into the localModelPath layout
//   models/<MODEL_ID>/{config.json, preprocessor_config.json}
//   models/<MODEL_ID>/onnx/model_quantized.onnx
// so production cold-starts never wait on a network download. Vision models need a
// DIFFERENT file set than NLP: no tokenizer/vocab, but a preprocessor_config (the image
// resize/normalize spec) and config.json (which carries id2label — the class names).
//
// Idempotent + robust (runs on every `npm run build`):
//   • SKIP a file when a complete local copy already exists (size ≥ floor and, when the
//     remote size is knowable, matches it) — returning to the project never re-downloads
//     the ~84MB weight file.
//   • DOWNLOAD only what's MISSING with a plain GET (HF's HEAD doesn't reliably return
//     Content-Length, so we never gate a download on it — that would wrongly fail a fresh
//     clone, e.g. on Vercel).
//   • REFETCH an existing file only when provably INCOMPLETE (below the floor, or a size
//     mismatch against a knowable remote size).
//   • A GET failure errors loudly — a missing model file means the build cannot trace a
//     working model into the function.
//
// Run:  node scripts/fetch-model.mjs   (also runs automatically via the "build" script)
import { mkdir, writeFile, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

const MODEL_ID = process.env.MODEL_ID ?? "Xenova/vit-base-patch16-224";
const REVISION = process.env.MODEL_REVISION ?? "main";

// dtype:'q8' loads onnx/model_quantized.onnx — the only weight file we need. The ViT q8
// export is ~84MB (verified on the Hub); floor at 5MB to catch a truncated/corrupt copy
// while staying well below the real size.
const FILES = [
  { rel: "config.json", minBytes: 100 }, // id2label = the 1000 ImageNet class names
  { rel: "preprocessor_config.json", minBytes: 50 }, // image resize/normalize spec
  { rel: "onnx/model_quantized.onnx", minBytes: 5_000_000 }, // q8 weights (~84MB)
];

const base = `https://huggingface.co/${MODEL_ID}/resolve/${REVISION}`;
const outRoot = join(process.cwd(), "models", MODEL_ID);

async function localSize(p) {
  try {
    return (await stat(p)).size;
  } catch {
    return -1;
  }
}

// Remote size via HEAD, or null if unknowable. Only used to VERIFY an existing file —
// never to gate a download.
async function remoteSize(url) {
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "follow" });
    if (!res.ok) return null;
    const len =
      res.headers.get("x-linked-size") ?? res.headers.get("content-length");
    return len ? Number(len) : null;
  } catch {
    return null;
  }
}

async function download(url, out, rel) {
  process.stdout.write(`  ↓ fetching   ${rel} ... `);
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, buf);
  console.log(`${(buf.length / 1024 / 1024).toFixed(2)} MB`);
}

async function ensureFile({ rel, minBytes = 1 }) {
  const url = `${base}/${rel}`;
  const out = join(outRoot, rel);
  const have = await localSize(out);

  if (have < minBytes) {
    if (have >= 0) {
      console.log(`  ↻ incomplete ${rel} (${have}B < ${minBytes}B floor) — refetching`);
    }
    await download(url, out, rel);
    return true;
  }

  const want = await remoteSize(url);
  if (want !== null && have !== want) {
    console.log(`  ↻ stale      ${rel} (have ${have}B, want ${want}B) — refetching`);
    await download(url, out, rel);
    return true;
  }

  console.log(`  ✓ cached     ${rel}`);
  return false;
}

console.log(`Vendoring ${MODEL_ID}@${REVISION} → models/${MODEL_ID}/`);
let fetched = 0;
for (const f of FILES) {
  if (await ensureFile(f)) fetched++;
}
console.log(
  fetched === 0
    ? "Model already present — nothing to download."
    : `Done — ${fetched} file(s) fetched.`,
);
