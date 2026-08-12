import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const directories = ["compiler", "core", "vite-plugin", "vue", "react", "artifact-vue-counter"];
const packages = directories.map((directory) =>
  JSON.parse(readFileSync(resolve(root, `packages/${directory}/package.json`), "utf8")),
);
const expectedNames = packages.map((package_) => package_.name).sort();
const versions = new Set(packages.map((package_) => package_.version));

if (versions.size !== 1) {
  throw new Error(
    `@vooya packages must use one version, found: ${packages
      .map((package_) => `${package_.name}@${package_.version}`)
      .join(", ")}`,
  );
}

const plugin = packages.find((package_) => package_.name === "@vooya/vite-plugin");
if (plugin.dependencies["@vooya/core"] !== plugin.version) {
  throw new Error("@vooya/vite-plugin must depend on the exact fixed @vooya/core version.");
}
if (plugin.dependencies["@vooya/compiler"] !== plugin.version) {
  throw new Error("@vooya/vite-plugin must depend on the exact fixed @vooya/compiler version.");
}

const artifact = packages.find((package_) => package_.name === "@vooya/artifact-vue-counter");
if (artifact.dependencies["@vooya/vue"] !== artifact.version) {
  throw new Error(
    "@vooya/artifact-vue-counter must depend on the exact fixed @vooya/vue version.",
  );
}

const changesets = JSON.parse(readFileSync(resolve(root, ".changeset/config.json"), "utf8"));
const fixed = changesets.fixed.find(
  (group) => JSON.stringify([...group].sort()) === JSON.stringify(expectedNames),
);
if (!fixed) throw new Error("Changesets must contain one fixed group with all @vooya packages.");

console.log(`Verified fixed @vooya package version ${packages[0].version}.`);
