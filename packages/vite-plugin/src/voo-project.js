import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { parseVooComponent } from "./voo-parser.js";

export function readVooComponents(root) {
  return readVooFiles(root).map((id) => ({
    ...parseVooComponent(readFileSync(id, "utf8"), id),
    id,
  }));
}

function readVooFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "dist" || entry.name === "node_modules") continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...readVooFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".voo")) files.push(path);
  }
  return files;
}
