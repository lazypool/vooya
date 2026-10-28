# `@vooya/webpack`

Supported Webpack 5 integration for Rust-file components and Stores in
Vue 3 and React 19 applications. Import `.rs` files directly; the plugin builds
WASM, writes declarations under `.vooya/types`, and generates the framework bridge.
The current loader matches `.rs` only. See the [migration guide](../../docs/project/retired-authoring.md) for removed inputs and APIs.
Source consumers need the shared Rust/WASM toolchain.

Install the [0.2 alpha package graph](../../docs/project/next-release.md) and retain
the lockfile; package versions are independent with exact internal dependencies.
Supported integration status does not promote npm packages to a stable release.
The older non-Vite `beta` packages do not implement this Rust-file path.

```js
import { vooyaWebpack } from "@vooya/webpack";

const vooya = vooyaWebpack({ framework: "vue" });

export default {
  experiments: { asyncWebAssembly: true },
  module: {
    rules: [
      vooya.rule(),
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
    ],
  },
  plugins: [vooya],
};
```

React projects use `vooyaWebpack({ framework: "react" })`. The application
remains responsible for its normal Vue or React loader, HTML, JavaScript, and
CSS configuration.

Rust dependencies use the shared build-core contract:

The nearest `Cargo.toml` supplies defaults, and explicit `rust` options below
override same-named manifest dependencies. Regular packages and workspace
dependencies use the same shared build-core resolution rules.

```js
vooyaWebpack({
  rust: {
    dependencies: {
      serde: { version: "1", features: ["derive"] },
      "shared-engine": { path: "rust/shared-engine" },
    },
    webSysFeatures: ["HtmlCanvasElement"],
  },
});
```

The supported range is Webpack `>=5`, with exact fixtures at 5.101.0 and
5.109.2. Webpack 4, SSR, hydration, Module Federation, and
state-preserving HMR are not supported claims. Webpack Dev Server uses its
normal live reload behavior after successful Rust rebuilds.

Rust-file acceptance runs with `npm run test:rust-bundlers`: packed packages,
Webpack 5.109.2, Vue/React, scoped CSS, Store actions, props/events, and
unmount/remount. Solid/Svelte are accepted framework selections but do not yet
have Webpack browser acceptance. The Vue and React Rust-file fixtures also check watch
error recovery, stylesheet edits, newly added Rust modules, and that generated
assets do not cause a rebuild loop. The additional production and
watch/recovery fixtures now use Rust sources.
