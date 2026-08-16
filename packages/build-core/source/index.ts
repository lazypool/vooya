// This package is intentionally bundler-neutral: adapters own virtual modules,
// watching and presentation, while this module owns the Rust/WASM application build.
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";

import {
  compileVooStyle,
  generateRustComponents,
  generateVooDeclaration,
  generatedAdapterDefinition,
  generatedComponentPrelude,
} from "@vooya/compiler";
import type { SourceComponent } from "@vooya/compiler";

const require = createRequire(import.meta.url);

export type RustDependency =
  | string
  | {
      version?: string;
      path?: string;
      git?: string;
      branch?: string;
      tag?: string;
      rev?: string;
      package?: string;
      defaultFeatures?: boolean;
      features?: string[];
    };

export interface RustBuildOptions {
  dependencies?: Record<string, RustDependency>;
  webSysFeatures?: string[];
}

export type MappedDiagnostic = string;
export interface BuildAsset { path: string; code: string }
export interface WasmAsset { path: string; bytes: Uint8Array }
export interface GeneratedCss { componentId: string; code: string }
export interface GeneratedDeclaration {
  componentId: string;
  framework: "vue" | "react";
  code: string;
}
export interface BuildMetadata {
  buildMode: "production" | "development";
  abiVersions: number[];
  wasmBindgenTarget: "web";
}

export interface BuildApplicationOptions {
  applicationRoot: string;
  components?: SourceComponent[];
  rust?: RustBuildOptions;
  runtimeCrateRoot?: string;
  cacheRoot?: string;
  workspacePath?: string;
  outputDir?: string;
  buildMode?: "production" | "development";
  framework?: "vue" | "react";
  onRustBuildStart?: () => void;
}

export interface BuildApplicationResult {
  cacheRoot: string;
  runtimeModule: string;
  javascript: BuildAsset;
  wasm: WasmAsset;
  css: GeneratedCss[];
  declarations: GeneratedDeclaration[];
  watchedFiles: string[];
  diagnostics: MappedDiagnostic[];
  metadata: BuildMetadata;
}

interface DiagnosticMapping {
  id: string;
  startLine: number;
  generatedLineOffset: number;
}

interface CargoDiagnostic {
  level?: string;
  message: string;
  rendered?: string;
  spans?: Array<{
    file_name: string;
    line_start: number;
    column_start: number;
  }>;
}

export function resolveRuntimeCrateRoot(): string {
  return dirname(require.resolve("@vooya/core/rust/Cargo.toml"));
}

export function resolveRustDependencyRoots(
  rust: RustBuildOptions = {},
  applicationRoot: string,
): string[] {
  return Object.values(rust.dependencies ?? {})
    .filter(
      (specification): specification is Exclude<RustDependency, string> =>
        typeof specification !== "string" && typeof specification.path === "string",
    )
    .map((specification) => resolve(applicationRoot, specification.path as string));
}

/**
 * Build compiler results into a reusable WASM application artifact. `components`
 * are the parsed `.voo` compiler results; callers retain all bundler-specific IO.
 */
export function buildApplication({
  applicationRoot,
  components = [],
  rust = {},
  runtimeCrateRoot = resolveRuntimeCrateRoot(),
  cacheRoot = resolve(applicationRoot, ".voo-cache"),
  workspacePath = cacheRoot,
  outputDir = resolve(cacheRoot, "dist"),
  buildMode = "production",
  framework = "vue",
  onRustBuildStart = () => {},
}: BuildApplicationOptions): BuildApplicationResult {
  if (!applicationRoot) throw new Error("Vooya build requires applicationRoot.");

  const sourceDir = resolve(workspacePath, "src/components");
  const targetDir = resolve(workspacePath, "target");
  const sourcePaths = new Map<string | undefined, string>();
  const diagnosticMappings = new Map<string, DiagnosticMapping>();

  mkdirSync(sourceDir, { recursive: true });
  for (const [index, component] of components.entries()) {
    const sourcePath = resolve(sourceDir, `${index}-${component.name}.rs`);
    const prelude = generatedComponentPrelude(component);
    writeIfChanged(sourcePath, `${prelude}${component.rust.content}\n`);
    sourcePaths.set(component.id, sourcePath);
    diagnosticMappings.set(sourcePath, {
      id: component.id ?? component.name,
      startLine: component.rust.startLine,
      generatedLineOffset: prelude.split(/\r?\n/).length - 1,
    });
  }

  writeIfChanged(
    resolve(workspacePath, "Cargo.toml"),
    generatedCargoManifest({ applicationRoot, runtimeCrateRoot, rust }),
  );
  writeIfChanged(
    resolve(workspacePath, "src/lib.rs"),
    `pub use vooya_core::*;\n\n${generateRustComponents(components, sourcePaths)}`,
  );

  onRustBuildStart();
  const diagnostics = runCargo(
    applicationRoot,
    [
      "build",
      "--manifest-path",
      resolve(workspacePath, "Cargo.toml"),
      ...(buildMode === "development" ? [] : ["--release"]),
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
      resolve(
        targetDir,
        `wasm32-unknown-unknown/${buildMode === "development" ? "debug" : "release"}/vooya_app.wasm`,
      ),
      "--target",
      "web",
      "--out-dir",
      outputDir,
    ],
    { cwd: applicationRoot, stdio: "inherit" },
  );

  const runtimeModule = resolve(outputDir, "vooya_app.js");
  const wasm = resolve(outputDir, "vooya_app_bg.wasm");
  return {
    cacheRoot: workspacePath,
    runtimeModule,
    javascript: { path: runtimeModule, code: readFileSync(runtimeModule, "utf8") },
    wasm: { path: wasm, bytes: new Uint8Array(readFileSync(wasm)) },
    css: components
      .filter((component) => component.style)
      .map((component) => ({
        componentId: component.id ?? component.name,
        code: compileVooStyle(component),
      })),
    declarations: components.map((component) => ({
      componentId: component.id ?? component.name,
      framework,
      code: generateVooDeclaration(component, framework),
    })),
    watchedFiles: [
      resolve(runtimeCrateRoot, "src"),
      ...resolveRustDependencyRoots(rust, applicationRoot),
    ],
    diagnostics,
    metadata: {
      buildMode,
      abiVersions: components.map(
        (component) => generatedAdapterDefinition(component).abiVersion,
      ),
      wasmBindgenTarget: "web",
    },
  };
}

// Builds the empty runtime artifact shipped by @vooya/core without depending on
// the Vite package. The root is supplied by the repository build script.
export function buildCore(root = process.cwd()): BuildApplicationResult {
  return buildApplication({
    applicationRoot: root,
    cacheRoot: resolve(root, "target/vooya-package"),
    outputDir: resolve(root, "packages/core/dist"),
  });
}

export function generatedCargoManifest({
  applicationRoot,
  runtimeCrateRoot,
  rust = {},
}: {
  applicationRoot: string;
  runtimeCrateRoot: string;
  rust?: RustBuildOptions;
}): string {
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
${mergedWebSysFeatures(rust.webSysFeatures)
  .map((feature) => `  ${JSON.stringify(feature)},`)
  .join("\n")}
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

function mergedWebSysFeatures(features: string[] = []): string[] {
  for (const feature of features) {
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(feature)) {
      throw new Error(`Invalid web-sys feature ${JSON.stringify(feature)}.`);
    }
  }
  return [...new Set([...builtInWebSysFeatures, ...features])].sort();
}

function generatedUserDependencies(
  dependencies: Record<string, RustDependency> = {},
  applicationRoot: string,
): string {
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

function generatedDependencySpecification(
  name: string,
  specification: RustDependency,
  root: string,
): string {
  if (typeof specification === "string") {
    if (!specification) throw new Error(`Rust dependency ${JSON.stringify(name)} must not be empty.`);
    return JSON.stringify(specification);
  }

  const unknown = Object.keys(specification).find((key) => !dependencyKeys.has(key));
  if (unknown) {
    throw new Error(
      `Rust dependency ${JSON.stringify(name)} has unsupported option ${JSON.stringify(unknown)}.`,
    );
  }
  if (!specification.version && !specification.path && !specification.git) {
    throw new Error(`Rust dependency ${JSON.stringify(name)} requires version, path, or git.`);
  }
  if (specification.path && specification.git) {
    throw new Error(`Rust dependency ${JSON.stringify(name)} cannot combine path and git.`);
  }

  const references = ["branch", "tag", "rev"].filter(
    (key) => specification[key as "branch" | "tag" | "rev"],
  );
  if (references.length > 0 && !specification.git) {
    throw new Error(
      `Rust dependency ${JSON.stringify(name)} option ${references[0]} requires git.`,
    );
  }
  if (references.length > 1) {
    throw new Error(
      `Rust dependency ${JSON.stringify(name)} can use only one of branch, tag, or rev.`,
    );
  }

  const values: string[] = [];
  for (const key of ["version", "path", "git", "branch", "tag", "rev", "package"] as const) {
    const value = specification[key];
    if (value === undefined) continue;
    if (!value) {
      throw new Error(`Rust dependency ${JSON.stringify(name)} option ${key} must be a string.`);
    }
    values.push(`${key} = ${JSON.stringify(key === "path" ? resolve(root, value) : value)}`);
  }
  if (specification.defaultFeatures !== undefined) {
    values.push(`default-features = ${specification.defaultFeatures}`);
  }
  if (specification.features !== undefined) {
    if (specification.features.some((feature) => !feature)) {
      throw new Error(
        `Rust dependency ${JSON.stringify(name)} option features must be a string array.`,
      );
    }
    values.push(
      `features = [${specification.features
        .map((feature) => JSON.stringify(feature))
        .join(", ")}]`,
    );
  }
  return `{ ${values.join(", ")} }`;
}

export function remapRustDiagnostic(
  message: CargoDiagnostic,
  mappings: Map<string, DiagnosticMapping>,
): string {
  let rendered = message.rendered ?? `${message.level ?? "error"}: ${message.message}\n`;
  for (const span of message.spans ?? []) {
    const mapping = mappings.get(resolve(span.file_name));
    if (!mapping) continue;
    const line = mapping.startLine + span.line_start - 1 - mapping.generatedLineOffset;
    rendered = rendered
      .replaceAll(
        `${span.file_name}:${span.line_start}:${span.column_start}`,
        `${mapping.id}:${line}:${span.column_start}`,
      )
      .replace(new RegExp(`(\\n\\s*)${span.line_start}(\\s+\\|)`), `$1${line}$2`);
  }
  return rendered;
}

function runCargo(
  root: string,
  args: string[],
  mappings: Map<string, DiagnosticMapping>,
): MappedDiagnostic[] {
  const result = spawnSync("cargo", [...args, "--message-format=json"], {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, CARGO_TERM_COLOR: "never" },
  });
  const diagnostics: MappedDiagnostic[] = [];
  if (result.stderr) process.stderr.write(result.stderr);
  for (const line of (result.stdout ?? "").split(/\r?\n/)) {
    if (!line) continue;
    try {
      const message = JSON.parse(line) as { reason?: string; message?: CargoDiagnostic };
      if (message.reason === "compiler-message" && message.message) {
        const mapped = remapRustDiagnostic(message.message, mappings);
        diagnostics.push(mapped);
        process.stderr.write(mapped);
      }
    } catch {
      process.stderr.write(`${line}\n`);
    }
  }
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`Cargo build failed with exit code ${result.status}.`);
  }
  return diagnostics;
}

function writeIfChanged(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true });
  try {
    if (readFileSync(path, "utf8") === content) return;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) throw error;
  }
  writeFileSync(path, content);
}
