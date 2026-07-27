# `@vooya/vite-plugin`

Compile Rust implementations from `.voo` files and import them as Vue or React
components.

```sh
npm install --save-dev @vooya/vite-plugin@alpha
npm install @vooya/vue@alpha
```

```js
import vue from "@vitejs/plugin-vue";
import { vooya } from "@vooya/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue(), vooya()],
});
```

The plugin builds one application-local WASM module under `.voo-cache`. Source
compilation currently requires Cargo, the `wasm32-unknown-unknown` target, and
the matching `wasm-bindgen` CLI.

Format components with `npx voo-format src` or check them with
`npx voo-format --check src`.
