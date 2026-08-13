import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const expectedPackages = [
  "@vooya/compiler",
  "@vooya/core",
  "@vooya/vite-plugin",
  "@vooya/vue",
  "@vooya/react",
  "@vooya/artifact-vue-counter",
];
const license = "MIT OR Apache-2.0";
const repositoryUrl = "git+https://github.com/vooyajs/vooya.git";

assert(readFileSync(new URL("../LICENSE-MIT", import.meta.url), "utf8").includes("MIT License"), "repository", "LICENSE-MIT must contain the MIT license text");
assert(readFileSync(new URL("../LICENSE-APACHE", import.meta.url), "utf8").includes("Apache License"), "repository", "LICENSE-APACHE must contain the Apache-2.0 license text");

for (const name of expectedPackages) {
  const manifest = readManifest(name);
  const packed = pack(name);
  const files = new Set(packed.files.map(({ path }) => path));

  assert(files.has("package.json"), name, "archive is missing package.json");
  assert(manifest.license === license, name, `license must be ${license}`);
  assert(manifest.repository?.type === "git", name, "repository type must be git");
  assert(manifest.repository?.url === repositoryUrl, name, `repository URL must be ${repositoryUrl}`);
  assert(manifest.repository?.directory === `packages/${name.replace("@vooya/", "")}`, name, "repository directory must identify this package");
  assert(manifest.publishConfig?.access === "public", name, "publishConfig.access must be public");
  for (const target of exportTargets(manifest.exports)) {
    assert(files.has(target), name, `archive is missing exported file ${target}`);
  }

  if (name === "@vooya/core") {
    assert(files.has("dist/vooya_app_bg.wasm"), name, "archive is missing runtime WASM");
    assert(files.has("dist/vooya_app.d.ts"), name, "archive is missing runtime types");
  }
  if (name === "@vooya/vue" || name === "@vooya/react") {
    assert(files.has("dist/index.js"), name, "archive is missing adapter JavaScript");
    assert(files.has("dist/index.d.ts"), name, "archive is missing adapter types");
  }
  if (name === "@vooya/artifact-vue-counter") {
    for (const file of ["dist/manifest.json", "dist/index.js", "dist/index.d.ts", "dist/wasm/vooya_app.js", "dist/wasm/vooya_app_bg.wasm"]) {
      assert(files.has(file), name, `archive is missing ${file}`);
    }
  }

  for (const file of files) {
    assert(!file.includes("VOOYA_COLLABORATION_LOG"), name, `archive leaks internal collaboration file ${file}`);
    assert(!file.includes("VOOYA_PRODUCT_OPERATING_PLAN"), name, `archive leaks internal planning file ${file}`);
  }

  console.log(`Verified ${name}@${packed.version}: ${files.size} archive files.`);
}

function readManifest(name) {
  const directory = name.replace("@vooya/", "");
  return JSON.parse(readFileSync(new URL(`../packages/${directory}/package.json`, import.meta.url), "utf8"));
}

function pack(name) {
  const result = spawnSync("npm", ["pack", "--json", "--dry-run", "--workspace", name], {
    cwd: root,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`${name}: npm pack --dry-run failed:\n${result.stderr || result.stdout}`);
  }
  const archives = JSON.parse(result.stdout);
  assert(archives.length === 1, name, `expected one archive, received ${archives.length}`);
  return archives[0];
}

function exportTargets(value) {
  if (typeof value === "string") return [stripPrefix(value)];
  if (!value || typeof value !== "object") return [];
  return [...new Set(Object.values(value).flatMap(exportTargets))];
}

function stripPrefix(path) {
  return path.replace(/^\.\//, "");
}

function assert(condition, name, message) {
  if (!condition) throw new Error(`${name}: ${message}`);
}
