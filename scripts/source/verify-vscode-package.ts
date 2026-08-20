import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const archive = resolve(root, "dist/voo-vscode.vsix");
if (!existsSync(archive)) throw new Error(`Expected VSIX archive at ${archive}.`);

const files = execFileSync("unzip", ["-Z1", archive], { encoding: "utf8" })
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);
for (const file of [
  "extension/runtime/vooya-core/Cargo.toml",
  "extension/runtime/vooya-core/src/lib.rs",
  "extension/runtime/vooya-core/src/reactive.rs",
  "extension/runtime/vooya-core/src/view.rs",
]) {
  if (!files.includes(file)) throw new Error(`VSIX is missing bundled Vooya runtime file ${file}.`);
}
if (files.some((file) => file.startsWith("extension/test/"))) {
  throw new Error("VSIX must not include editor tests.");
}
if (files.some((file) => file.startsWith("extension/source/") || file.endsWith("/tsconfig.json"))) {
  throw new Error("VSIX must contain compiled editor JavaScript, not TypeScript authoring source.");
}
console.log("Verified VSIX includes the bundled Vooya runtime and excludes tests and TypeScript authoring source.");
