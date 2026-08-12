import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import { resolve, sep } from "node:path";

export const WASM_BINDGEN_VERSION = "0.2.115";
export const WASM_TARGET = "wasm32-unknown-unknown";

/**
 * Inspect the Rust programs that a Vite process will inherit from PATH.
 * The function is intentionally dependency-free so `vooya doctor` can run
 * before a Vite project has successfully compiled.
 */
export function inspectToolchain({ env = process.env, run = runCommand } = {}) {
  const cargo = probe("cargo", ["--version"], run);
  const rustc = probe("rustc", ["--version"], run);
  const sysroot = probe("rustc", ["--print", "sysroot"], run);
  const wasmBindgen = probe("wasm-bindgen", ["--version"], run);
  const rustupTargets = probe("rustup", ["target", "list", "--installed"], run);
  const cargoPath = findExecutable("cargo", env.PATH, run);
  const rustcPath = findExecutable("rustc", env.PATH, run);
  const wasmBindgenPath = findExecutable("wasm-bindgen", env.PATH, run);
  const rustupHome = env.RUSTUP_HOME ?? resolve(homedir(), ".rustup");
  const expectedSysrootPrefix = resolve(rustupHome, "toolchains");

  const results = [];
  results.push(check("cargo", Boolean(cargo.value), cargo.value ?? cargo.error));
  results.push(check("rustc", Boolean(rustc.value), rustc.value ?? rustc.error));
  const targetInstalled = rustupTargets.value?.split(/\r?\n/).includes(WASM_TARGET) ?? false;
  results.push(
    check(
      `Rust target ${WASM_TARGET}`,
      targetInstalled,
      targetInstalled
        ? "installed"
        : `Install it with: rustup target add ${WASM_TARGET}`,
    ),
  );
  const wasmBindgenMatches = wasmBindgen.value?.match(/(\d+\.\d+\.\d+)/)?.[1] === WASM_BINDGEN_VERSION;
  results.push(
    check(
      `wasm-bindgen ${WASM_BINDGEN_VERSION}`,
      wasmBindgenMatches,
      wasmBindgenMatches
        ? `installed (${wasmBindgen.value})`
        : wasmBindgen.value
          ? `Found ${wasmBindgen.value}. Install the pinned CLI with: cargo install -f wasm-bindgen-cli --version ${WASM_BINDGEN_VERSION}`
          : `Install it with: cargo install wasm-bindgen-cli --version ${WASM_BINDGEN_VERSION}`,
    ),
  );

  const sysrootIsRustup = Boolean(sysroot.value && isPathInside(sysroot.value, expectedSysrootPrefix));
  results.push({
    name: "cargo/rustc toolchain",
    status: sysrootIsRustup ? "ok" : "warning",
    detail: sysrootIsRustup
      ? `rustup sysroot: ${sysroot.value}`
      : `rustc sysroot: ${sysroot.value ?? "unavailable"}. Vooya uses PATH, and this is not a rustup toolchain. If builds cannot find ${WASM_TARGET}, put ${resolve(homedir(), ".cargo/bin")} before Homebrew in PATH.`,
  });

  return {
    cargo: cargo.value,
    cargoPath,
    rustc: rustc.value,
    rustcPath,
    sysroot: sysroot.value,
    wasmBindgen: wasmBindgen.value,
    wasmBindgenPath,
    results,
    ok: results.every((result) => result.status !== "error"),
  };
}

export function formatToolchainReport(report) {
  const lines = ["Vooya doctor", ""];
  for (const result of report.results) {
    const label = result.status === "ok" ? "ok" : result.status === "warning" ? "warning" : "error";
    lines.push(`[${label}] ${result.name}: ${result.detail}`);
  }
  lines.push("", `cargo: ${report.cargoPath ?? "not found"}`);
  lines.push(`rustc: ${report.rustcPath ?? "not found"}`);
  lines.push(`wasm-bindgen: ${report.wasmBindgenPath ?? "not found"}`);
  return lines.join("\n");
}

function check(name, passed, detail) {
  return { name, status: passed ? "ok" : "error", detail: detail ?? "available" };
}

function probe(command, args, run) {
  try {
    return { value: run(command, args) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function findExecutable(command, path, run) {
  if (!path) return undefined;
  try {
    return run("which", [command]);
  } catch {
    return undefined;
  }
}

function runCommand(command, args) {
  return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function isPathInside(path, directory) {
  const normalizedPath = resolve(path);
  const normalizedDirectory = resolve(directory);
  return normalizedPath === normalizedDirectory || normalizedPath.startsWith(`${normalizedDirectory}${sep}`);
}
