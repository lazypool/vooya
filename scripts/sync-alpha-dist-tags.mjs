import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const directories = ["core", "vite-plugin", "vue", "react"];
const packages = directories.map((directory) =>
  JSON.parse(readFileSync(resolve(root, `packages/${directory}/package.json`), "utf8")),
);

for (const package_ of packages) {
  if (!/-alpha\.\d+$/.test(package_.version)) {
    throw new Error(
      `Refusing to tag non-alpha version ${package_.name}@${package_.version} as alpha.`,
    );
  }

  const specifier = `${package_.name}@${package_.version}`;
  if (dryRun) {
    console.log(`Would set ${package_.name} alpha -> ${package_.version}`);
    continue;
  }

  const result = spawnSync("npm", ["dist-tag", "add", specifier, "alpha"], {
    cwd: root,
    encoding: "utf8",
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`npm dist-tag add ${specifier} alpha failed.`);
  }
}

if (!dryRun) console.log("Synchronized alpha dist-tags for all @vooya packages.");
