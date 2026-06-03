// store/useLens.ts — the one small client store (PLAN §7)
//
// Holds the uploaded image preview, an HONEST engine status, the last result, any error,
// and a transient toast. analyze(file) downscales → POSTs FormData → sets result/error;
// warm() pings the warm route on mount so both engines load while the user picks an image.
// The UI is a pure function of this state.
import { create } from "zustand";
import type { AnalysisResult } from "@/lib/types";
import { downscaleImage } from "@/lib/downscale";

export type Status = "idle" | "warming" | "analyzing" | "done" | "error";

type LensState = {
  status: Status;
  imageUrl: string | null; // object URL of the current specimen
  fileName: string | null;
  result: AnalysisResult | null;
  error: string | null;
  engineReady: boolean; // warm-up resolved at least once
  warmStarted: boolean; // guard so warm() only fires once
  toast: string | null;

  warm: () => Promise<void>;
  analyze: (file: File) => Promise<void>;
  reset: () => void;
  showToast: (msg: string) => void;
  copyText: (text: string) => Promise<void>;
  copyHex: (hex: string) => Promise<void>;
};

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useLens = create<LensState>((set, get) => ({
  status: "idle",
  imageUrl: null,
  fileName: null,
  result: null,
  error: null,
  engineReady: false,
  warmStarted: false,
  toast: null,

  warm: async () => {
    if (get().warmStarted) return;
    set({ warmStarted: true });
    try {
      const res = await fetch("/api/analyze/warm", { method: "GET" });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.ready) set({ engineReady: true });
    } catch {
      // A failed warm-up is non-fatal — the first analyze loads the engines and shows
      // honest "warming…" theater instead of a generic spinner.
    }
  },

  analyze: async (file: File) => {
    // Show the specimen on the table immediately (instant preview), then analyze.
    const prev = get().imageUrl;
    const previewFile = await downscaleImage(file).catch(() => file);
    const url = URL.createObjectURL(previewFile);
    if (prev) URL.revokeObjectURL(prev);

    const cold = !get().engineReady;
    set({
      imageUrl: url,
      fileName: file.name,
      status: cold ? "warming" : "analyzing",
      result: null,
      error: null,
    });

    try {
      const form = new FormData();
      form.append("image", previewFile);
      const res = await fetch("/api/analyze", { method: "POST", body: form });
      const data = await res.json().catch(() => null);

      if (!res.ok || !data || "error" in data) {
        set({
          status: "error",
          error:
            (data && data.error) ||
            "The engine couldn't read that image — try another.",
        });
        return;
      }

      set({
        status: "done",
        result: data as AnalysisResult,
        engineReady: true,
        error: null,
      });
    } catch {
      set({
        status: "error",
        error: "The engine couldn't reach the server — try again.",
      });
    }
  },

  reset: () => {
    const url = get().imageUrl;
    if (url) URL.revokeObjectURL(url);
    set({
      status: "idle",
      imageUrl: null,
      fileName: null,
      result: null,
      error: null,
    });
  },

  showToast: (msg) => {
    set({ toast: msg });
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => set({ toast: null }), 2200);
  },

  copyText: async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      get().showToast("Text copied");
    } catch {
      get().showToast("Couldn't copy — your browser blocked it.");
    }
  },

  copyHex: async (hex) => {
    try {
      await navigator.clipboard.writeText(hex);
      get().showToast(`${hex.toUpperCase()} copied`);
    } catch {
      get().showToast("Couldn't copy — your browser blocked it.");
    }
  },
}));
