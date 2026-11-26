/** A crop rectangle in pixels of the (rotated) source image. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type CropHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type Rotation = 0 | 90 | 180 | 270;

/** What a pointer drag on the crop overlay is doing. */
export type CropDrag =
  | { kind: "move" }
  | { kind: "edge"; handle: "n" | "s" | "e" | "w" }
  // Corner resize and drawing a new box both span from a fixed anchor point
  // to the pointer; `px`/`py` is where the pointer's corner started.
  | { kind: "span"; ax: number; ay: number; px: number; py: number };

/** Smallest crop side, in image pixels. */
export const MIN_CROP_SIZE = 16;

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

/** Largest crop of the given aspect ratio (w / h), centered in the image. */
export function centeredCrop(
  width: number,
  height: number,
  ratio: number | null,
): CropRect {
  if (!ratio) {
    return { x: 0, y: 0, w: width, h: height };
  }

  let w = width;
  let h = w / ratio;

  if (h > height) {
    h = height;
    w = h * ratio;
  }

  return { x: (width - w) / 2, y: (height - h) / 2, w, h };
}

function span(
  ax: number,
  ay: number,
  px: number,
  py: number,
  width: number,
  height: number,
  ratio: number | null,
  minSize: number,
): CropRect {
  px = clamp(px, 0, width);
  py = clamp(py, 0, height);

  const left = px < ax;
  const up = py < ay;
  const roomW = left ? ax : width - ax;
  const roomH = up ? ay : height - ay;

  let w = Math.abs(px - ax);
  let h = Math.abs(py - ay);

  if (ratio) {
    const maxW = Math.min(roomW, roomH * ratio);
    const minW = Math.max(minSize, minSize * ratio);

    w = Math.min(Math.max(w, h * ratio, minW), maxW);
    h = w / ratio;
  } else {
    w = Math.min(Math.max(w, minSize), roomW);
    h = Math.min(Math.max(h, minSize), roomH);
  }

  return { x: left ? ax - w : ax, y: up ? ay - h : ay, w, h };
}

function resizeEdge(
  start: CropRect,
  handle: "n" | "s" | "e" | "w",
  dx: number,
  dy: number,
  width: number,
  height: number,
  ratio: number | null,
): CropRect {
  const horizontal = handle === "e" || handle === "w";
  // Work in "main axis" terms so one code path handles all four edges.
  const pos = horizontal ? start.x : start.y;
  const size = horizontal ? start.w : start.h;
  const crossPos = horizontal ? start.y : start.x;
  const crossSize = horizontal ? start.h : start.w;
  const limit = horizontal ? width : height;
  const crossLimit = horizontal ? height : width;
  const delta = horizontal ? dx : dy;
  // Ratio expressed as main / cross.
  const r = ratio ? (horizontal ? ratio : 1 / ratio) : null;

  const negative = handle === "w" || handle === "n";
  const anchor = negative ? pos + size : pos;
  const moved = (negative ? pos : pos + size) + delta;

  let maxSize = negative ? anchor : limit - anchor;

  if (r) {
    maxSize = Math.min(maxSize, crossLimit * r);
  }

  const minSize = r
    ? Math.max(MIN_CROP_SIZE, MIN_CROP_SIZE * r)
    : MIN_CROP_SIZE;
  const newSize = clamp(
    negative ? anchor - moved : moved - anchor,
    Math.min(minSize, maxSize),
    maxSize,
  );
  const newPos = negative ? anchor - newSize : anchor;

  let newCrossPos = crossPos;
  let newCrossSize = crossSize;

  if (r) {
    // Keep the box centered on the other axis while it grows or shrinks.
    newCrossSize = newSize / r;
    newCrossPos = clamp(
      crossPos + crossSize / 2 - newCrossSize / 2,
      0,
      crossLimit - newCrossSize,
    );
  }

  return horizontal
    ? { x: newPos, y: newCrossPos, w: newSize, h: newCrossSize }
    : { x: newCrossPos, y: newPos, w: newCrossSize, h: newSize };
}

/**
 * New crop for a drag that started at `start` and has moved by (dx, dy)
 * image pixels.
 */
export function applyCropDrag(
  drag: CropDrag,
  start: CropRect,
  dx: number,
  dy: number,
  width: number,
  height: number,
  ratio: number | null,
): CropRect {
  if (drag.kind === "move") {
    return {
      ...start,
      x: clamp(start.x + dx, 0, width - start.w),
      y: clamp(start.y + dy, 0, height - start.h),
    };
  }

  if (drag.kind === "edge") {
    return resizeEdge(start, drag.handle, dx, dy, width, height, ratio);
  }

  return span(
    drag.ax,
    drag.ay,
    drag.px + dx,
    drag.py + dy,
    width,
    height,
    ratio,
    MIN_CROP_SIZE,
  );
}

/** True when the crop covers the whole image, give or take rounding. */
export function isFullCrop(crop: CropRect, width: number, height: number) {
  return (
    Math.round(crop.x) === 0 &&
    Math.round(crop.y) === 0 &&
    Math.round(crop.w) === width &&
    Math.round(crop.h) === height
  );
}

const ENCODABLE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

/** Browsers can only encode a few formats; anything else is saved as PNG. */
export function croppedFileType(file: File) {
  return ENCODABLE_TYPES.has(file.type) ? file.type : "image/png";
}

export function croppedFileName(file: File) {
  if (croppedFileType(file) === file.type) {
    return file.name;
  }

  return `${file.name.replace(/\.[^.]+$/, "")}.png`;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();

    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not decode image"));
    img.src = url;
  });
}

/** Reads the displayed (EXIF-oriented) size of an image file. */
export async function readImageSize(url: string) {
  const img = await loadImage(url);

  return { height: img.naturalHeight, width: img.naturalWidth };
}

/**
 * Renders the rotated + cropped image at full resolution. Returns the
 * original file untouched when nothing would change, so it is not
 * re-encoded.
 */
export async function renderCroppedImage(
  file: File,
  url: string,
  crop: CropRect,
  rotation: Rotation,
): Promise<Blob> {
  const img = await loadImage(url);
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  const quarterTurn = rotation === 90 || rotation === 270;
  const rotatedW = quarterTurn ? h : w;
  const rotatedH = quarterTurn ? w : h;

  if (rotation === 0 && isFullCrop(crop, rotatedW, rotatedH)) {
    return file;
  }

  const canvas = document.createElement("canvas");

  canvas.width = Math.max(1, Math.round(crop.w));
  canvas.height = Math.max(1, Math.round(crop.h));

  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("Canvas is not supported");
  }

  ctx.imageSmoothingQuality = "high";
  ctx.translate(-Math.round(crop.x), -Math.round(crop.y));
  ctx.translate(rotatedW / 2, rotatedH / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.drawImage(img, -w / 2, -h / 2);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Export failed"))),
      croppedFileType(file),
      0.95,
    );
  });
}

export function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");

  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
