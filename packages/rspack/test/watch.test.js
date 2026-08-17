import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

import { fingerprintWatchedRustFiles } from "../dist/watch.js";

test("fingerprints watched Rust content independently of file order", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vooya-rspack-watch-"));
  try {
    const first = resolve(root, "first.rs");
    const second = resolve(root, "second.rs");
    writeFileSync(first, "pub fn first() {}\n");
    writeFileSync(second, "pub fn second() {}\n");
    assert.equal(
      fingerprintWatchedRustFiles([first, second]),
      fingerprintWatchedRustFiles([second, first]),
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test("changes the fingerprint when a watched Rust file changes", () => {
  const root = mkdtempSync(resolve(tmpdir(), "vooya-rspack-watch-"));
  try {
    const file = resolve(root, "lib.rs");
    writeFileSync(file, 'pub fn label() -> &\'static str { "before" }\n');
    const before = fingerprintWatchedRustFiles([file]);
    writeFileSync(file, 'pub fn label() -> &\'static str { "after" }\n');
    assert.notEqual(fingerprintWatchedRustFiles([file]), before);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
