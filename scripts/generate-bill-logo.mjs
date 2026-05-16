import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const source = path.join(publicDir, "groobey-logo.png");
const out = path.join(publicDir, "groobey-logo-bill.png");

/** 4× bill display height (72px) — sharp when shown or printed at 72px / zoomed to ~150%. */
const BILL_LOGO_HEIGHT = 288;

if (!fs.existsSync(source)) {
  console.error("[bill-logo] Missing public/groobey-logo.png");
  process.exit(1);
}

const meta = await sharp(source).metadata();
const targetH = Math.max(BILL_LOGO_HEIGHT, meta.height ?? 0);

await sharp(source)
  .resize({
    height: targetH,
    fit: "inside",
    withoutEnlargement: false,
    kernel: sharp.kernel.lanczos3,
  })
  .sharpen({ sigma: 0.6, m1: 0.5, m2: 2 })
  .png({ compressionLevel: 9, effort: 10 })
  .toFile(out);

const outMeta = await sharp(out).metadata();
console.log(
  `[bill-logo] ${path.basename(source)} (${meta.width}×${meta.height}) → ${path.basename(out)} (${outMeta.width}×${outMeta.height})`,
);
