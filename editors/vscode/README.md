# Vooya for VS Code

Language support for Vooya `.voo` Rust components.

The extension provides syntax highlighting for component contracts and legacy
manifests, with native Rust and CSS highlighting inside `<rust>` and `<style>`
blocks. Run **Vooya: Check Embedded Rust** from the Command Palette (or save a
`.voo` document) to map rust-analyzer diagnostics from the Rust block back to
the source `.voo` file.

The bridge creates a disposable Cargo workspace under VS Code extension global
storage, never in the opened project or its `.vooya` workspace. It packages the
matching Vooya core Rust runtime and generates the component's `Context`,
`Props`, and `Events` contract before asking rust-analyzer, so ordinary source
components are checked against their real build surface. If rust-analyzer is
missing or cannot start, it shows a warning and leaves the document unchanged.
This is a diagnostics-only bridge; it does not claim Rust navigation, rename,
completion, or the full rust-analyzer feature set.

Build the extension from the Vooya repository root:

```sh
npm run package:editor
code --install-extension dist/voo-vscode.vsix
```
