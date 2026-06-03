// lib/downscale.ts — client-side image downscale before upload (PLAN §6/§13)
//
// Vercel caps the request body (~4.5MB) and big images slow both the POST and inference.
// We downscale to ≤ MAX_EDGE on the longest side and re-encode as JPEG ~0.85 in the
// browser (canvas) before uploading. Returns a File so the FormData upload is unchanged.
// Already-small images pass through untouched so we never upscale or degrade them.

const MAX_EDGE = 1600;
const QUALITY = 0.85;
const SOFT_LIMIT = 4 * 1024 * 1024; // skip work if the source is already comfortably small

export async function downscaleImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;

  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file; // let the server reject anything we can't decode

  const { width, height } = bitmap;
  const longest = Math.max(width, height);

  // Small enough already and under the soft byte limit → upload as-is (no re-encode,
  // no quality loss). PNGs with text stay crisp.
  if (longest <= MAX_EDGE && file.size <= SOFT_LIMIT) {
    bitmap.close?.();
    return file;
  }

  const scale = Math.min(1, MAX_EDGE / longest);
  const w = Math.round(width * scale);
  const h = Math.round(height * scale);

  const canvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), { width: w, height: h });
  const ctx = (canvas as HTMLCanvasElement | OffscreenCanvas).getContext("2d", {
    alpha: false,
  }) as CanvasRenderingContext2D;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await canvasToBlob(canvas, QUALITY);
  if (!blob || blob.size >= file.size) return file; // never make it bigger

  const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg" });
}

async function canvasToBlob(
  canvas: HTMLCanvasElement | OffscreenCanvas,
  quality: number,
): Promise<Blob | null> {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: "image/jpeg", quality });
  }
  return new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/jpeg", quality),
  );
}
