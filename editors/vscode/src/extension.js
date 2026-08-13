import * as vscode from "vscode";

import { cleanupBridgeStorage, collectRustAnalyzerDiagnostics, extractEmbeddedRust, mapWorkspaceDiagnostic, prepareBridgeWorkspace } from "./rust-bridge.js";

const diagnostics = vscode.languages.createDiagnosticCollection("vooya-rust");
let storageRoot;

export function activate(context) {
  storageRoot = context.globalStorageUri.fsPath;
  context.subscriptions.push(diagnostics);
  const check = async (document = vscode.window.activeTextEditor?.document) => {
    if (!document || document.languageId !== "voo") return;
    const extracted = extractEmbeddedRust(document.getText(), document.uri.toString());
    if (!extracted) return diagnostics.delete(document.uri);
    try {
      const workspace = await prepareBridgeWorkspace(context.globalStorageUri.fsPath, extracted);
      const found = await collectRustAnalyzerDiagnostics(workspace, extracted);
      diagnostics.set(document.uri, found.map((item) => mapWorkspaceDiagnostic(item, extracted, workspace)).filter(Boolean).map(toVsCodeDiagnostic));
    } catch (error) {
      void vscode.window.showWarningMessage(`Vooya embedded Rust check unavailable: ${error.message}`);
    }
  };
  context.subscriptions.push(vscode.commands.registerCommand("vooya.checkEmbeddedRust", check));
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(check));
}

export async function deactivate() {
  if (storageRoot) await cleanupBridgeStorage(storageRoot);
}

function toVsCodeDiagnostic(diagnostic) {
  const result = new vscode.Diagnostic(new vscode.Range(diagnostic.range.start.line, diagnostic.range.start.character, diagnostic.range.end.line, diagnostic.range.end.character), diagnostic.message, diagnostic.severity ?? vscode.DiagnosticSeverity.Error);
  result.source = "rust-analyzer (Vooya embedded Rust)";
  return result;
}
