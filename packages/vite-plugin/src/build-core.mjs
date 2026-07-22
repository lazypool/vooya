import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const repositoryRoot = fileURLToPath(new URL("../../..", import.meta.url));

export function buildCore(root = repositoryRoot) {
  const run = (command, args) => {
    execFileSync(command, args, { cwd: root, stdio: "inherit" });
  };
  const outDir = "packages/core/dist";

  run("cargo", [
    "build",
    "--release",
    "--target",
    "wasm32-unknown-unknown",
    "-p",
    "voya-core",
  ]);
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
