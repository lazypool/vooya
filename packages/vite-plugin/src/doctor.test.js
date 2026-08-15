import test from "node:test";
import assert from "node:assert/strict";

import { WASM_BINDGEN_VERSION, formatToolchainReport, inspectToolchain } from "./doctor.js";

function runner(responses) {
  return (command, args) => {
    const response = responses[`${command} ${args.join(" ")}`];
    if (response instanceof Error) throw response;
    if (response === undefined) throw new Error(`Unexpected command: ${command} ${args.join(" ")}`);
    return response;
  };
}

test("doctor accepts a matching rustup toolchain", () => {
  const report = inspectToolchain({
    env: { PATH: "/Users/test/.cargo/bin:/opt/homebrew/bin", RUSTUP_HOME: "/Users/test/.rustup" },
    run: runner({
      "cargo --version": "cargo 1.94.0",
      "rustc --version": "rustc 1.94.0",
      "rustc --print sysroot": "/Users/test/.rustup/toolchains/stable-aarch64-apple-darwin",
      "wasm-bindgen --version": `wasm-bindgen ${WASM_BINDGEN_VERSION}`,
      "rustup target list --installed": "wasm32-unknown-unknown\nx86_64-apple-darwin",
      "which cargo": "/Users/test/.cargo/bin/cargo",
      "which rustc": "/Users/test/.cargo/bin/rustc",
      "which wasm-bindgen": "/Users/test/.cargo/bin/wasm-bindgen",
    }),
  });

  assert.equal(report.ok, true);
  assert.equal(report.results.at(-1).status, "ok");
  assert.match(formatToolchainReport(report), /\[ok\] cargo\/rustc toolchain/);
});

test("doctor explains missing target and mismatched wasm-bindgen without platform-specific remediation", () => {
  const report = inspectToolchain({
    env: { PATH: "/opt/homebrew/bin", RUSTUP_HOME: "/Users/test/.rustup" },
    run: runner({
      "cargo --version": "cargo 1.94.0",
      "rustc --version": "rustc 1.94.0",
      "rustc --print sysroot": "/opt/homebrew/Cellar/rust/1.94.0",
      "wasm-bindgen --version": "wasm-bindgen 0.2.126",
      "rustup target list --installed": "x86_64-apple-darwin",
      "which cargo": "/opt/homebrew/bin/cargo",
      "which rustc": "/opt/homebrew/bin/rustc",
      "which wasm-bindgen": "/opt/homebrew/bin/wasm-bindgen",
    }),
  });

  assert.equal(report.ok, false);
  const output = formatToolchainReport(report);
  assert.match(output, /rustup target add wasm32-unknown-unknown/);
  assert.match(output, /cargo install -f wasm-bindgen-cli --version 0.2.115/);
  assert.match(output, /install and select a rustup toolchain/);
  assert.doesNotMatch(output, /Homebrew|\.cargo\/bin before/);
});

test("doctor uses Windows executable resolution and recognizes a case-insensitive rustup sysroot", () => {
  const report = inspectToolchain({
    platform: "win32",
    home: "C:\\Users\\test",
    env: {
      Path: "C:\\Users\\test\\.cargo\\bin;C:\\Windows\\System32",
      RUSTUP_HOME: "C:\\Users\\test\\.rustup",
    },
    run: runner({
      "cargo --version": "cargo 1.94.0",
      "rustc --version": "rustc 1.94.0",
      "rustc --print sysroot": "c:\\USERS\\TEST\\.RUSTUP\\toolchains\\stable-x86_64-pc-windows-msvc",
      "rustc -vV": "rustc 1.94.0\nhost: x86_64-pc-windows-msvc",
      "wasm-bindgen --version": `wasm-bindgen ${WASM_BINDGEN_VERSION}`,
      "rustup target list --installed": "wasm32-unknown-unknown\nx86_64-pc-windows-msvc",
      "where.exe cargo": "C:\\Users\\test\\.cargo\\bin\\cargo.exe\r\nC:\\other\\cargo.exe",
      "where.exe rustc": "C:\\Users\\test\\.cargo\\bin\\rustc.exe",
      "where.exe wasm-bindgen": "C:\\Users\\test\\.cargo\\bin\\wasm-bindgen.exe",
      "where.exe link.exe": "C:\\BuildTools\\VC\\Tools\\MSVC\\bin\\Hostx64\\x64\\link.exe",
    }),
  });

  assert.equal(report.ok, true);
  assert.equal(report.cargoPath, "C:\\Users\\test\\.cargo\\bin\\cargo.exe");
  assert.equal(report.results.at(-1).status, "ok");
  assert.match(formatToolchainReport(report), /\[ok\] MSVC linker link\.exe/);
  assert.doesNotMatch(formatToolchainReport(report), /Homebrew|which/);
});

test("doctor explains the Windows Build Tools prerequisite when an MSVC linker is missing", () => {
  const report = inspectToolchain({
    platform: "win32",
    home: "C:\\Users\\test",
    env: {
      Path: "C:\\Users\\test\\.cargo\\bin;C:\\Windows\\System32",
      RUSTUP_HOME: "C:\\Users\\test\\.rustup",
    },
    run: runner({
      "cargo --version": "cargo 1.94.0",
      "rustc --version": "rustc 1.94.0",
      "rustc --print sysroot": "C:\\Users\\test\\.rustup\\toolchains\\stable-x86_64-pc-windows-msvc",
      "rustc -vV": "rustc 1.94.0\nhost: x86_64-pc-windows-msvc",
      "wasm-bindgen --version": `wasm-bindgen ${WASM_BINDGEN_VERSION}`,
      "rustup target list --installed": "wasm32-unknown-unknown\nx86_64-pc-windows-msvc",
      "where.exe cargo": "C:\\Users\\test\\.cargo\\bin\\cargo.exe",
      "where.exe rustc": "C:\\Users\\test\\.cargo\\bin\\rustc.exe",
      "where.exe wasm-bindgen": "C:\\Users\\test\\.cargo\\bin\\wasm-bindgen.exe",
      "where.exe link.exe": new Error("INFO: Could not find files for the given pattern(s)."),
    }),
  });

  assert.equal(report.ok, false);
  assert.match(formatToolchainReport(report), /\[error\] MSVC linker link\.exe/);
  assert.match(formatToolchainReport(report), /Visual Studio Build Tools/);
  assert.match(formatToolchainReport(report), /Desktop development with C\+\+/);
});
