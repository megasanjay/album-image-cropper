// Renders public/favicon.svg into every icon the site needs, plus the
// social share card. Usage: node scripts/make-brand-assets.mjs
//
//   favicon.ico            16/32/48, legacy browsers
//   apple-touch-icon.png   180, iOS home screen
//   icon-192.png, icon-512.png            web app manifest
//   icon-maskable-512.png                 Android adaptive icon
//   og-image.png           1200x630, Open Graph / Twitter card
import { readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";

const svg = readFileSync("public/favicon.svg", "utf8");

// Full-bleed square for platforms that apply their own rounded mask.
const squareSvg = svg.replace(/ rx="15"/, "");

const render = (source, size) =>
  sharp(Buffer.from(source), { density: 72 * (size / 64) * 4 })
    .resize(size, size)
    .png();

await render(squareSvg, 180).toFile("public/apple-touch-icon.png");
await render(svg, 192).toFile("public/icon-192.png");
await render(svg, 512).toFile("public/icon-512.png");

// Maskable icons need the artwork inside the central 80% safe zone.
const maskableSvg = squareSvg.replace(
  "translate(14 14) scale(1.5)",
  "translate(19.2 19.2) scale(1.067)",
);

await render(maskableSvg, 512).toFile("public/icon-maskable-512.png");

// ICO container holding PNG images (supported by every current browser).
const sizes = [16, 32, 48];
const images = await Promise.all(
  sizes.map((size) => render(svg, size).toBuffer()),
);
const header = Buffer.alloc(6 + 16 * sizes.length);

header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(sizes.length, 4);

let offset = header.length;

sizes.forEach((size, i) => {
  const entry = 6 + 16 * i;

  header.writeUInt8(size, entry); // width
  header.writeUInt8(size, entry + 1); // height
  header.writeUInt8(0, entry + 2); // palette size
  header.writeUInt8(0, entry + 3); // reserved
  header.writeUInt16LE(1, entry + 4); // color planes
  header.writeUInt16LE(32, entry + 6); // bits per pixel
  header.writeUInt32LE(images[i].length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += images[i].length;
});

writeFileSync("public/favicon.ico", Buffer.concat([header, ...images]));

// Social card: the homepage's fanned photo prints next to the pitch.
const font =
  "'Plus Jakarta Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif";

const print = (transform, fill) => `
  <g transform="${transform}">
    <rect x="-130" y="-160" width="260" height="320" rx="10" fill="#fff" filter="url(#shadow)" />
    <rect x="-116" y="-146" width="232" height="292" rx="5" fill="${fill}" />
  </g>`;

const ogSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="brand" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#6366f1" />
      <stop offset="1" stop-color="#7c3aed" />
    </linearGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="10" stdDeviation="14" flood-color="#000" flood-opacity="0.14" />
    </filter>
  </defs>

  <rect width="1200" height="630" fill="#f5f5f5" />

  <g transform="translate(80 92)">
    <rect width="64" height="64" rx="14" fill="url(#brand)" />
    <g transform="translate(14 14) scale(1.5)" fill="none" stroke="#fff" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </g>
    <text x="84" y="43" font-family="${font}" font-size="30" font-weight="700" fill="#171717">Album Cropper</text>
  </g>

  <text font-family="${font}" font-weight="800" font-size="64" fill="#171717" letter-spacing="-1.5">
    <tspan x="80" y="282">Crop by aspect ratio,</tspan>
    <tspan x="80" y="362">right in your browser.</tspan>
  </text>

  <text font-family="${font}" font-size="28" fill="#525252">
    <tspan x="80" y="438">Batch cropping for JPEG, PNG, HEIC and more.</tspan>
    <tspan x="80" y="478">No uploads. No accounts. No tracking.</tspan>
  </text>

  ${print("translate(975 330) scale(0.88) rotate(-11) translate(-46 6)", "#fde68a")}
  ${print("translate(975 330) scale(0.88) rotate(10) translate(46 6)", "#bae6fd")}
  <g transform="translate(975 321) scale(0.88)">
    <rect x="-130" y="-160" width="260" height="320" rx="10" fill="#fff" filter="url(#shadow)" />
    <rect x="-116" y="-146" width="232" height="292" rx="5" fill="url(#brand)" />
    <g transform="translate(-48 -48) scale(4)" fill="none" stroke="#fff" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" opacity="0.95">
      <path d="M6 2v14a2 2 0 0 0 2 2h14" /><path d="M18 22V8a2 2 0 0 0-2-2H2" />
    </g>
  </g>
</svg>`;

await sharp(Buffer.from(ogSvg)).png().toFile("public/og-image.png");

console.log("Wrote favicons, app icons and og-image.png to public/");
