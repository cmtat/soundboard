#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const audioDir = path.resolve(__dirname, "..", "audio");
const manifestPath = path.join(audioDir, "manifest.json");
const allowedExts = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"]);

async function main() {
  await fs.mkdir(audioDir, { recursive: true });

  const entries = await fs.readdir(audioDir, { withFileTypes: true });
  const clips = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const ext = path.extname(entry.name).toLowerCase();
    if (!allowedExts.has(ext) || entry.name === "manifest.json") continue;

    const filePath = path.join(audioDir, entry.name);
    const stats = await fs.stat(filePath);
    clips.push({ file: entry.name, sizeBytes: stats.size });
  }

  const isPeanut = (name) => /\(peanut\)/i.test(name);
  clips.sort((a, b) => {
    const aPeanut = isPeanut(a.file);
    const bPeanut = isPeanut(b.file);
    if (aPeanut && !bPeanut) return -1; // Peanut clips first
    if (!aPeanut && bPeanut) return 1;
    return a.file.localeCompare(b.file);
  });

  const payload = {
    generatedAt: new Date().toISOString(),
    clips,
  };

  await fs.writeFile(manifestPath, JSON.stringify(payload, null, 2));
  console.log(`Manifest updated with ${clips.length} clip(s) at ${manifestPath}`);
}

main().catch((error) => {
  console.error("Failed to generate manifest:", error);
  process.exit(1);
});
