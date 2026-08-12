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

test("doctor explains missing target and mismatched wasm-bindgen", () => {
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
  assert.match(output, /put .*\.cargo\/bin before Homebrew/);
});
