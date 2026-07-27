# Vooya for VS Code

Language support for Vooya `.voo` Rust components.

The extension provides syntax highlighting for component contracts and legacy
manifests, with native Rust and CSS highlighting inside `<rust>` and `<style>`
blocks.

Build the extension from the Voya repository root:

```sh
npm run package:editor
code --install-extension dist/voo-vscode.vsix
```
