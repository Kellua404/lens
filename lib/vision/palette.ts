// lib/vision/palette.ts — dimensions + dominant colors from real pixels (PLAN §5.2)
//
// No model, no paid API, no extra deps: sharp decodes the image, we downscale to 64×64,
// read raw RGB, bucket into a coarse 3-bit-per-channel histogram, and return the top N
// buckets (averaged) as hex. Fast, deterministic, and honestly "the real pixels".
import sharp from "sharp";
import type { Dimensions } from "@/lib/types";

export async function dimensions(bytes: Uint8Array): Promise<Dimensions> {
  const m = await sharp(Buffer.from(bytes)).metadata();
  return { width: m.width ?? 0, height: m.height ?? 0 };
}

export async function palette(bytes: Uint8Array, n = 6): Promise<string[]> {
  const { data, info } = await sharp(Buffer.from(bytes))
    .resize(64, 64, { fit: "inside" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const buckets = new Map<number, { r: number; g: number; b: number; c: number }>();
  for (let i = 0; i + 2 < data.length; i += info.channels) {
    const r = data[i],
      g = data[i + 1],
      b = data[i + 2];
    const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5); // 3 bits/channel
    const e = buckets.get(key) ?? { r: 0, g: 0, b: 0, c: 0 };
    e.r += r;
    e.g += g;
    e.b += b;
    e.c++;
    buckets.set(key, e);
  }

  return [...buckets.values()]
    .sort((a, b) => b.c - a.c)
    .slice(0, n)
    .map(
      (e) =>
        "#" +
        [e.r, e.g, e.b]
          .map((v) => Math.round(v / e.c).toString(16).padStart(2, "0"))
          .join(""),
    );
}
