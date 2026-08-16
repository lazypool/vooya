import assert from "node:assert/strict";
import test from "node:test";
import { resolve } from "node:path";

import { hasWatchedRustChange } from "../dist/watch.js";

const applicationRoot = resolve("/workspace/application");
const watchedRoot = resolve(applicationRoot, "rust/counter-math");
const watchedFile = resolve(watchedRoot, "src/lib.rs");

test("recognizes absolute Rust dependency paths", () => {
  assert.equal(
    hasWatchedRustChange(new Set([watchedFile]), [watchedRoot], [watchedFile], applicationRoot),
    true,
  );
});

test("recognizes paths relative to the application root", () => {
  assert.equal(
    hasWatchedRustChange(
      new Set(["rust/counter-math/src/lib.rs"]),
      [watchedRoot],
      [watchedFile],
      applicationRoot,
    ),
    true,
  );
});

test("recognizes Rspack paths relative to the watched root parent", () => {
  assert.equal(
    hasWatchedRustChange(new Set(["counter-math/src/lib.rs"]), [watchedRoot], [watchedFile], applicationRoot),
    true,
  );
});

test("recognizes paths relative to the watched root", () => {
  assert.equal(
    hasWatchedRustChange(new Set(["src/lib.rs"]), [watchedRoot], [watchedFile], applicationRoot),
    true,
  );
});

test("ignores files outside registered Rust roots", () => {
  assert.equal(
    hasWatchedRustChange(
      new Set(["src/App.vue", "rust/another-crate/src/lib.rs"]),
      [watchedRoot],
      [watchedFile],
      applicationRoot,
    ),
    false,
  );
});
