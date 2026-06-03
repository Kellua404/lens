// lib/exportCard.ts — the shareable analysis card + results JSON (PLAN §8)
//
// Pure-canvas composite (no DOM-capture lib): the specimen on the left light table, the
// real readout on the right (top labels with confidence, extracted text, palette), and a
// footer that proves it — "LENS · server · onnx + tesseract · no Vision API · $0 · Nms".
// Pure canvas avoids html-to-image's cross-origin/font pitfalls and keeps the artifact
// crisp. canvas.toBlob → download.
import type { AnalysisResult } from "@/lib/types";

const W = 1200;
const H = 675;
const PAD = 56;

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

async function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export async function renderCard(
  result: AnalysisResult,
  imageUrl: string,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;

  const MONO = "'DM Mono', ui-monospace, monospace";
  const DISP = "'Schibsted Grotesk', ui-sans-serif, system-ui, sans-serif";

  // darkroom background
  ctx.fillStyle = "#07090c";
  ctx.fillRect(0, 0, W, H);

  // faint technical grid
  ctx.strokeStyle = "rgba(32,38,47,0.5)";
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 48) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 48) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // hairline frame
  ctx.strokeStyle = "rgba(56,225,214,0.25)";
  ctx.lineWidth = 1;
  roundRect(ctx, 14, 14, W - 28, H - 28, 14);
  ctx.stroke();

  // ── specimen, left light table ────────────────────────────────────────────
  const imgBoxX = PAD;
  const imgBoxY = PAD + 30;
  const imgBoxW = 540;
  const imgBoxH = H - imgBoxY - PAD - 24;
  ctx.fillStyle = "#0d1014";
  roundRect(ctx, imgBoxX, imgBoxY, imgBoxW, imgBoxH, 10);
  ctx.fill();

  const img = await loadImage(imageUrl);
  if (img && img.width && img.height) {
    const s = Math.min(imgBoxW / img.width, imgBoxH / img.height);
    const dw = img.width * s;
    const dh = img.height * s;
    const dx = imgBoxX + (imgBoxW - dw) / 2;
    const dy = imgBoxY + (imgBoxH - dh) / 2;
    ctx.save();
    roundRect(ctx, imgBoxX, imgBoxY, imgBoxW, imgBoxH, 10);
    ctx.clip();
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.restore();
  }

  // eyebrow + wordmark
  ctx.fillStyle = "#828d9b";
  ctx.font = `500 14px ${MONO}`;
  ctx.fillText("OPTICAL ANALYSIS", PAD, PAD + 6);
  ctx.fillStyle = "#eaf0f6";
  ctx.font = `700 28px ${DISP}`;
  ctx.fillText("LENS", PAD + imgBoxW - 78, PAD + 8);

  // ── readout, right column ─────────────────────────────────────────────────
  const colX = imgBoxX + imgBoxW + 40;
  const colW = W - colX - PAD;
  let y = imgBoxY + 2;

  // CLASSIFY
  ctx.fillStyle = "#38e1d6";
  ctx.font = `500 13px ${MONO}`;
  ctx.fillText("CLASSIFY", colX, y);
  y += 30;
  result.labels.slice(0, 3).forEach((l) => {
    ctx.fillStyle = "#eaf0f6";
    ctx.font = `500 20px ${DISP}`;
    ctx.fillText(l.label, colX, y);
    ctx.fillStyle = "#828d9b";
    ctx.font = `500 16px ${MONO}`;
    ctx.textAlign = "right";
    ctx.fillText(`${(l.score * 100).toFixed(1)}%`, colX + colW, y);
    ctx.textAlign = "left";
    // bar
    ctx.fillStyle = "#20262f";
    roundRect(ctx, colX, y + 8, colW, 5, 2.5);
    ctx.fill();
    ctx.fillStyle = "#38e1d6";
    roundRect(ctx, colX, y + 8, Math.max(6, colW * l.score), 5, 2.5);
    ctx.fill();
    y += 40;
  });

  // READ
  y += 8;
  ctx.fillStyle = "#38e1d6";
  ctx.font = `500 13px ${MONO}`;
  ctx.fillText("READ", colX, y);
  y += 26;
  ctx.fillStyle = result.text ? "#eaf0f6" : "#828d9b";
  ctx.font = `400 16px ${MONO}`;
  const readLines = (result.text || "No legible text.")
    .split("\n")
    .slice(0, 3);
  for (const line of readLines) {
    ctx.fillText(truncate(ctx, line, colW), colX, y);
    y += 24;
  }

  // PALETTE
  y += 16;
  ctx.fillStyle = "#38e1d6";
  ctx.font = `500 13px ${MONO}`;
  ctx.fillText("PALETTE", colX, y);
  y += 22;
  const sw = Math.min(48, (colW - 5 * 10) / 6);
  result.palette.slice(0, 6).forEach((hex, i) => {
    ctx.fillStyle = hex;
    roundRect(ctx, colX + i * (sw + 10), y, sw, sw, 6);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    roundRect(ctx, colX + i * (sw + 10), y, sw, sw, 6);
    ctx.stroke();
  });

  // ── footer proof line ─────────────────────────────────────────────────────
  ctx.fillStyle = "#828d9b";
  ctx.font = `500 14px ${MONO}`;
  ctx.fillText(
    `LENS · server · onnx + tesseract · no Vision API · $0 · ${result.telemetry.totalMs}ms`,
    PAD,
    H - PAD + 8,
  );

  return canvas;
}

function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) {
    t = t.slice(0, -1);
  }
  return t + "…";
}

function fileSlug(result: AnalysisResult): string {
  const top = result.labels[0]?.label ?? "analysis";
  return top.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export async function downloadCard(
  result: AnalysisResult,
  imageUrl: string,
): Promise<void> {
  const canvas = await renderCard(result, imageUrl);
  await new Promise<void>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve();
      triggerDownload(URL.createObjectURL(blob), `lens-${fileSlug(result)}.png`);
      resolve();
    }, "image/png");
  });
}

export function downloadJSON(result: AnalysisResult): void {
  const blob = new Blob([JSON.stringify(result, null, 2)], {
    type: "application/json",
  });
  triggerDownload(URL.createObjectURL(blob), `lens-${fileSlug(result)}.json`);
}

function triggerDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
