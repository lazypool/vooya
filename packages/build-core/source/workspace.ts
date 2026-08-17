import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  rmdirSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, parse, relative, resolve } from "node:path";

import { generateVooDeclaration } from "@vooya/compiler";
import type { ParsedComponent } from "@vooya/compiler";

export const VOOYA_WORKSPACE_SCHEMA_VERSION = 1;

export interface VooyaWorkspacePaths {
  root: string;
  build: string;
  wasm: string;
  types: string;
  cache: string;
  metadata: string;
}

export interface VooyaWorkspaceMetadata {
  product: "vooya";
  schemaVersion: number;
  abiVersions?: number[];
  toolchain?: {
    cargo: string;
    rustc: string;
    target: string;
    wasmBindgen: string;
  };
}

export interface WriteVooDeclarationsOptions {
  applicationRoot: string;
  components: ParsedComponent[];
  framework: "vue" | "react";
  workspaceRoot?: string;
}

export interface WrittenVooDeclarations {
  typesRoot: string;
  files: string[];
}

export function resolveVooyaWorkspace(
  applicationRoot: string,
  workspaceRoot?: string,
): VooyaWorkspacePaths {
  const application = resolve(applicationRoot);
  const root = resolve(application, workspaceRoot ?? ".vooya");
  if (root === application || root === parse(root).root) {
    throw new Error(
      `Vooya workspace root must be a dedicated directory, received ${root}.`,
    );
  }
  return {
    root,
    build: resolve(root, "build"),
    wasm: resolve(root, "wasm"),
    types: resolve(root, "types"),
    cache: resolve(root, "cache"),
    metadata: resolve(root, "metadata.json"),
  };
}

export function ensureVooyaWorkspace(paths: VooyaWorkspacePaths): void {
  const previous = readWorkspaceMetadata(paths);
  if (
    previous &&
    (previous.product !== "vooya" ||
      previous.schemaVersion !== VOOYA_WORKSPACE_SCHEMA_VERSION)
  ) {
    removeGeneratedEntries(paths);
  }
  for (const directory of [
    paths.root,
    paths.build,
    paths.wasm,
    paths.types,
    paths.cache,
  ]) {
    mkdirSync(directory, { recursive: true });
  }
  writeWorkspaceMetadata(paths, {});
}

export function writeWorkspaceMetadata(
  paths: VooyaWorkspacePaths,
  metadata: Omit<VooyaWorkspaceMetadata, "product" | "schemaVersion">,
): void {
  mkdirSync(paths.root, { recursive: true });
  const current = readWorkspaceMetadata(paths);
  const value: VooyaWorkspaceMetadata = {
    product: "vooya",
    schemaVersion: VOOYA_WORKSPACE_SCHEMA_VERSION,
    ...(current?.product === "vooya" &&
    current.schemaVersion === VOOYA_WORKSPACE_SCHEMA_VERSION
      ? current
      : {}),
    ...metadata,
  };
  writeIfChanged(paths.metadata, `${JSON.stringify(value, null, 2)}\n`);
}

export function cleanVooyaWorkspace(
  applicationRoot: string,
  workspaceRoot?: string,
): VooyaWorkspacePaths {
  const paths = resolveVooyaWorkspace(applicationRoot, workspaceRoot);
  removeGeneratedEntries(paths);
  if (existsSync(paths.root) && readdirSync(paths.root).length === 0) {
    rmdirSync(paths.root);
  }
  return paths;
}

export function writeVooDeclarations({
  applicationRoot,
  components,
  framework,
  workspaceRoot,
}: WriteVooDeclarationsOptions): WrittenVooDeclarations {
  const application = resolve(applicationRoot);
  const paths = resolveVooyaWorkspace(application, workspaceRoot);
  ensureVooyaWorkspace(paths);

  const expected = new Set<string>();
  for (const component of components) {
    if (component.format !== "source") continue;
    if (!component.id) {
      throw new Error(`Vooya component ${component.name} is missing its source path.`);
    }
    const componentPath = resolve(component.id);
    const sourceRelativePath = relative(application, componentPath);
    if (
      sourceRelativePath === "" ||
      isAbsolute(sourceRelativePath) ||
      sourceRelativePath === ".." ||
      sourceRelativePath.startsWith("../") ||
      sourceRelativePath.startsWith("..\\")
    ) {
      throw new Error(
        `Vooya component ${component.id} must be inside application root ${application}.`,
      );
    }
    if (!sourceRelativePath.endsWith(".voo")) {
      throw new Error(`Vooya component ${component.id} must end in .voo.`);
    }
    const declarationPath = resolve(
      paths.types,
      sourceRelativePath.replace(/\.voo$/, ".d.voo.ts"),
    );
    assertPathInside(declarationPath, paths.types);
    expected.add(declarationPath);
    rmSync(componentPath.replace(/\.voo$/, ".d.voo.ts"), { force: true });
    writeIfChanged(
      declarationPath,
      generateVooDeclaration(component, framework),
    );
  }

  for (const existing of readGeneratedDeclarations(paths.types)) {
    if (!expected.has(existing)) rmSync(existing, { force: true });
  }
  removeEmptyDirectories(paths.types, paths.types);
  return { typesRoot: paths.types, files: [...expected].sort() };
}

function readWorkspaceMetadata(
  paths: VooyaWorkspacePaths,
): VooyaWorkspaceMetadata | undefined {
  if (!existsSync(paths.metadata)) return undefined;
  try {
    return JSON.parse(readFileSync(paths.metadata, "utf8"));
  } catch (cause) {
    throw new Error(
      `Vooya workspace metadata is invalid at ${paths.metadata}. Run \`vooya clean\` and try again.`,
      { cause },
    );
  }
}

function removeGeneratedEntries(paths: VooyaWorkspacePaths): void {
  for (const path of [
    paths.build,
    paths.wasm,
    paths.types,
    paths.cache,
    paths.metadata,
  ]) {
    rmSync(path, { force: true, recursive: true });
  }
}

function readGeneratedDeclarations(directory: string): string[] {
  if (!existsSync(directory)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...readGeneratedDeclarations(path));
    else if (entry.isFile() && entry.name.endsWith(".d.voo.ts")) files.push(path);
  }
  return files;
}

function removeEmptyDirectories(directory: string, root: string): void {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirectories(resolve(directory, entry.name), root);
  }
  if (directory !== root && readdirSync(directory).length === 0) {
    rmdirSync(directory);
  }
}

function assertPathInside(path: string, directory: string): void {
  const relativePath = relative(directory, path);
  if (
    relativePath === "" ||
    isAbsolute(relativePath) ||
    relativePath === ".." ||
    relativePath.startsWith("../") ||
    relativePath.startsWith("..\\")
  ) {
    throw new Error(`Generated path ${path} escapes Vooya workspace ${directory}.`);
  }
}

function writeIfChanged(path: string, content: string): void {
  try {
    if (readFileSync(path, "utf8") === content) return;
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
}
