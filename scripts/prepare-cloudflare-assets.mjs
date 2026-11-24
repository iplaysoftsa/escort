import { copyFileSync, readdirSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicDirectory = resolve(root, "public");
const publicFiles = new Set([".css", ".html", ".js"]);

for (const entry of readdirSync(root, { withFileTypes: true })) {
  if (!entry.isFile() || !publicFiles.has(extname(entry.name))) continue;
  copyFileSync(resolve(root, entry.name), resolve(publicDirectory, entry.name));
}
