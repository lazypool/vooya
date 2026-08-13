import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const fixture = resolve(repositoryRoot, "tests/fixtures/quickstart-vue");
const temporaryRoot = mkdtempSync(resolve(tmpdir(), "vooya-quickstart-"));
const packageDirectory = resolve(temporaryRoot, "packages");
const project = resolve(temporaryRoot, "app");

try {
  verifyGettingStarted();
  mkdirSync(packageDirectory, { recursive: true });
  run("npm", ["run", "build:core"], repositoryRoot);
  run("npm", ["run", "build", "--workspace", "@vooya/vue"], repositoryRoot);
  const packages = [
    pack("@vooya/compiler"),
    pack("@vooya/core"),
    pack("@vooya/vite-plugin"),
    pack("@vooya/vue"),
  ];

  cpSync(fixture, project, { recursive: true });
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...packages], project);
  run("npm", ["run", "build"], project);

  const assets = readdirSync(resolve(project, "dist/assets"));
  if (!assets.some((asset) => /^vooya_app_bg-.*\.wasm$/.test(asset))) {
    throw new Error("Quickstart build did not emit the application WASM asset.");
  }
  console.log(`Verified Vue source quickstart outside the checkout: ${project}`);
} finally {
  if (!process.env.VOOYA_KEEP_QUICKSTART_FIXTURE) rmSync(temporaryRoot, { force: true, recursive: true });
}

function verifyGettingStarted() {
  const guide = readFileSync(resolve(repositoryRoot, "docs/guide/getting-started.md"), "utf8");
  const greeting = readFileSync(resolve(fixture, "src/Greeting.voo"), "utf8");
  for (const expected of [
    "npm exec -- vooya doctor",
    'npm install @vooya/vue@alpha',
    'npm install --save-dev @vooya/vite-plugin@alpha',
    "plugins: [vue(), vooya()]",
    "npm run dev",
    "npm run build",
    greeting.trim(),
  ]) {
    if (!guide.includes(expected)) throw new Error(`Getting Started drifted from the Vue quickstart: missing ${JSON.stringify(expected)}.`);
  }
}

function pack(workspace) {
  const result = spawnSync(
    "npm",
    ["pack", "--json", "--workspace", workspace, "--pack-destination", packageDirectory],
    { cwd: repositoryRoot, encoding: "utf8" },
  );
  if (result.status !== 0) fail("npm pack", result);
  const [{ filename }] = JSON.parse(result.stdout);
  return resolve(packageDirectory, filename);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
}

function fail(command, result) {
  throw new Error(`${command} failed:\n${result.stderr || result.stdout}`);
}
