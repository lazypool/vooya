import assert from "node:assert/strict";
import test from "node:test";

import { VOO_ABI_VERSION, assertVooAbiVersion, initializeWasm } from "../dist/runtime.js";

test("accepts the compiler ABI version", () => {
  assert.doesNotThrow(() => assertVooAbiVersion(VOO_ABI_VERSION));
});

test("reports mismatched WASM bindings before mount", () => {
  assert.throws(
    () => assertVooAbiVersion(VOO_ABI_VERSION + 1),
    /Vooya ABI mismatch: compiler expects 1, but WASM provides 2/,
  );
});

test("shares an in-flight WASM initialization across component modules", async () => {
  let calls = 0;
  let resolve;
  const initializer = () => {
    calls += 1;
    return new Promise((done) => {
      resolve = done;
    });
  };

  const first = initializeWasm(initializer);
  const second = initializeWasm(initializer);
  assert.equal(first, second);
  assert.equal(calls, 1);

  resolve("wasm exports");
  assert.equal(await first, "wasm exports");
  assert.equal(await initializeWasm(initializer), "wasm exports");
  assert.equal(calls, 1);
});
