# Tooling Reference

## Vite plugin

The public plugin entry is `vooya()` from `@vooya/vite-plugin`.

```ts
vooya({
  framework: "vue",
  rust: {
    dependencies: {
      serde: { version: "1", features: ["derive"] },
      "shared-engine": { path: "rust/shared-engine" },
    },
    webSysFeatures: ["HtmlCanvasElement", "CanvasRenderingContext2d"],
  },
});
```

`framework` accepts `"vue"` or `"react"` and defaults to `"vue"`.

`rust.dependencies` maps Cargo package names to either a version string or an
object. Supported object fields are `version`, `path`, `git`, `branch`, `tag`,
`rev`, `package`, `features`, and `defaultFeatures`. Relative paths resolve from
the Vite application root and are watched during development.

Vooya owns `vooya-core`, `wasm-bindgen`, `js-sys`, and `web-sys` in the
generated crate. Add browser APIs through `rust.webSysFeatures` rather than
overriding `web-sys`.

## Generated application

The plugin creates `.voo-cache` under the Vite root. It contains:

- a generated `vooya-app` Cargo package;
- Rust extracted from each `<rust>` block;
- a shared Cargo target directory;
- wasm-bindgen browser output, including `vooya_app.js` and
  `vooya_app_bg.wasm`.

`.voo-cache` and generated `*.d.voo.ts` declarations should remain ignored by
Git. Rust compiler diagnostics from extracted files are remapped to the source
line in the original `.voo` file.

## Development rebuilds

Changes to `.voo`, the bundled Rust runtime, or configured path dependencies
schedule a rebuild. Rapid saves are coalesced. A failed Rust build is reported
through Vite and does not poison the next rebuild.

A successful Rust rebuild currently triggers a full page reload. Component
state is not preserved.

## Formatting

`voo-format` canonicalizes the component contract while preserving Rust and CSS
block contents.

```sh
npx voo-format src
npx voo-format --check src
```

The formatter rejects unknown top-level content rather than discarding it.

## VS Code extension

The repository contains the `vooya.voo` extension definition. It associates
`.voo` files with Voo syntax and embeds the native Rust and CSS TextMate
grammars.

```sh
npm run package:editor
code --install-extension dist/voo-vscode.vsix
```

The extension currently provides syntax highlighting and language
configuration. rust-analyzer completion, navigation, and diagnostics inside a
`.voo` document require a source bridge that has not been implemented yet.

## Repository verification

The broad local gate is:

```sh
npm run verify:release
```

It checks naming and fixed versions, formats, Rust tests, compiler tests, type
generation, browser E2E behavior, external packed-package builds, HMR recovery,
and npm archive contents. It does not publish packages.
