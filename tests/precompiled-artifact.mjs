import { spawn, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixture = resolve(root, "tests/fixtures/precompiled-vue");
const temporaryRoot = mkdtempSync(resolve(tmpdir(), "vooya-precompiled-"));
const packages = resolve(temporaryRoot, "packages");
const project = resolve(temporaryRoot, "app");
const noRustPath = [dirname(process.execPath), "/usr/bin", "/bin"].join(":");

try {
  mkdirSync(packages, { recursive: true });
  run("npm", ["run", "build", "--workspace", "@vooya/artifact-vue-counter"], root);
  await assertAbiMismatch();
  run("npm", ["run", "build", "--workspace", "@vooya/vue"], root);
  const artifact = pack("@vooya/artifact-vue-counter");
  const vue = pack("@vooya/vue");
  assertPackedArtifact(artifact);
  cpSync(fixture, project, { recursive: true });
  run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", artifact, vue], project);
  run(process.execPath, [resolve(project, "node_modules/vite/bin/vite.js"), "build"], project, { PATH: noRustPath });
  if (!readdirSync(resolve(project, "dist/assets")).some((file) => file.endsWith(".wasm"))) throw new Error("Precompiled consumer build did not emit artifact WASM.");
  await assertBrowserRun();
  console.log(`Precompiled Vue artifact passed without Rust tools in PATH: ${project}`);
} finally {
  if (!process.env.VOOYA_KEEP_PRECOMPILED_FIXTURE) rmSync(temporaryRoot, { force: true, recursive: true });
}

function pack(workspace) {
  const result = spawnSync("npm", ["pack", "--json", "--workspace", workspace, "--pack-destination", packages], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  return resolve(packages, JSON.parse(result.stdout)[0].filename);
}

function assertPackedArtifact(tarball) {
  const output = spawnSync("tar", ["-tf", tarball], { encoding: "utf8" }).stdout.split("\n");
  for (const file of ["package/dist/index.js", "package/dist/index.d.ts", "package/dist/manifest.json", "package/dist/wasm/vooya_app.js", "package/dist/wasm/vooya_app_bg.wasm"]) {
    if (!output.includes(file)) throw new Error(`Artifact package is missing ${file}.`);
  }
}

async function assertBrowserRun() {
  const dist = resolve(project, "dist");
  const server = createServer((request, response) => {
    const pathname = request.url === "/" ? "/index.html" : request.url;
    const file = resolve(dist, `.${pathname}`);
    try {
      const body = readFileSync(file);
      response.setHeader("Content-Type", file.endsWith(".wasm") ? "application/wasm" : file.endsWith(".js") ? "text/javascript" : "text/html");
      response.setHeader("Content-Length", String(body.byteLength));
      response.end(body);
    } catch (error) {
      console.error(`static server error for ${file}`, error);
      response.statusCode = 404;
      response.end("not found");
    }
  });
  await new Promise((resolve) => server.listen(4191, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const browserErrors = [];
    page.on("console", (message) => {
      if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", (error) => browserErrors.push(error.message));
    const result = await page.goto("http://127.0.0.1:4191", { waitUntil: "domcontentloaded", timeout: 10_000 });
    const output = page.locator("output.vooya-portable-counter");
    try {
      await output.waitFor({ timeout: 5_000 });
    } catch (error) {
      throw new Error(`Artifact did not mount. HTML: ${await page.locator("body").innerHTML()}`, { cause: error });
    }
    if (await output.textContent() !== "7") throw new Error("Artifact did not mount its initial island value.");
    await page.getByRole("button", { name: "Update" }).click({ timeout: 5_000 });
    await output.waitFor({ state: "attached", timeout: 5_000 });
    if (await output.textContent() !== "12") throw new Error("Artifact did not update its island prop.");
    if (browserErrors.length > 0) throw new Error(`Clean consumer had browser errors: ${browserErrors.join("\n")}`);
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

async function assertAbiMismatch() {
  const artifact = await import(resolve(root, "packages/artifact-vue-counter/dist/index.js"));
  try {
    artifact.assertArtifactAbi(artifact.manifest.abiVersion + 1);
    throw new Error("Artifact ABI mismatch was accepted.");
  } catch (error) {
    if (!/Vooya artifact ABI mismatch for PortableCounter: artifact expects 1, but WASM provides 2\./.test(String(error.message))) throw error;
  }
}

function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
}
