/**
 * TanStack Start sets `build.ssr: true` for client builds, so vite-plugin-pwa skips SW generation.
 * Run after `vite build` to emit dist/client/sw.js (see vite-pwa/vite-plugin-pwa#902).
 */
import { existsSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";
import { injectManifest } from "workbox-build";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const distClient =
  [
    path.join(root, ".vercel", "output", "static"),
    path.join(root, "dist", "client"),
  ].find((dir) => existsSync(dir)) ?? path.join(root, "dist", "client");
const swSrc = path.join(root, "src", "sw.ts");
const swBundled = path.join(distClient, "sw-bundled.js");

if (!existsSync(distClient)) {
  console.error(
    "[generate-sw] static output missing - run vite build first (.vercel/output/static or dist/client).",
  );
  process.exit(1);
}

await esbuild.build({
  entryPoints: [swSrc],
  outfile: swBundled,
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  minify: true,
  logLevel: "silent",
});

const { count, size, warnings } = await injectManifest({
  swSrc: swBundled,
  swDest: path.join(distClient, "sw.js"),
  globDirectory: distClient,
  globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,webmanifest}"],
  globIgnores: ["sw.js", "sw.js.map"],
  maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
});

if (existsSync(swBundled)) unlinkSync(swBundled);

for (const w of warnings) {
  console.warn("[generate-sw]", w);
}

console.log(
  `[generate-sw] sw.js precaches ${count} files (${(size / 1024).toFixed(1)} KiB)`,
);
