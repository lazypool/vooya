import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";

const run = (command, args) => {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const target = "wasm32-unknown-unknown";
const wasm = "target/wasm32-unknown-unknown/release/voya_core.wasm";
const outDir = "packages/core/dist";

run("cargo", ["build", "--release", "--target", target, "-p", "voya-core"]);
rmSync(outDir, { force: true, recursive: true });
mkdirSync(outDir, { recursive: true });
run("wasm-bindgen", [wasm, "--target", "web", "--out-dir", outDir]);
