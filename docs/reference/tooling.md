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

The public plugin entry is `vooya()` from `@vooya/vite`.

The plugin peer range covers Vite 7 and Vite 8. Vite+ is tested as a separate
toolchain because it aliases `vite` to `@voidzero-dev/vite-plus-core`; it still
uses the same `vooya()` plugin and does not create a second Vooya adapter API.
The current Vite+ fixture uses npm legacy peer resolution because its aliased
core has a `0.x` package version; normal Vite 7/8 fixtures install strictly.

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

## Doctor

`vooya doctor` diagnoses the Rust programs visible to the Vite process:

```sh
npx vooya doctor
```

It exits unsuccessfully when Cargo, rustc, the WASM target, or the exact
`wasm-bindgen-cli` version required by the alpha are absent. A non-rustup
sysroot is a warning rather than an error, but the report explains how to put
`$HOME/.cargo/bin` ahead of Homebrew when that causes a missing-target build.

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

## Vite development rebuilds

Changes to `.voo`, the bundled Rust runtime, or configured path dependencies
schedule a rebuild. Rapid saves are coalesced. A failed Rust build is reported
through Vite and does not poison the next rebuild.

A successful Rust rebuild currently triggers a full page reload. Component
state is not preserved.

## Rspack and Rsbuild

`@vooya/rspack` exposes `vooyaRsbuild()` for Rsbuild projects and
`vooyaRspack()` for direct Rspack configuration. Both call the same
`@vooya/build-core` Cargo and wasm-bindgen pipeline as Vite.

```ts
import { vooyaRsbuild } from "@vooya/rspack";

vooyaRsbuild({
  framework: "vue",
  rust: { dependencies: { "shared-engine": { path: "rust/shared-engine" } } },
});
```

The current compatibility claim is limited to Rspack 2.1.10 and the named
Rsbuild/Rslib fixtures. Direct Rspack users must configure their normal
framework and CSS rules in addition to `vooyaRspack().rule()`.

Rspack rebuilds edited `.voo` files and recovers after mapped Rust compilation
errors. Configured Rust path dependencies participate in builds, but editing a
path dependency currently requires restarting the Rspack development server.

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
