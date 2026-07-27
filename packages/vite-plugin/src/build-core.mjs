import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { generateRustComponents, generatedComponentPrelude } from "./voo-codegen.js";

const require = createRequire(import.meta.url);

export const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));

export function resolveRuntimeCrateRoot() {
  return dirname(require.resolve("@voyajs/core/rust/Cargo.toml"));
}

export function buildApplication({
  applicationRoot,
  components = [],
  runtimeCrateRoot = resolveRuntimeCrateRoot(),
  cacheRoot = resolve(applicationRoot, ".voo-cache"),
  outputDir = resolve(cacheRoot, "dist"),
}) {
  const sourceDir = resolve(cacheRoot, "src/components");
  const targetDir = resolve(cacheRoot, "target");
  const sourcePaths = new Map();
  const diagnosticMappings = new Map();

  mkdirSync(sourceDir, { recursive: true });
  for (const [index, component] of components.entries()) {
    const sourcePath = resolve(sourceDir, `${index}-${component.name}.rs`);
    const prelude = generatedComponentPrelude(component);
    writeIfChanged(sourcePath, `${prelude}${component.rust.content}\n`);
    sourcePaths.set(component.id, sourcePath);
    diagnosticMappings.set(sourcePath, {
      id: component.id,
      startLine: component.rust.startLine,
      generatedLineOffset: prelude.split(/\r?\n/).length - 1,
    });
  }

  writeIfChanged(resolve(cacheRoot, "Cargo.toml"), generatedCargoManifest(runtimeCrateRoot));
  writeIfChanged(
    resolve(cacheRoot, "src/lib.rs"),
    `pub use voya_core::*;\n\n${generateRustComponents(components, sourcePaths)}`,
  );

  runCargo(
    applicationRoot,
    [
      "build",
      "--manifest-path",
      resolve(cacheRoot, "Cargo.toml"),
      "--release",
      "--target",
      "wasm32-unknown-unknown",
      "--target-dir",
      targetDir,
    ],
    diagnosticMappings,
  );

  rmSync(outputDir, { force: true, recursive: true });
  mkdirSync(outputDir, { recursive: true });
  execFileSync(
    "wasm-bindgen",
    [
      resolve(targetDir, "wasm32-unknown-unknown/release/voya_app.wasm"),
      "--target",
      "web",
      "--out-dir",
      outputDir,
    ],
    { cwd: applicationRoot, stdio: "inherit" },
  );

  return {
    cacheRoot,
    runtimeModule: resolve(outputDir, "voya_app.js"),
  };
}

// Builds the empty runtime artifact shipped by @voyajs/core.
export function buildCore(root = repositoryRoot) {
  return buildApplication({
    applicationRoot: root,
    cacheRoot: resolve(root, "target/voya-package"),
    outputDir: resolve(root, "packages/core/dist"),
  });
}

export function generatedCargoManifest(runtimeCrateRoot) {
  return `[package]
name = "voya-app"
version = "0.0.0"
edition = "2024"

[workspace]

[lib]
crate-type = ["cdylib"]

[dependencies]
voya-core = { path = ${JSON.stringify(runtimeCrateRoot)} }
js-sys = "=0.3.92"
wasm-bindgen = "=0.2.115"
web-sys = { version = "=0.3.92", features = [
  "CustomEvent",
  "CustomEventInit",
  "Document",
  "Element",
  "Event",
  "EventTarget",
  "HtmlCollection",
  "HtmlElement",
  "HtmlInputElement",
  "Node",
  "Window",
] }
`;
}

export function remapRustDiagnostic(message, mappings) {
  let rendered = message.rendered ?? `${message.level}: ${message.message}\n`;
  for (const span of message.spans ?? []) {
    const sourcePath = resolve(span.file_name);
    const mapping = mappings.get(sourcePath);
    if (!mapping) continue;
    const sourceLine =
      mapping.startLine + span.line_start - 1 - (mapping.generatedLineOffset ?? 0);
    rendered = rendered.replaceAll(
      `${span.file_name}:${span.line_start}:${span.column_start}`,
      `${mapping.id}:${sourceLine}:${span.column_start}`,
    );
    rendered = rendered.replace(
      new RegExp(`(\\n\\s*)${span.line_start}(\\s+\\|)`),
      `$1${sourceLine}$2`,
    );
  }
  return rendered;
}

function runCargo(root, args, mappings) {
  const result = spawnSync("cargo", [...args, "--message-format=json"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CARGO_TERM_COLOR: "never" },
  });

  if (result.stderr) process.stderr.write(result.stderr);
  for (const line of result.stdout.split(/\r?\n/)) {
    if (!line) continue;
    try {
      const message = JSON.parse(line);
      if (message.reason === "compiler-message") {
        process.stderr.write(remapRustDiagnostic(message.message, mappings));
      }
    } catch {
      process.stderr.write(`${line}\n`);
    }
  }
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Cargo build failed with exit code ${result.status}.`);
}

function writeIfChanged(path, content) {
  mkdirSync(dirname(path), { recursive: true });
  try {
    if (readFileSync(path, "utf8") === content) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  writeFileSync(path, content);
}
