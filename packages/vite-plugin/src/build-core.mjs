import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { generateRustComponents, generatedComponentPrelude } from "./voo-codegen.js";

export const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));

export function buildCore(root = repositoryRoot, components = []) {
  const run = (command, args) => {
    execFileSync(command, args, { cwd: root, stdio: "inherit" });
  };
  const outDir = "packages/core/dist";
  const generatedDir = resolve(root, "target/voya");
  const sourceDir = resolve(generatedDir, "components");
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
  writeIfChanged(
    resolve(generatedDir, "generated_components.rs"),
    generateRustComponents(components, sourcePaths),
  );

  runCargo(root, [
    "build",
    "--release",
    "--target",
    "wasm32-unknown-unknown",
    "-p",
    "voya-core",
  ], diagnosticMappings);
  rmSync(new URL(`../../../${outDir}`, import.meta.url), { force: true, recursive: true });
  mkdirSync(new URL(`../../../${outDir}`, import.meta.url), { recursive: true });
  run("wasm-bindgen", [
    "target/wasm32-unknown-unknown/release/voya_core.wasm",
    "--target",
    "web",
    "--out-dir",
    outDir,
  ]);
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
  try {
    if (readFileSync(path, "utf8") === content) return;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  writeFileSync(path, content);
}
