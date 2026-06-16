/**
 * Compress homepage marketing images to WebP at display-appropriate sizes.
 * Run after copy-home-category-images.mjs (prebuild).
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");

const CATEGORY_WIDTHS = [320, 640];
const CATEGORY_MAX = 640;
const SLIDER_WIDTHS = [800, 1200];
const SLIDER_HEIGHT = 400;

async function encodeWebp(input, output, { width, height, quality = 82 }) {
  let pipeline = sharp(input);
  if (width || height) {
    pipeline = pipeline.resize(width, height, {
      fit: "inside",
      withoutEnlargement: true,
    });
  }
  await pipeline.webp({ quality, effort: 4 }).toFile(output);
}

async function optimizeCategoryPng(pngPath) {
  const dir = path.dirname(pngPath);
  const base = path.basename(pngPath, ".png");
  const meta = await sharp(pngPath).metadata();
  const size = Math.min(CATEGORY_MAX, meta.width ?? CATEGORY_MAX);

  await encodeWebp(pngPath, path.join(dir, `${base}.webp`), {
    width: size,
    height: size,
    quality: 80,
  });

  for (const w of CATEGORY_WIDTHS) {
    if (w >= size) continue;
    await encodeWebp(pngPath, path.join(dir, `${base}-${w}.webp`), {
      width: w,
      height: w,
      quality: 78,
    });
  }

  // Explicit 640w variant when main webp is larger (matches srcset).
  if (size >= 640) {
    await encodeWebp(pngPath, path.join(dir, `${base}-640.webp`), {
      width: 640,
      height: 640,
      quality: 80,
    });
  }
}

async function optimizeSliderPng(pngPath) {
  const dir = path.dirname(pngPath);
  const base = path.basename(pngPath, ".png");

  for (const w of SLIDER_WIDTHS) {
    const suffix = w === 1200 ? "" : `-${w}`;
    await encodeWebp(pngPath, path.join(dir, `${base}${suffix}.webp`), {
      width: w,
      height: Math.round((SLIDER_HEIGHT / 1200) * w),
      quality: 82,
    });
  }
}

async function optimizeHomePhoto(pngPath) {
  const dir = path.dirname(pngPath);
  const base = path.basename(pngPath, ".png");
  const meta = await sharp(pngPath).metadata();
  const width = Math.min(meta.width ?? 800, 820);

  await encodeWebp(pngPath, path.join(dir, `${base}.webp`), {
    width,
    quality: 82,
  });
}

function copyCategorySources() {
  const sourceDir = path.join(root, "images", "categories-grid-images");
  const targetDir = path.join(publicDir, "home-categories");
  const map = {
    "grocery-1.png": "groceries.png",
    "veggies.png": "vegetables.png",
    "fruits.png": "fruits.png",
    "pickles.png": "pickles-non-veg.png",
    "papads.png": "papads-crisps.png",
    "chicken-mutton.png": "veg-non-veg.png",
    "combos.png": "combos.png",
  };

  if (!existsSync(sourceDir)) return 0;

  mkdirSync(targetDir, { recursive: true });
  let copied = 0;
  for (const [sourceName, targetName] of Object.entries(map)) {
    const source = path.join(sourceDir, sourceName);
    if (!existsSync(source)) continue;
    copyFileSync(source, path.join(targetDir, targetName));
    copied += 1;
  }
  return copied;
}

async function optimizeDirPngs(dir, handler) {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".png")) continue;
    await handler(path.join(dir, name));
    count += 1;
  }
  return count;
}

copyCategorySources();

const categories = await optimizeDirPngs(
  path.join(publicDir, "home-categories"),
  optimizeCategoryPng,
);
const sliders = await optimizeDirPngs(path.join(publicDir, "home-slider"), optimizeSliderPng);
const homePhotos = await optimizeDirPngs(path.join(publicDir, "home"), optimizeHomePhoto);

function reportWebpSizes(label, dir) {
  if (!existsSync(dir)) return;
  let total = 0;
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".webp")) continue;
    total += statSync(path.join(dir, name)).size;
  }
  console.log(`[home-images] ${label} WebP total: ${(total / 1024).toFixed(1)} KiB`);
}

reportWebpSizes("categories", path.join(publicDir, "home-categories"));
reportWebpSizes("slider", path.join(publicDir, "home-slider"));
reportWebpSizes("home", path.join(publicDir, "home"));

console.log(
  `[home-images] Optimized ${categories} category, ${sliders} slider, ${homePhotos} home photo(s)`,
);
