import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const temporaryRoot = mkdtempSync(resolve(tmpdir(), "vooya-rspack-source-"));
const packageDirectory = resolve(temporaryRoot, "packages");

try {
  mkdirSync(packageDirectory, { recursive: true });
  run("npm", ["run", "build:core"], root);
  for (const workspace of ["@vooya/vue", "@vooya/react", "@vooya/rspack"]) run("npm", ["run", "build", "--workspace", workspace], root);
  const packages = ["@vooya/compiler", "@vooya/core", "@vooya/build-core", "@vooya/vue", "@vooya/react", "@vooya/rspack"].map(pack);
  const vueProject = verify("rspack-vue", packages, true);
  verify("rspack-react", packages, true);
  verify("rslib-vue", packages, true);
  await verifyDevRecovery(vueProject);
} finally {
  if (!process.env.VOOYA_KEEP_RSPACK_FIXTURES) rmSync(temporaryRoot, { force: true, recursive: true });
}

function verify(name, packages, expectWasm) {
  const project = resolve(temporaryRoot, name);
  cpSync(resolve(root, "tests/fixtures", name), project, { recursive: true });
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...packages], project);
  run("npm", ["run", "build"], project);
  const files = walk(resolve(project, "dist"));
  if (expectWasm && !files.some((file) => file.endsWith(".wasm"))) throw new Error(`${name} did not emit a WASM asset.`);
  if (!files.some((file) => file.endsWith(".css"))) throw new Error(`${name} did not emit scoped CSS.`);
  console.log(`Verified ${name} source .voo build with ${files.length} output files.`);
  return project;
}

async function verifyDevRecovery(project) {
  const port = await availablePort();
  const command = resolve(project, "node_modules/@rsbuild/core/bin/rsbuild.js");
  let output = "";
  let browser;
  let server;
  try {
    server = spawn(process.execPath, [command, "dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], {
      cwd: project,
      env: { ...process.env, FORCE_COLOR: "0" },
    });
    server.stdout.on("data", (chunk) => { output += chunk; });
    server.stderr.on("data", (chunk) => { output += chunk; });
    await waitFor(async () => (await fetch(`http://127.0.0.1:${port}`)).ok);
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByRole("button", { name: "Increment" }).waitFor();

    const componentPath = resolve(project, "src/Counter.voo");
    const source = readFileSync(componentPath, "utf8");
    writeFileSync(componentPath, source.replace("use crate::{EventListener, View, ViewElement};", "use crate::{EventListener, View, ViewElement};\nthis is invalid Rust"));
    await waitFor(() => output.includes("Cargo build failed with exit code 101"));
    if (server.exitCode !== null) throw new Error("Rsbuild exited after a failed Rust rebuild.");

    writeFileSync(componentPath, source.replace('text("Increment")', 'text("Increment recovered")'));
    await page.getByRole("button", { name: "Increment recovered" }).waitFor({ timeout: 30_000 });
    console.log("Verified Rsbuild Rust failure recovery without restarting the dev server.");
  } finally {
    await browser?.close();
    if (server && server.exitCode === null) server.kill("SIGTERM");
  }
}

function pack(workspace) {
  const result = spawnSync("npm", ["pack", "--json", "--workspace", workspace, "--pack-destination", packageDirectory], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return resolve(packageDirectory, JSON.parse(result.stdout)[0].filename);
}

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with ${result.status}.`);
}

function walk(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(path)); else files.push(path);
  }
  return files;
}

async function waitFor(predicate, timeout = 30_000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`Timed out waiting for Rsbuild.\n${output}`);
}

function availablePort() {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      probe.close(() => resolvePort(address.port));
    });
  });
}
