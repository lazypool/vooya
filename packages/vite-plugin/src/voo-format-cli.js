import { readFileSync, statSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { formatVooComponent } from "./voo-format.js";
import { readVooFiles } from "./voo-project.js";
const arguments_ = process.argv.slice(2);
const check = arguments_.includes("--check");
const inputs = arguments_.filter((argument) => argument !== "--check");
const paths = inputs.length > 0 ? inputs : ["."];
const files = paths.flatMap((path) => {
    const absolute = resolve(path);
    return statSync(absolute).isDirectory() ? readVooFiles(absolute) : [absolute];
});
const changed = [];
for (const file of [...new Set(files)].sort()) {
    const source = readFileSync(file, "utf8");
    const formatted = formatVooComponent(source, file);
    if (source === formatted)
        continue;
    changed.push(file);
    if (!check)
        writeFileSync(file, formatted);
}
if (check && changed.length > 0) {
    console.error(`Unformatted .voo files:\n${changed.map((file) => `  ${file}`).join("\n")}`);
    process.exitCode = 1;
}
else {
    console.log(`${check ? "Checked" : "Formatted"} ${files.length} .voo file(s).`);
}
