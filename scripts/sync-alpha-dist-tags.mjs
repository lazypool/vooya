import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dryRun = process.argv.includes("--dry-run");
const check = process.argv.includes("--check");
if (dryRun && check) throw new Error("Use either --dry-run or --check, not both.");
const directories = ["compiler", "core", "vite-plugin", "vue", "react", "artifact-vue-counter"];
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
  if (check) {
    const result = spawnSync("npm", ["view", package_.name, "dist-tags", "--json"], {
      cwd: root,
      encoding: "utf8",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`npm view ${package_.name} dist-tags failed.`);
    const tags = JSON.parse(result.stdout);
    if (tags.alpha !== package_.version) {
      throw new Error(
        `npm alpha dist-tag for ${package_.name} must be ${package_.version}, found ${String(tags.alpha)}.`,
      );
    }
    console.log(`Verified ${package_.name} alpha -> ${package_.version}`);
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

if (!dryRun && !check) console.log("Synchronized alpha dist-tags for all @vooya packages.");
