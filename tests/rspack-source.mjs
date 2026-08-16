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
  verify("rspack-native", packages, true);
  const reactProject = verify("rspack-react", packages, true);
  verify("rslib-vue", packages, true);
  await verifyDevRecovery(vueProject);
  await verifyReactBrowser(reactProject);
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
    await waitFor(async () => (await fetch(`http://127.0.0.1:${port}`)).ok, 120_000, () => output);
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    let mainFrameNavigations = 0;
    page.on("framenavigated", (frame) => {
      if (frame === page.mainFrame()) mainFrameNavigations += 1;
    });
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByRole("button", { name: "Increment" }).waitFor();
    await waitForText(page, "[data-count]", "2", "Rspack Vue island did not mount its initial prop.");
    if (await page.locator(".counter").evaluate((node) => getComputedStyle(node).color) !== "rgb(5, 103, 89)") throw new Error("Rspack Vue scoped style was not applied.");
    await page.locator("[data-inc]").click();
    await waitForText(page, "[data-event]", "3", "Rspack Vue event forwarding failed.");
    await page.locator("[data-host-update]").click();
    await waitForText(page, "[data-count]", "4", "Rspack Vue prop update failed.");
    await page.locator("[data-host-toggle]").click();
    await page.locator("[data-count]").waitFor({ state: "detached" });
    await page.locator("[data-host-toggle]").click();
    await waitForText(page, "[data-count]", "4", "Rspack Vue dispose/remount failed.");

    const componentPath = resolve(project, "src/Counter.voo");
    const source = readFileSync(componentPath, "utf8");
    const buildsBeforeFailure = successfulBuildCount(output);
    writeFileSync(componentPath, source.replace("use crate::{EventListener, View, ViewElement};", "use crate::{EventListener, View, ViewElement};\nthis is invalid Rust"));
    await waitFor(() => output.includes("Cargo build failed with exit code 101"), 60_000, () => output);
    if (!/Counter\.voo:\d+/.test(output)) throw new Error(`Rspack did not retain the mapped .voo Rust diagnostic.\n${output}`);
    if (server.exitCode !== null) throw new Error("Rsbuild exited after a failed Rust rebuild.");

    writeFileSync(componentPath, source);
    await waitFor(
      () => successfulBuildCount(output) > buildsBeforeFailure,
      60_000,
      () => `Rsbuild did not complete the recovery compilation.\n${output}`,
    );
    // Rsbuild may navigate while applying the recovery compilation. Let that
    // navigation settle before establishing the dependency-change baseline,
    // otherwise a late recovery navigation can be mistaken for the reload
    // caused by the Rust path dependency below.
    await waitForStableValue(() => mainFrameNavigations);
    const buildsBeforeDependency = successfulBuildCount(output);
    const navigationsBeforeDependency = mainFrameNavigations;
    const dependencyPath = resolve(project, "rust/counter-math/src/lib.rs");
    writeFileSync(dependencyPath, 'pub fn button_label() -> &\'static str { "Increment dependency" }\n');
    await waitFor(
      () => successfulBuildCount(output) > buildsBeforeDependency,
      60_000,
      () => `Rust path dependency did not trigger an Rsbuild compilation.\n${output}`,
    );
    await waitFor(
      () => mainFrameNavigations > navigationsBeforeDependency,
      30_000,
      () => `Rsbuild did not reload the browser after the WASM build changed.\n${output}`,
    );
    await page.getByRole("button", { name: "Increment dependency" }).waitFor({ timeout: 30_000 });
    const unexpectedErrors = errors.filter((message) => !message.includes("Cargo build failed with exit code 101"));
    if (unexpectedErrors.length) throw new Error(`Rspack Vue browser errors:\n${unexpectedErrors.join("\n")}`);
    console.log("Verified Rsbuild Rust failure recovery without restarting the dev server.");
  } finally {
    await browser?.close();
    if (server && server.exitCode === null) server.kill("SIGTERM");
  }
}

async function verifyReactBrowser(project) {
  const port = await availablePort();
  const command = resolve(project, "node_modules/@rsbuild/core/bin/rsbuild.js");
  let server;
  let browser;
  let output = "";
  try {
    server = spawn(process.execPath, [command, "dev", "--host", "127.0.0.1", "--port", String(port), "--strictPort"], { cwd: project, env: { ...process.env, FORCE_COLOR: "0" } });
    server.stdout.on("data", (chunk) => { output += chunk; });
    server.stderr.on("data", (chunk) => { output += chunk; });
    await waitFor(async () => (await fetch(`http://127.0.0.1:${port}`)).ok, 120_000, () => output);
    browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${port}`);
    await page.getByRole("button", { name: "Increment" }).waitFor();
    await waitForText(page, "[data-count]", "2", "Rspack React island did not mount its initial prop.");
    if (await page.locator(".counter").evaluate((node) => getComputedStyle(node).color) !== "rgb(5, 103, 89)") throw new Error("Rspack React scoped style was not applied.");
    await page.locator("[data-inc]").click();
    await waitForText(page, "[data-event]", "3", "Rspack React event forwarding failed.");
    await page.locator("[data-host-update]").click();
    await waitForText(page, "[data-count]", "4", "Rspack React prop update failed.");
    await page.locator("[data-host-toggle]").click();
    await page.locator("[data-count]").waitFor({ state: "detached" });
    await page.locator("[data-host-toggle]").click();
    await waitForText(page, "[data-count]", "4", "Rspack React dispose/remount failed.");
    if (errors.length) throw new Error(`Rspack React browser errors:\n${errors.join("\n")}`);
    console.log("Verified Rspack React island browser contract.");
  } finally {
    await browser?.close();
    if (server?.exitCode === null) server.kill("SIGTERM");
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

async function waitForText(page, selector, expected, message) {
  try {
    await page.waitForFunction(
      ({ selector: target, expected: value }) => document.querySelector(target)?.textContent === value,
      { selector, expected },
      { timeout: 30_000 },
    );
  } catch {
    throw new Error(`${message} Received ${JSON.stringify(await page.locator(selector).textContent())}.`);
  }
}

async function waitFor(predicate, timeout = 30_000, details = () => "") {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if (await predicate()) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
  }
  throw new Error(`Timed out waiting for Rsbuild.\n${details()}`);
}

async function waitForStableValue(readValue, stableFor = 1_000, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  let value = readValue();
  let stableSince = Date.now();
  while (Date.now() < deadline) {
    await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    const nextValue = readValue();
    if (nextValue !== value) {
      value = nextValue;
      stableSince = Date.now();
    } else if (Date.now() - stableSince >= stableFor) {
      return;
    }
  }
  throw new Error("Timed out waiting for Rsbuild browser navigation to settle.");
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

function successfulBuildCount(output) {
  return output.match(/ready\s+built in/g)?.length ?? 0;
}
