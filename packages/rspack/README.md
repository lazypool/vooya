# `@vooya/rspack`

Supported Rspack `>=2.1.10` integration for Rust-file components and Stores.
Import `.rs` files directly; the plugin builds WASM, generates the framework
bridge, and writes declarations under `.vooya/types`. The current loader matches `.rs` only; see the [migration guide](../../docs/project/retired-authoring.md).

The package supports Vue and React applications through Rsbuild, and exposes a
lower-level Rspack plugin and loader rule for applications that configure
Rspack directly. Source consumers still need Cargo, the
`wasm32-unknown-unknown` target, and `wasm-bindgen-cli` `0.2.115`.

Install the [0.2 alpha package graph](../../docs/project/next-release.md) and retain
the lockfile; package versions are independent with exact internal dependencies.
Supported integration status does not promote npm packages to a stable release.
The older non-Vite `beta` packages do not implement this Rust-file path.

## Rsbuild

```ts
import { defineConfig } from "@rsbuild/core";
import { pluginVue } from "@rsbuild/plugin-vue";
import { vooyaRsbuild } from "@vooya/rspack";

export default defineConfig({
  plugins: [pluginVue(), vooyaRsbuild()],
});
```

Select the React adapter explicitly:

```ts
vooyaRsbuild({ framework: "react" });
```

Rust dependencies and `web-sys` features use the same build-core contract as
the Vite integration:

The nearest `Cargo.toml` supplies defaults, and explicit `rust` options below
override same-named manifest dependencies. Regular packages and workspace
dependencies use the same shared build-core resolution rules.

```ts
vooyaRsbuild({
  rust: {
    dependencies: {
      serde: { version: "1", features: ["derive"] },
      "shared-engine": { path: "rust/shared-engine" },
    },
    webSysFeatures: ["HtmlCanvasElement"],
  },
});
```

## Direct Rspack

```js
import { vooyaRspack } from "@vooya/rspack";

const vooya = vooyaRspack({ framework: "vue" });

export default {
  experiments: { css: true },
  module: {
    rules: [vooya.rule(), { test: /\.css$/, type: "css" }],
  },
  plugins: [vooya],
};
```

The host application remains responsible for its normal Vue or React loader,
entry, HTML, and CSS configuration.

## Verified boundary

- `@rspack/core` and `@rspack/cli` 2.1.10;
- Rsbuild 2.1.13 with Vue and React browser lifecycle checks;
- Rslib 0.23.2 production library output;
- production WASM/CSS emission;
- Rust source rebuild, mapped Rust diagnostics, and failed-build recovery.

SSR, hydration, Module Federation, state-preserving HMR, and Rspack versions
below 2.1.10 are not compatibility claims. Exact fixture evidence currently
uses Rspack 2.1.10.

Rust source roots, manifests, and referenced styles are registered with Rspack's
watcher. Path dependencies participate in builds; restart the development server
after editing them, since path-dependency live updates are outside this support
contract. Rust-file production acceptance runs with
`npm run test:rust-bundlers` against packed packages and Rspack 2.1.10: Vue/React,
scoped CSS, Store actions, props/events, and unmount/remount. The Vue and React Rust-file
fixtures also check watch error recovery, stylesheet updates, newly added Rust
modules, and that generated assets do not cause a rebuild loop. Rsbuild development-server
fixtures cover Vue and React lifecycle, source edits
and Rust-error recovery. Rslib evidence covers production library output; Store
consumption from Rslib output and Solid/Svelte browser acceptance remain outside
the supported matrix.
