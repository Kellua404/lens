// lib/types.ts — the server↔client contract (PLAN §7)
//
// The typed boundary between the server-side vision models and the light-table UI. Every
// field here is real model output or honest telemetry — never decoration. The client
// renders as a pure function of this shape.

// A ranked classification label. `score` is the softmax confidence in 0..1.
export type Label = { label: string; score: number };

// One OCR-detected word. `box` is in NATURAL image pixels (top-left origin) — the client
// scales it to the displayed image size to draw the overlay (PLAN §5.3).
export type Word = {
  text: string;
  confidence: number; // 0..100, rounded
  box: { x: number; y: number; w: number; h: number };
};

export type Dimensions = { width: number; height: number };

export type Telemetry = {
  model: string; // the Hub id of the classifier actually running
  classifyMs: number; // measured classification latency
  ocrMs: number; // measured OCR latency
  width: number;
  height: number;
  topConfidence: number; // top-1 label score, 0..1
  wordCount: number;
  totalMs: number; // end-to-end request time
  backend: string; // e.g. "server · onnx + tesseract · no-api"
  coldStart: boolean; // true when this request paid the model/worker load cost
};

export type AnalysisResult = {
  dimensions: Dimensions;
  labels: Label[]; // sorted desc, top-k
  text: string; // full extracted text
  words: Word[]; // per-word boxes (natural px)
  palette: string[]; // dominant colors as #rrggbb
  telemetry: Telemetry;
};

export type AnalysisError = { error: string };
