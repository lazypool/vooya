import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseVooComponent } from "./voo-parser.js";

const ignoredDirectories = new Set([".git", ".voo-cache", "dist", "node_modules", "target"]);

export function readVooComponents(root) {
  return readVooFiles(root).map((id) => ({
    ...parseVooComponent(readFileSync(id, "utf8"), id),
    id,
  }));
}

export function readVooFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...readVooFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".voo")) files.push(path);
  }
  return files;
}
