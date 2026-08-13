import { resolve } from "node:path";
import { writeFileSync } from "node:fs";
import { generateVooDeclaration } from "@vooya/compiler";
import { readVooComponents } from "./voo-project.js";
const [rootArgument, framework = "vue"] = process.argv.slice(2);
if (!rootArgument) {
    throw new Error("Usage: generate-declarations.js <application-root> [framework]");
}
const root = resolve(process.cwd(), rootArgument);
for (const component of readVooComponents(root)) {
    if (component.format !== "source")
        continue;
    writeFileSync(component.id.replace(/\.voo$/, ".d.voo.ts"), generateVooDeclaration(component, framework));
}
