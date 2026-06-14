import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = path.join(root, "images", "categories-grid-images");
const targetDir = path.join(root, "public", "home-categories");

/** Source filename → public `/home-categories/` filename */
const IMAGE_MAP = {
  "grocery-1.png": "groceries.png",
  "veggies.png": "vegetables.png",
  "fruits.png": "fruits.png",
  "pickles.png": "pickles-non-veg.png",
  "papads.png": "papads-crisps.png",
  "chicken-mutton.png": "veg-non-veg.png",
  "combos.png": "combos.png",
};

mkdirSync(targetDir, { recursive: true });

let copied = 0;
for (const [sourceName, targetName] of Object.entries(IMAGE_MAP)) {
  const source = path.join(sourceDir, sourceName);
  if (!existsSync(source)) {
    console.warn("[groobey] Home category image source missing:", source);
    continue;
  }
  copyFileSync(source, path.join(targetDir, targetName));
  copied += 1;
}

console.log(`[groobey] Copied ${copied} home category image(s) to public/home-categories/`);
