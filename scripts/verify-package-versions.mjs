import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptRoot = fileURLToPath(new URL("..", import.meta.url));
const rootOption = process.argv.indexOf("--root");
const root = rootOption === -1 ? scriptRoot : resolve(process.argv[rootOption + 1] ?? "");
const requireArtifactManifest = process.argv.includes("--require-artifact-manifest");
const directories = ["compiler", "core", "vite-plugin", "vue", "react", "artifact-vue-counter"];
const packageEntries = directories.map((directory) => ({
  directory,
  path: resolve(root, `packages/${directory}/package.json`),
  package: JSON.parse(readFileSync(resolve(root, `packages/${directory}/package.json`), "utf8")),
}));
const packages = packageEntries.map((entry) => entry.package);
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

const lockfile = JSON.parse(readFileSync(resolve(root, "package-lock.json"), "utf8"));
for (const { directory, path, package: package_ } of packageEntries) {
  const lockEntry = lockfile.packages?.[`packages/${directory}`];
  if (!lockEntry) throw new Error(`package-lock.json is missing workspace entry packages/${directory}.`);
  if (lockEntry.name !== package_.name || lockEntry.version !== package_.version) {
    throw new Error(
      `package-lock.json workspace entry packages/${directory} must match ${path}: expected ${package_.name}@${package_.version}, found ${lockEntry.name ?? "unknown"}@${lockEntry.version ?? "unknown"}.`,
    );
  }
  for (const [dependency, range] of Object.entries(package_.dependencies ?? {})) {
    if (!expectedNames.includes(dependency)) continue;
    if (range !== package_.version) {
      throw new Error(
        `${package_.name} must depend on the exact fixed ${dependency} version ${package_.version}, found ${range}.`,
      );
    }
    if (lockEntry.dependencies?.[dependency] !== range) {
      throw new Error(
        `package-lock.json workspace entry packages/${directory} must keep internal dependency ${dependency}@${range}.`,
      );
    }
  }
}

const artifactManifestPath = resolve(root, "packages/artifact-vue-counter/dist/manifest.json");
if (requireArtifactManifest && !existsSync(artifactManifestPath)) {
  throw new Error("Artifact manifest is required for release verification; run its package build first.");
}
if (existsSync(artifactManifestPath)) {
  const manifest = JSON.parse(readFileSync(artifactManifestPath, "utf8"));
  if (manifest.artifactVersion !== artifact.version) {
    throw new Error(
      `Artifact manifest artifactVersion must match @vooya/artifact-vue-counter@${artifact.version}, found ${String(manifest.artifactVersion)}.`,
    );
  }
  const compilerSource = readFileSync(resolve(root, "packages/compiler/src/codegen.js"), "utf8");
  const abiMatch = compilerSource.match(/export const VOO_ABI_VERSION = (\d+);/);
  if (!abiMatch) throw new Error("Could not determine VOO_ABI_VERSION from @vooya/compiler.");
  const expectedAbi = Number(abiMatch[1]);
  if (manifest.abiVersion !== expectedAbi) {
    throw new Error(
      `Artifact manifest ABI must match @vooya/compiler VOO_ABI_VERSION ${expectedAbi}, found ${String(manifest.abiVersion)}.`,
    );
  }
}

const changesets = JSON.parse(readFileSync(resolve(root, ".changeset/config.json"), "utf8"));
const fixed = changesets.fixed.find(
  (group) => JSON.stringify([...group].sort()) === JSON.stringify(expectedNames),
);
if (!fixed) throw new Error("Changesets must contain one fixed group with all @vooya packages.");

console.log(`Verified fixed @vooya package release contract at version ${packages[0].version}.`);
