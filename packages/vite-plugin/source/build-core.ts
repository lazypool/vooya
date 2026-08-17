// The build core accepts user-owned Vite/Rust configuration whose shape is
// intentionally open-ended. Keep that boundary untyped while the emitted
// public JavaScript surface is migrated to TypeScript source.
// @ts-nocheck
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { CargoBuildError, VooyaUserError } from "./errors.js";
import { resolveToolchain } from "./toolchain.js";
import {
  generateRustComponents,
  generateVooDeclaration,
  generatedAdapterDefinition,
  generatedComponentBinding,
  generatedComponentPrelude,
  parseVooComponent,
} from "@vooya/compiler";

const require = createRequire(import.meta.url);

export const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));

export function resolveRuntimeCrateRoot() {
  return dirname(require.resolve("@vooya/core/rust/Cargo.toml"));
}

export function resolveRustDependencyRoots(rust = {}, applicationRoot) {
  if (!isPlainObject(rust.dependencies)) return [];
  return Object.values(rust.dependencies)
    .filter((specification) => isPlainObject(specification) && specification.path)
    .map((specification) => resolve(applicationRoot, specification.path));
}

export function buildApplication({
  applicationRoot,
  components = [],
  rust = {},
  runtimeCrateRoot = resolveRuntimeCrateRoot(),
  cacheRoot = resolve(applicationRoot, ".voo-cache"),
  outputDir = resolve(cacheRoot, "dist"),
  onRustBuildStart = () => {},
  toolchain = resolveToolchain({ cwd: applicationRoot }),
  spawn = spawnSync,
  exec = execFileSync,
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

  writeIfChanged(
    resolve(cacheRoot, "Cargo.toml"),
    generatedCargoManifest({ applicationRoot, runtimeCrateRoot, rust }),
  );
  writeIfChanged(
    resolve(cacheRoot, "src/lib.rs"),
    `pub use vooya_core::*;\n\n${generateRustComponents(components, sourcePaths)}`,
  );

  // Keep this callback immediately adjacent to Cargo. Consumers use it to
  // report work that has actually begun, rather than merely a queued rebuild.
  onRustBuildStart();
  runCargo(
    toolchain,
    applicationRoot,
    [
      "build",
      "--manifest-path",
      resolve(cacheRoot, "Cargo.toml"),
      "--release",
      "--target",
      toolchain.target.triple,
      "--target-dir",
      targetDir,
    ],
    diagnosticMappings,
    spawn,
  );

  rmSync(outputDir, { force: true, recursive: true });
  mkdirSync(outputDir, { recursive: true });
  try {
    exec(
      toolchain.wasmBindgen.path,
      [
        resolve(targetDir, `${toolchain.target.triple}/release/vooya_app.wasm`),
        "--target",
        "web",
        "--out-dir",
        outputDir,
      ],
      { cwd: applicationRoot, env: toolchain.environment ?? process.env, stdio: "inherit" },
    );
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    throw new VooyaUserError(
      `wasm-bindgen failed using ${toolchain.wasmBindgen.path}: ${detail}`,
      { kind: "wasm-bindgen", cause },
    );
  }

  return {
    cacheRoot,
    runtimeModule: resolve(outputDir, "vooya_app.js"),
  };
}

// Builds the empty runtime artifact shipped by @vooya/core.
export function buildCore(root = repositoryRoot) {
  return buildApplication({
    applicationRoot: root,
    cacheRoot: resolve(root, "target/vooya-package"),
    outputDir: resolve(root, "packages/core/dist"),
  });
}

/**
 * Builds one Vue component source file into the distributable contents of one
 * explicit artifact package. It deliberately has no package discovery or
 * registry behavior: callers name their package root and component source.
 */
export function buildPrecompiledVueArtifact({ packageRoot, source, outputDir } = {}) {
  const root = resolveArtifactPackageRoot(packageRoot);
  const metadata = readArtifactPackageMetadata(root);
  const sourcePath = resolveArtifactSource(root, source);
  const distribution = resolveArtifactOutput(root, outputDir);
  if (metadata.dependencies?.["@vooya/vue"] !== metadata.version) {
    throw new Error(`${metadata.name} must depend on @vooya/vue at its exact package version.`);
  }

  const component = parseVooComponent(readFileSync(sourcePath, "utf8"), sourcePath);
  if (component.format !== "source") {
    throw new Error(`Vooya precompiled Vue artifacts require source .voo input, received ${component.format}.`);
  }
  component.id = sourcePath;
  const definition = generatedAdapterDefinition(component);
  const binding = generatedComponentBinding(component);
  const manifest = {
    formatVersion: 1,
    artifactVersion: metadata.version,
    framework: "vue",
    component: component.name,
    abiVersion: definition.abiVersion,
    bindings: {
      mount: binding.exportName,
      dispose: binding.disposeName,
      updates: binding.updateNames,
    },
    wasm: "./wasm/vooya_app_bg.wasm",
    types: "./index.d.ts",
  };

  rmSync(distribution, { force: true, recursive: true });
  mkdirSync(distribution, { recursive: true });
  buildApplication({
    applicationRoot: root,
    components: [component],
    cacheRoot: resolve(root, ".artifact-build"),
    outputDir: resolve(distribution, "wasm"),
    rust: { webSysFeatures: ["Node", "NodeList"] },
  });
  writeFileSync(resolve(distribution, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(resolve(distribution, "index.js"), generatePrecompiledVueEntry({ manifest, definition, binding }));
  writeFileSync(resolve(distribution, "index.d.ts"), generatePrecompiledVueDeclaration(component, manifest));
  assertArtifactOutput(distribution);
  return manifest;
}

function resolveArtifactPackageRoot(packageRoot) {
  if (typeof packageRoot !== "string" || !packageRoot) {
    throw new Error("Vooya precompiled Vue artifacts require an explicit packageRoot directory.");
  }
  const root = resolve(packageRoot);
  try {
    if (!statSync(root).isDirectory()) throw new Error("not a directory");
  } catch {
    throw new Error(`Vooya precompiled Vue artifact packageRoot must be an existing directory: ${root}.`);
  }
  return root;
}

function readArtifactPackageMetadata(packageRoot) {
  const packageJson = resolve(packageRoot, "package.json");
  if (!existsSync(packageJson)) {
    throw new Error(`Vooya precompiled Vue artifact packageRoot is missing package.json: ${packageRoot}.`);
  }
  const metadata = JSON.parse(readFileSync(packageJson, "utf8"));
  if (typeof metadata.name !== "string" || !metadata.name.trim()) {
    throw new Error("Vooya precompiled Vue artifact package.json must declare a package name.");
  }
  if (typeof metadata.version !== "string" || !isSemverVersion(metadata.version)) {
    throw new Error(`${metadata.name} must declare a valid package version.`);
  }
  return metadata;
}

function resolveArtifactSource(packageRoot, source) {
  if (typeof source !== "string" || !source.endsWith(".voo")) {
    throw new Error("Vooya precompiled Vue artifacts require an explicit source .voo file.");
  }
  const sourcePath = resolve(source);
  if (!isPathInside(sourcePath, packageRoot)) {
    throw new Error("Vooya precompiled Vue artifact source must stay inside packageRoot.");
  }
  try {
    if (!statSync(sourcePath).isFile()) throw new Error("not a file");
  } catch {
    throw new Error(`Vooya precompiled Vue artifact source must be an existing file: ${sourcePath}.`);
  }
  return sourcePath;
}

function resolveArtifactOutput(packageRoot, outputDir) {
  const expected = resolve(packageRoot, "dist");
  const output = resolve(outputDir ?? expected);
  if (output !== expected) {
    throw new Error(`Vooya precompiled Vue artifact output must be packageRoot/dist: ${expected}.`);
  }
  return output;
}

function assertArtifactOutput(outputDir) {
  const expected = ["manifest.json", "index.js", "index.d.ts", "wasm/vooya_app.js", "wasm/vooya_app_bg.wasm"];
  for (const file of expected) {
    if (!existsSync(resolve(outputDir, file))) {
      throw new Error(`Vooya precompiled Vue artifact build did not produce expected output ${file}.`);
    }
  }
}

function isSemverVersion(version) {
  return /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(version);
}

function isPathInside(path, directory) {
  const relativePath = relative(directory, path);
  return relativePath === "" || (!relativePath.startsWith("..") && !isAbsolute(relativePath));
}

function generatePrecompiledVueEntry({ manifest, definition, binding }) {
  const imports = [binding.exportName, binding.disposeName, ...Object.values(binding.updateNames), "voo_abi_version"];
  const updates = Object.entries(binding.updateNames)
    .map(([prop, name]) => `update_${prop}(value) { ${name}(handle, value); }`)
    .join(", ");
  return `// Generated by @vooya/vite-plugin/build. Do not edit.
import init, { ${imports.join(", ")} } from "./wasm/vooya_app.js";
import { defineVooyaComponent } from "@vooya/vue";

export const manifest = ${JSON.stringify(manifest, null, 2)};
const definition = ${JSON.stringify(definition, null, 2)};
let bindings;

export function assertArtifactAbi(actual) {
  if (actual !== manifest.abiVersion) {
    throw new Error(\`Vooya artifact ABI mismatch for \${manifest.component}: artifact expects \${manifest.abiVersion}, but WASM provides \${String(actual)}.\`);
  }
}

async function loadBindings() {
  if (!bindings) {
    bindings = Promise.resolve(init()).then(() => {
      assertArtifactAbi(voo_abi_version());
      return {
        mount(host, ...props) {
          const handle = ${binding.exportName}(host, ...props);
          return { dispose() { ${binding.disposeName}(handle); }, ${updates} };
        },
      };
    });
  }
  return bindings;
}

export default defineVooyaComponent(definition, loadBindings);
`;
}

function generatePrecompiledVueDeclaration(component, manifest) {
  const declaration = generateVooDeclaration(component, "vue").replace(
    "// Generated by @vooya/vite-plugin. Do not edit.",
    "// Generated by @vooya/vite-plugin/build. Do not edit.",
  );
  return `${declaration}
export interface VooyaArtifactManifest {
  formatVersion: 1;
  artifactVersion: string;
  framework: "vue";
  component: ${JSON.stringify(manifest.component)};
  abiVersion: number;
  bindings: { mount: string; dispose: string; updates: Record<string, string> };
  wasm: string;
  types: string;
}

export const manifest: VooyaArtifactManifest;
export function assertArtifactAbi(actual: number): void;
`;
}

export function generatedCargoManifest({ applicationRoot, runtimeCrateRoot, rust = {} }) {
  const webSysFeatures = mergedWebSysFeatures(rust.webSysFeatures);
  const dependencies = generatedUserDependencies(rust.dependencies, applicationRoot);
  return `[package]
name = "vooya-app"
version = "0.0.0"
edition = "2024"

[workspace]

[lib]
crate-type = ["cdylib"]

[dependencies]
vooya-core = { path = ${JSON.stringify(runtimeCrateRoot)} }
js-sys = "=0.3.92"
wasm-bindgen = "=0.2.115"
web-sys = { version = "=0.3.92", features = [
${webSysFeatures.map((feature) => `  ${JSON.stringify(feature)},`).join("\n")}
] }
${dependencies}
`;
}

const builtInWebSysFeatures = [
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
];

const reservedDependencies = new Set(["js-sys", "vooya-core", "wasm-bindgen", "web-sys"]);
const dependencyKeys = new Set([
  "branch",
  "defaultFeatures",
  "features",
  "git",
  "package",
  "path",
  "rev",
  "tag",
  "version",
]);

function mergedWebSysFeatures(features = []) {
  if (!Array.isArray(features)) throw new Error("Vooya rust.webSysFeatures must be an array.");
  for (const feature of features) {
    if (typeof feature !== "string" || !/^[A-Za-z][A-Za-z0-9]*$/.test(feature)) {
      throw new Error(`Invalid web-sys feature ${JSON.stringify(feature)}.`);
    }
  }
  return [...new Set([...builtInWebSysFeatures, ...features])].sort();
}

function generatedUserDependencies(dependencies = {}, applicationRoot) {
  if (!isPlainObject(dependencies)) {
    throw new Error("Vooya rust.dependencies must be an object.");
  }
  return Object.entries(dependencies)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, specification]) => {
      if (!/^[A-Za-z0-9_-]+$/.test(name)) {
        throw new Error(`Invalid Rust dependency name ${JSON.stringify(name)}.`);
      }
      if (reservedDependencies.has(name)) {
        throw new Error(
          `Rust dependency ${JSON.stringify(name)} is managed by Vooya and cannot be overridden.`,
        );
      }
      return `${JSON.stringify(name)} = ${generatedDependencySpecification(
        name,
        specification,
        applicationRoot,
      )}`;
    })
    .join("\n");
}

function generatedDependencySpecification(name, specification, applicationRoot) {
  if (typeof specification === "string" && specification) {
    return JSON.stringify(specification);
  }
  if (!isPlainObject(specification)) {
    throw new Error(`Rust dependency ${JSON.stringify(name)} must be a version or an object.`);
  }
  const unknown = Object.keys(specification).filter((key) => !dependencyKeys.has(key));
  if (unknown.length > 0) {
    throw new Error(
      `Rust dependency ${JSON.stringify(name)} has unsupported option ${JSON.stringify(unknown[0])}.`,
    );
  }
  if (!specification.version && !specification.path && !specification.git) {
    throw new Error(
      `Rust dependency ${JSON.stringify(name)} requires version, path, or git.`,
    );
  }
  if (specification.path && specification.git) {
    throw new Error(`Rust dependency ${JSON.stringify(name)} cannot combine path and git.`);
  }
  const gitReferences = ["branch", "tag", "rev"].filter((key) => specification[key]);
  if (gitReferences.length > 0 && !specification.git) {
    throw new Error(
      `Rust dependency ${JSON.stringify(name)} option ${gitReferences[0]} requires git.`,
    );
  }
  if (gitReferences.length > 1) {
    throw new Error(
      `Rust dependency ${JSON.stringify(name)} can use only one of branch, tag, or rev.`,
    );
  }

  const values = [];
  for (const key of ["version", "path", "git", "branch", "tag", "rev", "package"]) {
    const value = specification[key];
    if (value === undefined) continue;
    if (typeof value !== "string" || !value) {
      throw new Error(`Rust dependency ${JSON.stringify(name)} option ${key} must be a string.`);
    }
    const rendered = key === "path" ? resolve(applicationRoot, value) : value;
    values.push(`${key} = ${JSON.stringify(rendered)}`);
  }
  if (specification.defaultFeatures !== undefined) {
    if (typeof specification.defaultFeatures !== "boolean") {
      throw new Error(
        `Rust dependency ${JSON.stringify(name)} option defaultFeatures must be a boolean.`,
      );
    }
    values.push(`default-features = ${specification.defaultFeatures}`);
  }
  if (specification.features !== undefined) {
    if (
      !Array.isArray(specification.features) ||
      specification.features.some((feature) => typeof feature !== "string" || !feature)
    ) {
      throw new Error(
        `Rust dependency ${JSON.stringify(name)} option features must be a string array.`,
      );
    }
    values.push(
      `features = [${specification.features.map((feature) => JSON.stringify(feature)).join(", ")}]`,
    );
  }
  return `{ ${values.join(", ")} }`;
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
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

function runCargo(toolchain, root, args, mappings, spawn) {
  const result = spawn(toolchain.cargo.path, [...args, "--message-format=json"], {
    cwd: root,
    encoding: "utf8",
    env: { ...(toolchain.environment ?? process.env), CARGO_TERM_COLOR: "never" },
  });

  const stderr = result.stderr ?? "";
  const stdout = result.stdout ?? "";
  if (stderr) process.stderr.write(stderr);
  for (const line of stdout.split(/\r?\n/)) {
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
  if (result.error) {
    const detail = result.error instanceof Error ? result.error.message : String(result.error);
    throw new VooyaUserError(
      `Could not start Cargo at ${toolchain.cargo.path}: ${detail}`,
      { kind: "cargo-start", cause: result.error },
    );
  }
  if (result.status !== 0) {
    throw new CargoBuildError(
      `Cargo build failed with exit code ${result.status} using cargo ${toolchain.cargo.path} and rustc ${toolchain.rustc.path}.`,
      {
        cargoPath: toolchain.cargo.path,
        rustcPath: toolchain.rustc.path,
        exitCode: result.status,
      },
    );
  }
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
