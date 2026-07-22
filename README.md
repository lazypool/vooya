# Voya

Voya is an experimental Rust-to-WASM component runtime for JavaScript frontends.
It is designed for incremental adoption: a Vue or React application retains its
existing framework while Voya owns the DOM inside explicitly mounted component
islands.

The project is private and at the architecture-validation stage. The intended
first integration target is Vue via Vite.

## Vue runtime spike

The `examples/vue-counter` application demonstrates the current host contract:

```vue
<script setup lang="ts">
import Counter from "./Counter.voya";
</script>

<template>
  <Counter :initial="1" @change="console.log" />
</template>
```

Run it with `npm install` followed by `npm run dev:vue`. The Vite plugin builds
the Rust core and turns `.voya` imports into Vue components. Rust source changes
currently rebuild the core and reload the page; preserving island state across
updates is explicitly deferred.

`npm run dev:tasks` runs the Stage 4 Task List example. It is authored in Rust
with signals and effects, then mounted as a Vue component through the same
adapter. See [RFC 0002](docs/rfcs/0002-reactive-component-model.md) for the
current component-model contract.

`npm run dev:react` mounts the same Counter WASM island in React. The React
adapter shares `@voyajs/core` and the Vite build pipeline with Vue; only the host
lifecycle bridge changes.

## Direction

```text
Vue props -> Voya adapter -> WASM component -> Voya-owned DOM subtree
Vue events <- Voya adapter <- component events
```

Voya is not a Vue or React replacement. Its first use cases are isolated,
high-update-rate components such as data grids, editors, visualization controls,
and application-specific interactive panels.

Read [RFC 0001](docs/rfcs/0001-component-islands.md) for the initial contract
and [the benchmark plan](docs/benchmarks/data-grid.md) for the first validation
case.
