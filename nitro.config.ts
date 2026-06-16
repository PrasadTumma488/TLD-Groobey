import { defineConfig } from "nitro/config";

/** Vercel Build Output API - required for TanStack Start SSR on tldgroobey.in */
export default defineConfig({
  preset: "vercel",
  /** Pick up server/routes (sitemap.xml, robots.txt, /api/*). */
  serverDir: "./server",
  routeRules: {
    "/sitemap.xml": { headers: { "cache-control": "public, max-age=3600" } },
    "/robots.txt": { headers: { "cache-control": "public, max-age=86400" } },
  },
});
