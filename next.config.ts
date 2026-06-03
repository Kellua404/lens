import type { NextConfig } from "next";

// PLAN §4.4 — THE SIZE RECIPE. This is the single most failure-prone file in the project:
// it keeps the /api/analyze function under Vercel's hard 250 MB unzipped limit while
// shipping THREE native runtimes (onnxruntime-node CPU, sharp's libvips, and Tesseract's
// wasm core). Reused verbatim from Resonance's production code, extended for Tesseract.
//
// Three things must be true or production 500s / times out:
//   1. The vendored ONNX model (./models) + the eng traineddata (./tessdata) are TRACED
//      into the function bundle (nft can't see them — they're read at runtime, not
//      imported), so we list them explicitly here.
//   2. The native inference libs are treated as external server packages (don't bundle
//      their .node / .so / .wasm binaries — let Node require them at runtime).
//   3. The analyze route runs on the Node runtime with a raised maxDuration (in route.ts).

// onnxruntime-node loads libonnxruntime.so.1 via dlopen at runtime, which Next's static
// tracer can't follow — include the two CPU binaries by NAME.
//
// CRITICAL: include ONLY these two CPU files — do NOT glob `linux/x64/*`. onnxruntime's
// postinstall (when not skipped via .npmrc) downloads CUDA + TensorRT provider libs
// (hundreds of MB) into this same dir; a `*` glob force-bundles them and blows the 250MB
// limit. Vercel has no GPU, so those providers are pure dead weight. (They don't appear
// locally on macOS, which is why this trap hid for so long in Resonance.)
const ONNX_CPU = [
  "./node_modules/onnxruntime-node/bin/**/linux/x64/libonnxruntime.so.1",
  "./node_modules/onnxruntime-node/bin/**/linux/x64/onnxruntime_binding.node",
];

// @huggingface/transformers/dist/transformers.node.mjs has a STATIC top-level
// `import sharp from "sharp"`, so sharp must ship — AND we genuinely use it here
// (decode/dimensions/palette). nft can't follow sharp's dynamic native require, so we
// include sharp + its platform libvips libs explicitly. On Vercel's linux only the linux
// @img packages are installed (~15MB).
const SHARP = ["./node_modules/sharp/**", "./node_modules/@img/**"];

// Tesseract.js loads its wasm core + worker from node_modules at runtime, and reads the
// vendored language data from ./tessdata. None of these are statically imported, so trace
// them in by hand. (PLAN §5.)
// Tesseract spawns a worker_threads Worker whose script (worker-script/node/index.js) does
// its OWN runtime require()s of tesseract.js's transitive deps — wasm-feature-detect (SIMD
// probe), is-url, zlibjs/bmp-js/regenerator-runtime, etc. nft does NOT trace these because
// tesseract.js is a serverExternalPackage (loaded at runtime) and the worker is a detached
// file. If any are missing from the bundle the worker's require fails and createWorker
// HANGS (the failure never propagates) → FUNCTION_INVOCATION_TIMEOUT. So trace the deps
// by name. (node-fetch is intentionally omitted: the worker uses `global.fetch ||
// require('node-fetch')`, and Vercel's Node has global.fetch, so it's never required.)
const TESSERACT = [
  "./node_modules/tesseract.js/**",
  "./node_modules/tesseract.js-core/**",
  "./node_modules/wasm-feature-detect/**",
  "./node_modules/is-url/**",
  "./node_modules/bmp-js/**",
  "./node_modules/zlibjs/**",
  "./node_modules/regenerator-runtime/**",
  "./node_modules/idb-keyval/**",
  "./tessdata/**",
];

// Belt-and-suspenders: drop the non-linux onnxruntime binaries + the GPU provider libs
// that get traced in by default. Vercel runs linux/x64 CPU only. NOTE: never exclude
// sharp/@img — transformers statically imports sharp at module load.
const ONNX_EXCLUDE = [
  "./node_modules/onnxruntime-node/bin/**/darwin/**",
  "./node_modules/onnxruntime-node/bin/**/win32/**",
  "./node_modules/onnxruntime-node/bin/**/linux/arm64/**",
  "./node_modules/onnxruntime-node/bin/**/*providers*",
];

const INCLUDE = ["./models/**/*", ...ONNX_CPU, ...SHARP, ...TESSERACT];

const nextConfig: NextConfig = {
  // Don't bundle/transpile the inference libs + their native binaries.
  serverExternalPackages: [
    "@huggingface/transformers",
    "onnxruntime-node",
    "tesseract.js",
    "sharp",
  ],

  outputFileTracingIncludes: {
    "/api/analyze": INCLUDE,
    "/api/analyze/warm": INCLUDE,
  },
  outputFileTracingExcludes: {
    "/api/analyze": ONNX_EXCLUDE,
    "/api/analyze/warm": ONNX_EXCLUDE,
  },
};

export default nextConfig;
