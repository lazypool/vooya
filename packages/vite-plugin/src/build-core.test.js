import assert from "node:assert/strict";
import test from "node:test";

import { remapRustDiagnostic } from "./build-core.mjs";

test("maps extracted Rust diagnostics back to the voo source", () => {
  const generated = "/project/target/voya/components/0-Counter.rs";
  const diagnostic = remapRustDiagnostic(
    {
      level: "error",
      message: "cannot find value `missing` in this scope",
      rendered: `error: cannot find value\n --> ${generated}:4:9\n  |\n4 | missing\n  | ^^^^^^^\n`,
      spans: [{ file_name: generated, line_start: 4, column_start: 9 }],
    },
    new Map([[generated, { id: "/project/src/Counter.voo", startLine: 10 }]]),
  );

  assert.match(diagnostic, /\/project\/src\/Counter\.voo:13:9/);
  assert.match(diagnostic, /13 \| missing/);
  assert.doesNotMatch(diagnostic, /0-Counter\.rs:4:9/);
});
