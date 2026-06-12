import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(root, "voice-note", "TLD_Groobey_Welcome_Note.mp3");
const targetDir = path.join(root, "public", "voice-notes");
const target = path.join(targetDir, "TLD_Groobey_Welcome_Note.mp3");

if (!existsSync(source)) {
  console.warn("[groobey] Welcome voice source missing:", source);
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
copyFileSync(source, target);
console.log("[groobey] Copied welcome voice to public/voice-notes/");
