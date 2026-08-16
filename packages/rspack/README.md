# `@vooya/rspack`

Experimental Rspack 2.1 integration for Vooya source `.voo` components.

The package supports Vue and React applications through Rsbuild, and exposes a
lower-level Rspack plugin and loader rule for applications that configure
Rspack directly. Source consumers still need Cargo, the
`wasm32-unknown-unknown` target, and `wasm-bindgen-cli` `0.2.115`.

Keep every `@vooya/*` package on the same exact alpha version.

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
- source Rust rebuild, mapped diagnostics, failed-build recovery, and watched
  Rust path dependencies.

SSR, hydration, Module Federation, state-preserving HMR, Rspack 1.x, and other
Rspack 2.x releases are not yet compatibility claims.
