// This package has no Rspack runtime dependency. It uses Rspack's plugin and
// loader protocols structurally so one built package spans the verified 1.x/2.x range.
// @ts-nocheck
import { readdirSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { buildApplication } from "@vooya/build-core";
import { compileVooStyle, generateVooDeclaration, parseVooComponent } from "@vooya/compiler";

import { deleteBuildState, getBuildState, setBuildState } from "./state.js";

const loaderPath = fileURLToPath(new URL("./loader.js", import.meta.url));
const ignoredDirectories = new Set([".git", ".voo-cache", ".vooya", "dist", "node_modules", "target"]);
let nextInstance = 0;

export function vooyaRspack(options = {}) {
  return new VooyaRspackPlugin(options);
}

export class VooyaRspackPlugin {
  constructor({ framework = "vue", rust = {}, cacheRoot } = {}) {
    if (framework !== "vue" && framework !== "react") throw new Error(`Unknown Vooya framework ${framework}.`);
    this.framework = framework;
    this.rust = rust;
    this.cacheRoot = cacheRoot;
    this.instanceId = `vooya-rspack-${nextInstance++}`;
    this.buildError = undefined;
  }

  rule() {
    return {
      test: /\.voo$/,
      loader: loaderPath,
      options: { framework: this.framework, instanceId: this.instanceId },
    };
  }

  apply(compiler) {
    compiler.hooks.beforeCompile.tapPromise("vooya", async () => {
      try {
        const applicationRoot = compiler.context;
        const components = readVooComponents(applicationRoot);
        const workspacePath = resolve(this.cacheRoot ?? resolve(applicationRoot, ".voo-cache"), "rspack");
        const result = buildApplication({
          applicationRoot,
          components,
          rust: this.rust,
          cacheRoot: workspacePath,
          workspacePath,
          outputDir: resolve(workspacePath, "dist"),
          buildMode: compiler.options.mode === "development" ? "development" : "production",
        });
        const styleModules = writeGeneratedFiles({ components, framework: this.framework, workspacePath });
        setBuildState(this.instanceId, {
          runtimeModule: result.runtimeModule,
          wasm: result.wasm.bytes,
          styleModules,
          watchedFiles: result.watchedFiles,
        });
        this.buildError = undefined;
      } catch (error) {
        // A rejected `beforeCompile` promise stops Rspack's watch cycle after
        // a Rust error. Preserve the last good build state and surface the
        // failure on this compilation instead, so the next source edit can
        // rebuild and recover without restarting the dev server.
        this.buildError = error instanceof Error ? error : new Error(String(error));
      }
    });
    compiler.hooks.thisCompilation.tap("vooya", (compilation) => {
      if (this.buildError) compilation.errors.push(this.buildError);
      const state = getBuildState(this.instanceId);
      if (!state) return;
      for (const dependency of state.watchedFiles) compilation.contextDependencies.add(dependency);
      // wasm-bindgen's web target references `vooya_app_bg.wasm` relative to
      // its JavaScript module. Rsbuild discovers that asset itself, while
      // Rslib's bundled-library path does not; registering it here gives both
      // paths a loadable, deterministic emitted asset.
      compilation.emitAsset(
        "vooya_app_bg.wasm",
        new compiler.rspack.sources.RawSource(state.wasm),
      );
    });
    compiler.hooks.watchClose.tap("vooya", () => deleteBuildState(this.instanceId));
  }
}

export function vooyaRsbuild(options = {}) {
  const plugin = vooyaRspack(options);
  return {
    name: "vooya-rsbuild",
    setup(api) {
      api.modifyRspackConfig((config) => {
        config.plugins ??= [];
        config.plugins.push(plugin);
        config.module ??= {};
        config.module.rules ??= [];
        config.module.rules.push(plugin.rule());
        return config;
      });
    },
  };
}

function readVooComponents(root) {
  return readVooFiles(root).map((id) => {
    const component = parseVooComponent(readFileSync(id, "utf8"), id);
    component.id = id;
    return component;
  }).filter((component) => component.format === "source");
}

function readVooFiles(directory) {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...readVooFiles(path));
    else if (entry.isFile() && entry.name.endsWith(".voo")) files.push(path);
  }
  return files;
}

function writeGeneratedFiles({ components, framework, workspacePath }) {
  const styles = new Map();
  for (const component of components) {
    writeFileSync(component.id.replace(/\.voo$/, ".d.voo.ts"), generateVooDeclaration(component, framework));
    if (!component.style) continue;
    const stylePath = resolve(workspacePath, "styles", `${component.name}.css`);
    mkdirSync(dirname(stylePath), { recursive: true });
    writeFileSync(stylePath, compileVooStyle(component));
    styles.set(component.id, stylePath);
  }
  return styles;
}
