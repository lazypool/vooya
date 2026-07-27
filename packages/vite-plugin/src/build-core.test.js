import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import test from "node:test";

import {
  generatedCargoManifest,
  remapRustDiagnostic,
  resolveRustDependencyRoots,
  resolveRuntimeCrateRoot,
} from "./build-core.mjs";

test("resolves the Rust runtime shipped by @voyajs/core", () => {
  const runtime = resolveRuntimeCrateRoot();

  assert.equal(existsSync(`${runtime}/Cargo.toml`), true);
  assert.equal(existsSync(`${runtime}/src/lib.rs`), true);
});

test("generates a standalone application crate", () => {
  const manifest = generatedCargoManifest({
    applicationRoot: "/consumer",
    runtimeCrateRoot: "/consumer/node_modules/@voyajs/core/rust",
  });

  assert.match(manifest, /name = "voya-app"/);
  assert.match(manifest, /^\[workspace\]$/m);
  assert.match(
    manifest,
    /voya-core = \{ path = "\/consumer\/node_modules\/@voyajs\/core\/rust" \}/,
  );
  assert.match(manifest, /crate-type = \["cdylib"\]/);
});

test("generates structured application dependencies and browser features", () => {
  const manifest = generatedCargoManifest({
    applicationRoot: "/consumer",
    runtimeCrateRoot: "/runtime",
    rust: {
      dependencies: {
        serde: { version: "1", features: ["derive"], defaultFeatures: false },
        "shared-math": { path: "rust/shared-math" },
      },
      webSysFeatures: ["HtmlCanvasElement"],
    },
  });

  assert.match(
    manifest,
    /"serde" = \{ version = "1", default-features = false, features = \["derive"\] \}/,
  );
  assert.match(manifest, /"shared-math" = \{ path = "\/consumer\/rust\/shared-math" \}/);
  assert.match(manifest, /"HtmlCanvasElement"/);
});

test("rejects overrides of compiler-managed Rust dependencies", () => {
  assert.throws(
    () =>
      generatedCargoManifest({
        applicationRoot: "/consumer",
        runtimeCrateRoot: "/runtime",
        rust: { dependencies: { "web-sys": "1" } },
      }),
    /managed by Voya/,
  );
});

test("resolves path dependencies from the application root", () => {
  assert.deepEqual(
    resolveRustDependencyRoots(
      {
        dependencies: {
          serde: "1",
          shared: { path: "rust/shared" },
        },
      },
      "/consumer",
    ),
    ["/consumer/rust/shared"],
  );
});

test("maps extracted Rust diagnostics back to the voo source", () => {
  const generated = "/project/target/voya/components/0-Counter.rs";
  const diagnostic = remapRustDiagnostic(
    {
      level: "error",
      message: "cannot find value `missing` in this scope",
      rendered: `error: cannot find value\n --> ${generated}:4:9\n  |\n4 | missing\n  | ^^^^^^^\n`,
      spans: [{ file_name: generated, line_start: 4, column_start: 9 }],
    },
    new Map([
      [
        generated,
        { id: "/project/src/Counter.voo", startLine: 10, generatedLineOffset: 1 },
      ],
    ]),
  );

  assert.match(diagnostic, /\/project\/src\/Counter\.voo:12:9/);
  assert.match(diagnostic, /12 \| missing/);
  assert.doesNotMatch(diagnostic, /0-Counter\.rs:4:9/);
});
