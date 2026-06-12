import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "images", "caption.png");
const out = path.join(root, "public", "home", "groobey-caption.png");

if (!fs.existsSync(src)) {
  console.error("[home:caption] Missing images/caption.png");
  process.exit(1);
}

fs.mkdirSync(path.dirname(out), { recursive: true });

const cropped = await sharp(src).trim({ threshold: 20 }).png().toBuffer();
const { width, height } = await sharp(cropped).metadata();

await fs.promises.writeFile(out, cropped);
console.log(`[home:caption] ${width}x${height}`);
