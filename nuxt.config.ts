// https://nuxt.com/docs/api/configuration/nuxt-config
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Public origin, used for absolute URLs in share cards. Set NUXT_PUBLIC_SITE_URL
 * for a custom domain; on Vercel the production domain is picked up
 * automatically. Read at build time because the site is static.
 */
const siteUrl = (
  process.env.NUXT_PUBLIC_SITE_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

const title = "Album Cropper: crop photos by aspect ratio, in your browser";
const description =
  "Crop photos to an exact aspect ratio, one or a hundred at a time. Runs entirely in your browser: no uploads, no accounts, no tracking.";
const ogImage = `${siteUrl}/og-image.png`;

export default defineNuxtConfig({
  compatibilityDate: "2025-01-16",

  // Everything runs in the browser: images are never uploaded anywhere.
  ssr: false,

  // Static so it lands in the generated HTML, where link-preview scrapers
  // (which don't run JavaScript) can read it.
  app: {
    head: {
      htmlAttrs: { lang: "en" },
      link: [
        { href: siteUrl + "/", rel: "canonical" },
        { href: "/favicon.svg", rel: "icon", type: "image/svg+xml" },
        { href: "/favicon.ico", rel: "icon", sizes: "48x48" },
        { href: "/apple-touch-icon.png", rel: "apple-touch-icon" },
        { href: "/site.webmanifest", rel: "manifest" },
      ],
      meta: [
        { charset: "utf-8" },
        { content: "width=device-width, initial-scale=1", name: "viewport" },
        { content: description, name: "description" },
        { content: "#6366f1", name: "theme-color" },
        { content: "Album Cropper", name: "application-name" },
        { content: "Album Cropper", name: "apple-mobile-web-app-title" },

        { content: "website", property: "og:type" },
        { content: "Album Cropper", property: "og:site_name" },
        { content: title, property: "og:title" },
        { content: description, property: "og:description" },
        { content: siteUrl + "/", property: "og:url" },
        { content: ogImage, property: "og:image" },
        { content: "image/png", property: "og:image:type" },
        { content: "1200", property: "og:image:width" },
        { content: "630", property: "og:image:height" },
        {
          content: "Album Cropper: crop by aspect ratio, right in your browser",
          property: "og:image:alt",
        },
        { content: "en_US", property: "og:locale" },

        { content: "summary_large_image", name: "twitter:card" },
        { content: title, name: "twitter:title" },
        { content: description, name: "twitter:description" },
        { content: ogImage, name: "twitter:image" },
      ],
      noscript: [
        {
          tagPosition: "bodyOpen",
          textContent:
            "Album Cropper needs JavaScript to crop photos in your browser.",
        },
      ],
      script: [
        {
          innerHTML: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebApplication",
            applicationCategory: "MultimediaApplication",
            browserRequirements: "Requires JavaScript and a modern browser.",
            description,
            featureList: [
              "Batch crop many photos at once",
              "Aspect ratio presets with portrait and landscape",
              "Rotate photos in 90 degree steps",
              "HEIC to JPEG conversion",
              "Keyboard shortcuts",
              "Runs locally: no uploads, accounts or tracking",
            ],
            image: ogImage,
            isAccessibleForFree: true,
            name: "Album Cropper",
            offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
            operatingSystem: "Any",
            url: siteUrl + "/",
          }),
          type: "application/ld+json",
        },
      ],
      title: "Album Cropper",
    },
  },

  css: ["~/assets/css/main.css"],

  devtools: { enabled: true },

  modules: ["@nuxt/ui", "@nuxt/eslint"],

  // Bundle the icons the app uses instead of fetching them from the Iconify
  // API at runtime, so the page makes no third-party requests.
  icon: {
    clientBundle: { scan: true },
    fallbackToApi: false,
    provider: "none",
  },

  // Light mode only.
  ui: {
    colorMode: false,
  },

  routeRules: {
    "/**": {
      headers: {
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
      },
    },
  },

  eslint: {},

  hooks: {
    // robots.txt and sitemap.xml need the absolute site URL, so write them
    // into the build output instead of keeping them in public/.
    "nitro:build:public-assets": async (nitro) => {
      const dir = nitro.options.output.publicDir;
      const today = new Date().toISOString().slice(0, 10);

      await writeFile(
        join(dir, "robots.txt"),
        `User-agent: *\nAllow: /\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      );
      await writeFile(
        join(dir, "sitemap.xml"),
        `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${siteUrl}/</loc><lastmod>${today}</lastmod></url>
</urlset>
`,
      );
    },
  },
});
