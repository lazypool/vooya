import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { collectRustAnalyzerDiagnostics, extractEmbeddedRust, mapDiagnostic, mapWorkspaceDiagnostic, prepareBridgeWorkspace } from "../src/rust-bridge.js";

test("extracts Rust and preserves its original .voo line offset", () => {
  const extracted = extractEmbeddedRust('<component name="Broken">\nprops:\n  value: i32\n</component>\n\n<rust>\npub fn broken() {\n  let value: u32 = "wrong";\n}\n</rust>\n', "file:///project/Broken.voo");
  assert.equal(extracted.sourceLineOffset, 6);
  assert.equal(extracted.content.split("\n")[1], '  let value: u32 = "wrong";');
  assert.equal(mapDiagnostic({ message: "mismatch", range: { start: { line: 1, character: 19 }, end: { line: 1, character: 26 } } }, extracted.sourceLineOffset).range.start.line, 7);
});

test("owns generated Rust in extension storage, not the source project", async () => {
  const extracted = extractEmbeddedRust('<component name="Counter"></component>\n<rust>pub fn ok() {}</rust>', "file:///project/Counter.voo");
  const storage = await mkdtemp(join(tmpdir(), "vooya-editor-"));
  const workspace = await prepareBridgeWorkspace(storage, extracted);
  assert.match(workspace.root, /vooya-rust-bridge/);
  assert.match(await readFile(workspace.sourcePath, "utf8"), /pub fn ok\(\) \{\}/);
});

test("checks a real Counter contract without generated-wrapper false errors", async () => {
  const source = await readFile(new URL("../../../examples/vue-counter/src/Counter.voo", import.meta.url), "utf8");
  const extracted = extractEmbeddedRust(source, "file:///project/Counter.voo");
  const workspace = await prepareBridgeWorkspace(await mkdtemp(join(tmpdir(), "vooya-editor-counter-")), extracted);
  const diagnostics = await collectRustAnalyzerDiagnostics(workspace, extracted);
  assert.deepEqual(diagnostics.map((diagnostic) => mapWorkspaceDiagnostic(diagnostic, extracted, workspace)).filter(Boolean), []);
});

test("maps a real rust-analyzer diagnostic back to the embedded .voo line", async () => {
  const source = '<component name="Broken">\nprops:\n  value: i32\n\nevents:\n  change(value: i32)\n</component>\n\n<rust>\npub fn broken() {\n  let value: u32 = "wrong";\n}\n</rust>\n';
  const extracted = extractEmbeddedRust(source, "file:///project/Broken.voo");
  const workspace = await prepareBridgeWorkspace(await mkdtemp(join(tmpdir(), "vooya-editor-ra-")), extracted);
  const diagnostics = await collectRustAnalyzerDiagnostics(workspace, extracted);
  const mismatch = diagnostics.find((diagnostic) => diagnostic.code === "E0308");
  assert.ok(mismatch, `expected Rust mismatch diagnostic, received: ${JSON.stringify(diagnostics)}`);
  assert.equal(mapWorkspaceDiagnostic(mismatch, extracted, workspace).range.start.line, 10);
});

test("reports a missing rust-analyzer process without writing the source project", async () => {
  const extracted = extractEmbeddedRust('<component name="Counter"></component>\n<rust>pub fn ok() {}</rust>', "file:///project/Counter.voo");
  const workspace = await prepareBridgeWorkspace(await mkdtemp(join(tmpdir(), "vooya-editor-missing-ra-")), extracted);
  await assert.rejects(
    collectRustAnalyzerDiagnostics(workspace, extracted, { command: "vooya-rust-analyzer-not-installed" }),
    /ENOENT/,
  );
});
