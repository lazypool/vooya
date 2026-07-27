import { resolve } from "node:path";

import { writeVooDeclarations } from "./voo-declarations.js";
import { readVooComponents } from "./voo-project.js";

const [rootArgument, framework = "vue"] = process.argv.slice(2);
if (!rootArgument) {
  throw new Error("Usage: generate-declarations.mjs <application-root> [framework]");
}

const root = resolve(process.cwd(), rootArgument);
writeVooDeclarations(readVooComponents(root), framework);
