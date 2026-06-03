// scripts/fetch-tessdata.mjs — vendor the Tesseract English language data (PLAN §5/§10)
//
// Tesseract.js wants to DOWNLOAD eng.traineddata.gz at runtime and cache it to disk — but
// Vercel's filesystem is read-only except /tmp, and a cold-start network fetch is slow and
// fragile. Fix: vendor eng.traineddata.gz into ./tessdata at build, point the worker's
// langPath at it, and gzip:true so it reads the .gz directly.
//
// The .gz is ~4MB (well under GitHub's 100MB limit) so it's committed to the repo; this
// script only fetches it when missing, and is idempotent. Using the "fast" variant — a
// smaller, integer-quantized model that's plenty for screen text / signs / receipts.
import { mkdir, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";

const URL =
  process.env.TESSDATA_URL ??
  "https://github.com/naptha/tessdata/raw/gh-pages/4.0.0_fast/eng.traineddata.gz";
const MIN_BYTES = 1_000_000; // ~4MB expected; floor at 1MB to catch a truncated copy
const out = join(process.cwd(), "tessdata", "eng.traineddata.gz");

async function localSize(p) {
  try {
    return (await stat(p)).size;
  } catch {
    return -1;
  }
}

const have = await localSize(out);
if (have >= MIN_BYTES) {
  console.log(`  ✓ cached     tessdata/eng.traineddata.gz (${(have / 1024 / 1024).toFixed(2)} MB)`);
} else {
  if (have >= 0) console.log(`  ↻ incomplete tessdata (${have}B) — refetching`);
  process.stdout.write(`  ↓ fetching   eng.traineddata.gz ... `);
  const res = await fetch(URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${URL}`);
  const buf = Buffer.from(await res.arrayBuffer());
  await mkdir(join(process.cwd(), "tessdata"), { recursive: true });
  await writeFile(out, buf);
  console.log(`${(buf.length / 1024 / 1024).toFixed(2)} MB`);
}
