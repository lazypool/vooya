# Getting Started

Vooya currently targets existing Vite 7 or Vite 8 applications using Vue 3 or
React 19. Source `.voo` components are compiled on the application author's
machine, so both the JavaScript and Rust toolchains are required.

## Prerequisites

- A Node.js version supported by your Vite version (`^20.19.0` or `>=22.12.0`
  for Vite 8).
- A current stable Rust toolchain.
- The `wasm32-unknown-unknown` Rust target.
- `wasm-bindgen-cli` version `0.2.115` for the current alpha runtime.

### Windows MSVC prerequisite

If Rust reports a host ending in `-pc-windows-msvc`, install Visual Studio Build
Tools before installing `wasm-bindgen-cli`. Select the **Desktop development with
C++** workload, including MSVC C++ build tools and a Windows SDK. Cargo needs the
MSVC linker, `link.exe`, to compile the CLI. Reopen the terminal after installation
so the linker is available on `PATH`.

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.115 --locked
wasm-bindgen --version
```

After installing the Vite plugin, verify the exact programs that Vite will
inherit from `PATH`:

```sh
npm exec -- vooya doctor
```

The command checks `cargo`, `rustc`, the `wasm32-unknown-unknown` target, and
the pinned `wasm-bindgen` CLI. On Windows MSVC toolchains, it also checks for
`link.exe`. It reports the executable paths and warns when the active Rust
sysroot is not managed by rustup, which commonly means a Homebrew toolchain is
taking precedence.

All `@vooya` packages must use the same alpha version. The repository `main`
branch can lead the npm `alpha` tag while a breaking prerelease is being
prepared; do not mix source from `main` with older published adapters.

## Vue

Install the Vue adapter and Vite plugin in an existing Vue application. The
application must already depend on `vue`, `vite`, and `@vitejs/plugin-vue`.

```sh
npm install @vooya/vue@alpha
npm install --save-dev @vooya/vite-plugin@alpha
```

Add `vooya()` after the Vue plugin:

```js
import vue from "@vitejs/plugin-vue";
import { vooya } from "@vooya/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue(), vooya()],
});
```

For a production build, run the application's normal Vite command:

```sh
npm run dev
npm run build
```

## React

Install the React adapter and Vite plugin:

```sh
npm install @vooya/react@alpha
npm install --save-dev @vooya/vite-plugin@alpha
```

Select the React adapter in Vite:

```js
import react from "@vitejs/plugin-react";
import { vooya } from "@vooya/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), vooya({ framework: "react" })],
});
```

## First component

Create `src/Greeting.voo`:

```voo
<component name="Greeting">
props:
  name: String = "world"
</component>

<rust>
use wasm_bindgen::JsValue;

use crate::{View, ViewElement};

pub struct Component {
    root: ViewElement,
}

impl Component {
    pub fn update_name(&self, name: String) {
        self.root.set_text(&format!("Hello, {name}."));
    }

    pub fn dispose(&mut self) {
        self.root.remove();
    }
}

pub fn mount(context: Context) -> Result<Component, JsValue> {
    let view = View::from_host(&context.host)?;
    let root = view
        .element("p")?
        .class("greeting")
        .text(&format!("Hello, {}.", context.props.name));
    root.mount(&context.host)?;
    Ok(Component { root })
}
</rust>

<style scoped>
.greeting {
    font-weight: 600;
}
</style>
```

Import it like a framework component.

Vue:

```vue
<script setup lang="ts">
import Greeting from "./Greeting.voo";
</script>

<template>
  <Greeting />
</template>
```

React:

```tsx
import Greeting from "./Greeting.voo";

export function App() {
  return <Greeting name="Rust" />;
}
```

Starting the Vite development server or running a production build generates
the application-local Rust crate, WASM module, framework adapter, and adjacent
TypeScript declaration.

See the working [Vue counter](../../examples/vue-counter) and
[React counter](../../examples/react-counter) for complete applications. For a
larger Rust-owned rendering surface, run the
[150,000 point Vue scatter plot](../../examples/scatter-plot) with
`npm run dev:scatter`.

## Vite+

Vite+ is a unified CLI and toolchain around Vite, not a separate Vooya adapter.
The tested Vite+ path uses Vite+ 0.2.9's Vite core alias and the same
`vooya()` plugin configuration:

```sh
npm install --save-dev vite-plus@0.2.9
npx vp build
```

For a project managed by Vite+, follow its installation and migration guide,
including the documented `vite` alias to
`@voidzero-dev/vite-plus-core`. Keep `vooya()` in the normal Vite plugin list;
the Vooya compatibility check is:

```sh
npm run test:vite-plus
```

This is a compatibility smoke path, not a claim that Vooya owns Vite+'s
runtime, package manager, task runner, or every bundled tool.
