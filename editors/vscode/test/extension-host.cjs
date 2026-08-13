const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");
const vscode = require("vscode");

async function run() {
  const fixture = resolve(__dirname, "../../../examples/vue-counter/src/Counter.voo");
  const document = await vscode.workspace.openTextDocument(vscode.Uri.file(fixture));
  await vscode.window.showTextDocument(document);
  await vscode.commands.executeCommand("vooya.checkEmbeddedRust", document);
  await new Promise((resolve) => setTimeout(resolve, 6_000));
  assert.deepEqual(vscode.languages.getDiagnostics(document.uri), [], "Counter must not receive generated harness diagnostics");
  console.log("Verified VS Code extension-host Counter diagnostics smoke.");
}

module.exports = { run };
