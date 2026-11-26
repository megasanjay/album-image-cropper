// Generates a folder of test images in different formats, sizes and
// orientations. Usage: node scripts/make-test-images.mjs [outDir]
// HEIC/HEIF files are created with macOS `sips`; they're skipped elsewhere.
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const outDir = process.argv[2] ?? "test-images";

rmSync(outDir, { force: true, recursive: true });
mkdirSync(outDir, { recursive: true });

/** A labelled test card: gradient, 10% grid, corner markers, "TOP" arrow. */
function card(width, height, title, hue, { transparent = false } = {}) {
  const font = Math.round(Math.min(width, height) / 14);
  const grid = [];

  for (let i = 1; i < 10; i++) {
    grid.push(
      `<line x1="${(width * i) / 10}" y1="0" x2="${(width * i) / 10}" y2="${height}" />`,
      `<line x1="0" y1="${(height * i) / 10}" x2="${width}" y2="${(height * i) / 10}" />`,
    );
  }

  const corner = (x, y, label) =>
    `<text x="${x}" y="${y}" font-size="${font * 0.6}" fill="white" stroke="black" stroke-width="${font / 30}">${label}</text>`;
  const pad = font * 0.4;

  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="hsl(${hue} 80% 55%)" />
          <stop offset="1" stop-color="hsl(${(hue + 120) % 360} 80% 35%)" />
        </linearGradient>
      </defs>
      ${
        transparent
          ? `<circle cx="${width / 2}" cy="${height / 2}" r="${Math.min(width, height) * 0.45}" fill="url(#g)" />`
          : `<rect width="${width}" height="${height}" fill="url(#g)" />`
      }
      <g stroke="white" stroke-opacity="0.35" stroke-width="${Math.max(1, width / 800)}">${grid.join("")}</g>
      <g font-family="Helvetica, Arial, sans-serif" font-weight="bold">
        ${corner(pad, pad + font * 0.6, "TL")}
        ${corner(width - pad - font * 0.9, pad + font * 0.6, "TR")}
        ${corner(pad, height - pad, "BL")}
        ${corner(width - pad - font * 0.9, height - pad, "BR")}
        <text x="50%" y="${font * 2}" text-anchor="middle" font-size="${font}" fill="white">▲ TOP</text>
        <text x="50%" y="50%" text-anchor="middle" font-size="${font}" fill="white" stroke="black" stroke-width="${font / 25}">${title}</text>
        <text x="50%" y="${height / 2 + font * 1.2}" text-anchor="middle" font-size="${font * 0.55}" fill="white">${width} × ${height}</text>
      </g>
    </svg>`);
}

const made = [];

async function write(name, pipeline) {
  await pipeline.toFile(join(outDir, name));
  made.push(name);
}

// Common camera / phone sizes in the formats browsers open directly.
await write(
  "01-landscape.jpg",
  sharp(card(4032, 3024, "JPEG landscape", 200)).jpeg({ quality: 90 }),
);
await write(
  "02-portrait.jpg",
  sharp(card(3024, 4032, "JPEG portrait", 20)).jpeg({ quality: 90 }),
);
await write("03-square.png", sharp(card(2048, 2048, "PNG square", 280)).png());
await write(
  "04-transparent.png",
  sharp(card(1600, 1200, "PNG transparent", 140, { transparent: true })).png(),
);
await write(
  "05-panorama.jpg",
  sharp(card(8000, 2000, "JPEG panorama", 60)).jpeg({ quality: 85 }),
);
await write("06-small.jpg", sharp(card(320, 240, "Tiny", 320)).jpeg());
await write(
  "07-webp.webp",
  sharp(card(3000, 2000, "WebP", 170)).webp({ quality: 85 }),
);
await write(
  "08-avif.avif",
  sharp(card(3000, 2000, "AVIF", 240)).avif({ quality: 60 }),
);
await write("09-gif.gif", sharp(card(1200, 900, "GIF", 100)).gif());

// Stored sideways with an EXIF "rotate 90° CW" tag. It must show upright
// (▲ TOP at the top) and export upright.
await write(
  "10-exif-rotated.jpg",
  sharp(
    await sharp(card(3024, 4032, "EXIF orientation 6", 0))
      .rotate(-90)
      .toBuffer(),
  )
    .withMetadata({ orientation: 6 })
    .jpeg({ quality: 90 }),
);

// Browsers other than Safari can't open TIFF, and the server doesn't convert
// it, so it should show "Can't preview" and download unchanged.
await write("11-unsupported.tiff", sharp(card(1200, 900, "TIFF", 50)).tiff());

// Not an image at all: should be ignored when selected.
execFileSync("sh", [
  "-c",
  `echo "not an image" > "${join(outDir, "12-not-an-image.txt")}"`,
]);
made.push("12-not-an-image.txt");

// Two files with the same name in different folders, to test duplicates.
mkdirSync(join(outDir, "duplicate-name"), { recursive: true });
await write(
  "duplicate-name/01-landscape.jpg",
  sharp(card(1600, 1200, "Same name, other folder", 300)).jpeg(),
);

// HEIC/HEIF: sharp's prebuilt binaries can't encode HEVC, so use macOS sips.
if (process.platform === "darwin") {
  for (const [source, name, format] of [
    ["01-landscape.jpg", "13-iphone-landscape.heic", "heic"],
    ["02-portrait.jpg", "14-iphone-portrait.heic", "heic"],
    ["10-exif-rotated.jpg", "15-heic-from-rotated.heic", "heic"],
  ]) {
    execFileSync(
      "sips",
      [
        "-s",
        "format",
        format,
        join(outDir, source),
        "--out",
        join(outDir, name),
      ],
      {
        stdio: "ignore",
      },
    );
    made.push(name);
  }
} else {
  console.warn("Skipping HEIC files: they need macOS `sips` to create.");
}

console.log(
  `Wrote ${made.length} files to ${outDir}/:\n  ${made.join("\n  ")}`,
);
