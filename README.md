<h1 align="center">Vooya</h1>

<p align="center">
  <strong>Write Rust-powered components. Use them from Vue and React.</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@vooya/vite"><img src="https://img.shields.io/npm/v/@vooya/vite/alpha?label=alpha" alt="npm alpha version"></a>
  <a href="https://github.com/vooyajs/vooya/actions/workflows/verify.yml"><img src="https://github.com/vooyajs/vooya/actions/workflows/verify.yml/badge.svg?branch=main" alt="build status"></a>
  <a href="LICENSE-MIT"><img src="https://img.shields.io/github/license/vooyajs/vooya" alt="license"></a>
</p>

Vooya compiles Rust from a `.voo` component into WebAssembly and exposes it as
an ordinary Vue or React component. The host framework keeps the application,
routing, and surrounding UI; Rust owns one isolated component surface.

```vue
<script setup lang="ts">
import RustChart from "./RustChart.voo";
</script>

<template>
  <RustChart :points="150000" @select="handleSelect" />
</template>
```

The component contract, Rust implementation, and scoped styles live together.
Vooya generates the framework adapter, TypeScript declarations, WASM lifecycle,
event forwarding, and diagnostic mappings.

> [!IMPORTANT]
> Vooya is a public alpha. Source `.voo` authoring supports Vite 7/8 and an
> experimental Rspack 2.1 path, with a local Rust/WASM toolchain. Published
> alpha APIs may still change.

## Why Vooya?

Rust already has strong libraries for parsing, graphics, simulation, search,
editors, media, and data processing. Bringing one of those libraries into an
existing frontend application usually means maintaining WASM initialization,
framework wrappers, types, events, cleanup, diagnostics, and packaging by hand.

Vooya is exploring a repeatable component boundary for that work:

- keep existing Vue and React applications;
- reuse browser-compatible Rust crates;
- generate typed props and events;
- manage mount, updates, failures, and disposal;
- develop from a single `.voo` component;
- eventually distribute precompiled components whose consumers do not need
  Rust installed.

Vooya is not a replacement for Vue or React, and it does not assume that WASM
makes ordinary DOM work faster. Performance claims belong to measured,
component-level workloads.

## Quick start with Vue

### 1. Prerequisites

- Node.js `^20.19.0` or `>=22.12.0`;
- a current stable Rust toolchain managed by [rustup](https://rustup.rs/);
- the `wasm32-unknown-unknown` target;
- `wasm-bindgen-cli` `0.2.115` for the current alpha.

```sh
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.115 --locked
```

### 2. Create a Vite 7 or Vite 8 application

The current Vooya alpha supports Vite 7 and Vite 8. Pin the matching
`create-vite` major so a new project does not silently select an unverified Vite
major.

Using npm:

```sh
npm create vite@8 vooya-demo -- --template vue-ts
cd vooya-demo
npm install
npm install @vooya/vue@alpha
npm install --save-dev @vooya/vite@alpha
```

Using pnpm:

```sh
pnpm create vite@8 vooya-demo --template vue-ts
cd vooya-demo
pnpm install
pnpm add @vooya/vue@alpha
pnpm add --save-dev @vooya/vite@alpha
```

If pnpm reports that the `esbuild` install script was blocked, run
`pnpm approve-builds`, select `esbuild`, and repeat the install. This is pnpm's
dependency-script policy, not a Vooya compiler error.

### 3. Enable the plugin

Update `vite.config.ts`:

```ts
import vue from "@vitejs/plugin-vue";
import { vooya } from "@vooya/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue(), vooya()],
});
```

Check the exact Rust toolchain Vooya will select for Vite:

```sh
npm exec -- vooya doctor
# or: pnpm exec vooya doctor
```

### 4. Create your first component

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
    color: #2f7d68;
    font-size: 1.5rem;
    font-weight: 700;
}
</style>
```

Replace `src/App.vue` with:

```vue
<script setup lang="ts">
import Greeting from "./Greeting.voo";
</script>

<template>
  <main>
    <h1>Vue hosts the application</h1>
    <Greeting name="Vooya" />
  </main>
</template>
```

Start Vite:

```sh
npm run dev
# or: pnpm dev
```

The first run generates an application-local Cargo crate, compiles the Rust
source to WASM, and writes an adjacent TypeScript declaration for the component.

## Using React

Create a Vite 8 React project and install the React adapter:

```sh
npm create vite@8 vooya-react-demo -- --template react-ts
cd vooya-react-demo
npm install
npm install @vooya/react@alpha
npm install --save-dev @vooya/vite@alpha
```

Use the React mode in `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { vooya } from "@vooya/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), vooya({ framework: "react" })],
});
```

The same `Greeting.voo` can then be imported from React:

```tsx
import Greeting from "./Greeting.voo";

export default function App() {
  return <Greeting name="Vooya" />;
}
```

## Using Rust libraries

Additional Cargo dependencies are configured in the Vite plugin. Registry,
Git, feature, and application-relative path dependencies are supported:

```ts
vooya({
  rust: {
    dependencies: {
      serde: { version: "1", features: ["derive"] },
      "shared-engine": { path: "rust/shared-engine" },
    },
    webSysFeatures: ["HtmlCanvasElement", "CanvasRenderingContext2d"],
  },
});
```

The crate must compile for `wasm32-unknown-unknown` and be compatible with the
browser environment. Crates that require native operating-system APIs, an
ordinary filesystem, or unsupported threading facilities will need a Web/WASM
compatible configuration or adapter.

## Component boundary

```text
Vue / React props  -> generated adapter -> Rust/WASM component
Vue / React events <- generated adapter <- typed component events
framework unmount  -> dispose           -> listeners and resources released
```

The framework owns the host element and its location in the application tree.
The mounted Vooya component owns the subtree below that element. Rust can use
the small structured `View` API, Canvas/WebGL, or lower-level `web-sys` browser
APIs when necessary.

## What works today

- source `.voo` components in Vite 7 and Vite 8;
- experimental source `.voo` components in Rspack 2.1 through Rsbuild or the
  first-party Rspack plugin;
- Vue 3.5 and React 19 adapters;
- typed primitive props and component events;
- generated mount, prop-update, error, dispose, and ABI bindings;
- TypeScript declarations and scoped CSS;
- Rust diagnostics mapped back to `.voo` source lines;
- crates.io, Git, feature, and watched path dependencies;
- failed-build recovery and reliable full-page reload after Rust rebuilds;
- `vooya doctor`, `.voo` formatting, and a VS Code diagnostics extension;
- browser fixtures for lifecycle cleanup, DataGrid, Canvas scatter, and trace
  waterfall examples;
- a test-only precompiled Vue consumer proof that runs without Rust tools.

Current boundaries:

- Rspack support is experimental and currently verified only against the
  recorded 2.1 fixtures; Vite+ remains a Vite-core alias rather than a second
  adapter;
- Webpack, Turbopack, Rollup, SSR, and hydration are not supported;
- successful Rust HMR currently performs a full reload and loses local state;
- component contracts are intentionally limited and will evolve during alpha;
- the precompiled artifact path is not yet a published component product.

See the [project status](docs/project/status.md) and
[compatibility matrix](docs/project/compatibility.md) for the precise evidence
behind these statements.

## Documentation

- [Getting started](docs/guide/getting-started.md)
- [Writing `.voo` components](docs/guide/voo-components.md)
- [Component ownership boundary](docs/concepts/component-boundary.md)
- [Tooling and Rust dependencies](docs/reference/tooling.md)
- [Project status](docs/project/status.md)
- [Compatibility matrix](docs/project/compatibility.md)
- [Design RFCs](docs/README.md#design-records)

## Examples

After cloning this repository and installing its dependencies, run:

```sh
npm install
npm run dev:vue       # Vue counter
npm run dev:react     # React counter
npm run dev:tasks     # Rust-owned task list
npm run dev:scatter   # 150,000-point Canvas scatter plot
npm run dev:benchmark # Rust/Vue data-grid comparison
npm run dev:trace     # trace-waterfall interaction case
```

Repository development also requires the Rust target and pinned wasm-bindgen
CLI shown in the quick start above.

## Packages

| Package | Purpose |
| --- | --- |
| [`@vooya/compiler`](packages/compiler) | Pure `.voo` parser, IR, code generation, formatting, and scoped styles |
| [`@vooya/core`](packages/core) | Rust component runtime source and ownership primitives |
| [`@vooya/build-core`](packages/build-core) | Bundler-neutral Cargo, wasm-bindgen, asset, declaration, watch, and diagnostic pipeline |
| [`@vooya/vite`](packages/vite) | Vite integration, Rust/WASM build orchestration, diagnostics, and CLI |
| [`@vooya/rspack`](packages/rspack) | Experimental Rspack 2.1 and Rsbuild source `.voo` integration |
| [`@vooya/vue`](packages/vue) | Vue lifecycle and event adapter |
| [`@vooya/react`](packages/react) | React lifecycle and event adapter |

All public packages use one coordinated alpha version. Install the framework
adapter and selected bundler integration from the same `alpha` channel.

### Migration from `@vooya/vite-plugin`

The Vite integration package is named `@vooya/vite`. Update existing installs
and imports:

```diff
-npm install --save-dev @vooya/vite-plugin@alpha
+npm install --save-dev @vooya/vite@alpha
```

```diff
-import { vooya } from "@vooya/vite-plugin";
+import { vooya } from "@vooya/vite";
```

## Contributing

Vooya is looking for feedback and contributions across Rust/WASM runtime work,
compiler design, Vue/React integration, build tooling, compatibility testing,
examples, and documentation.

- Read the [contribution guide](CONTRIBUTING.md) before starting code or public
  API work.
- Browse the [open issues](https://github.com/vooyajs/vooya/issues).
- Read [Issue #16](https://github.com/vooyajs/vooya/issues/16) for the current
  0.1 product boundary.
- Use a focused issue or RFC before expanding public APIs.
- Keep performance claims tied to reproducible browser evidence.

Before submitting a code change, run the checks relevant to the area you
changed. The complete release gate is:

```sh
npm run verify:ci
```

Security reports should follow [SECURITY.md](SECURITY.md). Community
participation is covered by the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Vooya is dual-licensed under [MIT](LICENSE-MIT) or
[Apache-2.0](LICENSE-APACHE).
