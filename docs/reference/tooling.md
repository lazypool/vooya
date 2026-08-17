# Tooling Reference

## JavaScript output and TypeScript authoring

Vooya packages execute published JavaScript. TypeScript is a repository
development dependency only: it compiles authoring source during package builds
and emits the JavaScript that Vite, Node, and the VS Code extension load.
Installing `@vooya/*` does not require installing TypeScript.

Repository-owned runtime/tooling code is authored in TypeScript. Generated
output, package CLI launchers, consumer fixtures, and compatibility config files
may remain JavaScript when Node or a consumer tool must execute them directly.

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
  toolchain: {
    cargoPath: "/opt/custom-rust/bin/cargo",
  },
});
```

`framework` accepts `"vue"` or `"react"` and defaults to `"vue"`. The optional
`toolchain.cargoPath` explicitly selects one Cargo executable. Vooya discovers
the rustc used by that Cargo and rejects the explicit path if its target or
wasm-bindgen CLI is incomplete; it does not fall back to another Cargo on
`PATH`. Relative paths resolve from the Vite project root.

`rust.dependencies` maps Cargo package names to either a version string or an
object. Supported object fields are `version`, `path`, `git`, `branch`, `tag`,
`rev`, `package`, `features`, and `defaultFeatures`. Relative paths resolve from
the Vite application root and are watched during development.

Vooya owns `vooya-core`, `wasm-bindgen`, `js-sys`, and `web-sys` in the
generated crate. Add browser APIs through `rust.webSysFeatures` rather than
overriding `web-sys`.

## Doctor

`vooya doctor` resolves and diagnoses the same coherent Rust/WASM toolchain used
by the Vite process:

```sh
npx vooya doctor
npx vooya doctor --cargo-path /opt/custom-rust/bin/cargo
```

It checks every `cargo` found on `PATH` in order unless `--cargo-path` explicitly
selects one Cargo. An explicit path is authoritative: if it is incomplete,
doctor fails instead of selecting another PATH candidate. For each candidate, Cargo's
verbose `cargo rustc` invocation identifies the rustc that Cargo will use; that
rustc must provide the `wasm32-unknown-unknown` standard library, and the
selected `wasm-bindgen-cli` must be exactly the version required by the alpha.
The report prints all selected executable paths. A non-rustup sysroot is a
warning rather than an error. If a later Cargo candidate is selected because
the first one is incomplete, doctor also warns that this may differ from the
user's PATH preference.

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

The extension provides syntax highlighting, language configuration, and an
embedded-Rust diagnostics bridge. Run **Vooya: Check Embedded Rust** from the
Command Palette, or save a `.voo` document, to check its extracted Rust with
the locally available `rust-analyzer`; diagnostics are mapped back to the
original `.voo` lines.

This is diagnostics-only. It does not provide rust-analyzer completion,
navigation, rename, or code actions inside a `.voo` document.

For a clean-checkout editor gate, run:

```sh
npm run test:editor
```

That command installs the extension's lockfile-pinned development dependencies
before running its bridge and extension-host tests. It requires a local
`rust-analyzer` and downloads the VS Code test host on its first run.

## Repository verification

The broad local gate is:

```sh
npm run verify:release
```

It checks naming and fixed versions, formats, Rust tests, compiler tests, type
generation, browser E2E behavior, external packed-package builds, HMR recovery,
and npm archive contents. It does not publish packages.
