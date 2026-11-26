# Album Image Cropper

A browser-only app for cropping photos to an exact aspect ratio, one at a time
or a whole album at once.

The image tools that ship with macOS and Linux make this surprisingly painful:
fixed ratios are buried or missing, and there's no quick way to crop a batch
of photos the same way. Album Cropper does just that, with a crop overlay
modelled on the one in the Windows Photos app.

It also tracks nothing about you. Photos are decoded, converted and cropped
on your device and never uploaded. There's no server, no account and no
analytics, and the page makes no requests to third parties (fonts and icons
are bundled with the app).

1. Open the app and select (or drag in) a batch of images.
2. Step through each one and adjust the crop overlay.
3. Download them all. Each image is saved as a separate file with a name
   prefix (default `cropped-`), so your browser may ask to allow multiple
   downloads.

## Features

- Crop overlay with rule-of-thirds grid, corner/edge handles, and drag-to-move
- Click and drag anywhere outside the box to draw a new crop
- Aspect ratios: Free, Original, Square, 3:2, 4:3, 5:4, 7:5, 16:9
- Landscape / portrait / auto orientation for fixed ratios, set per photo.
  Press the active ratio again to flip between landscape and portrait
- Rotate 90° left or right
- Exports at full resolution in the original format (JPEG, PNG, WebP; other
  formats are saved as PNG). Images you didn't change are included as-is.

### Keyboard shortcuts

| Key              | Action                                    |
| ---------------- | ----------------------------------------- |
| `←` / `→`        | Previous / next                           |
| `1`–`8`          | Aspect ratio preset (press again to flip) |
| `O`              | Switch this photo's orientation           |
| `[` / `]`        | Rotate left / right                       |
| `R`              | Reset crop                                |
| `Backspace`      | Remove photo                              |
| `⌘/Ctrl O`       | Add photos                                |
| `⌘/Ctrl S`       | Download this photo                       |
| `⌘/Ctrl Shift S` | Download all                              |
| `?`              | Show all shortcuts                        |

## Development

You will need [mise](https://mise.jdx.dev) installed; it provides Node.js and
pnpm.

```bash
mise trust # first time only
mise install
pnpm install
pnpm dev
```

Then open <http://localhost:3000>.

### Test images

```bash
node scripts/make-test-images.mjs
```

This creates `test-images/` (git-ignored) with JPEG, PNG, WebP, AVIF, GIF,
TIFF, HEIC, an EXIF-rotated photo, a panorama, a tiny image, a non-image file
and a duplicate file name. HEIC files need macOS `sips` to create.

### Production

```bash
pnpm generate
```

This writes a static site to `.output/public`. Host it anywhere (Vercel,
Netlify, GitHub Pages, or any static file server).

Share cards, the canonical URL, `robots.txt` and `sitemap.xml` need the site's
public address at build time. On Vercel the production domain is detected
automatically; elsewhere (or for a custom domain) set it explicitly:

```bash
NUXT_PUBLIC_SITE_URL=https://crop.example.com pnpm generate
```

### Icons and share image

Favicons, app icons and the 1200×630 `og-image.png` are rendered from
`public/favicon.svg`. After changing the logo or the share card, run:

```bash
node scripts/make-brand-assets.mjs
```

## Formats

JPEG, PNG, WebP, AVIF and GIF open natively in every modern browser. HEIC/HEIF
(iPhone photos) only open natively in Safari; other browsers convert them to
JPEG in a Web Worker with [libheif-js](https://github.com/catdad-experiments/libheif-js).
The ~2 MB decoder is only downloaded the first time a HEIC file is added.
