# Voya

**Write frontend components in Rust. Use them from Vue and React.**

Voya is an experimental Rust-to-WASM component compiler for JavaScript
applications. A Voya component owns an isolated DOM subtree, while the host
framework keeps control of the surrounding application, routing, and state.

```vue
<script setup lang="ts">
import Counter from "./Counter.voo";
</script>

<template>
  <Counter :initial="1" @change="value => console.log(value)" />
</template>
```

The goal is for the implementation, public props, events, and scoped styles to
live in one `.voo` component file. Voya will compile its Rust code to WASM and
generate the framework adapter and TypeScript declarations automatically.

## Why Voya

Rust already has excellent tools for data processing, parsers, editors,
graphics, simulation, and other demanding workloads. Voya is an attempt to
bring that code all the way to the component boundary without asking teams to
replace their existing frontend framework.

The intended use cases are isolated, computation-heavy or high-update-rate
components such as:

- data grids and large interactive lists;
- editors, timelines, and visualization controls;
- Canvas, WebGL, and application-specific rendering surfaces;
- components backed by an existing Rust library.

Voya does not assume that WASM makes ordinary DOM work faster. Crossing the
JavaScript/WASM boundary and manipulating the DOM both have costs. Early
versions may lose to a mature JavaScript implementation in some workloads. The
project is exploring the larger design space: typed component contracts,
shared Rust logic, generated framework bridges, and rendering strategies that
can improve without changing application code.

## Component Model

The host framework owns the mount element and its position in the application.
Voya owns every node below it.

```text
Vue / React props -> generated adapter -> WASM component -> owned DOM subtree
Vue / React events <- generated adapter <- component events
unmount            -> dispose           -> release state and listeners
```

This boundary allows a Voya component to behave like a normal Vue or React
component while keeping its state, update logic, and rendering implementation
in Rust.

## Target `.voo` Format

The single-file component syntax is still being designed. The intended authoring
model looks like this:

```voo
<component name="Counter">
props:
  initial: i32 = 0

events:
  change(value: i32)
</component>

<rust>
use voo::prelude::*;

#[voo::component]
fn counter(ctx: Context<Props, Events>) -> impl View {
    let count = signal(ctx.props.initial.get());

    view! {
        <section class="counter">
            <output>{count}</output>
            <button on:click=move |_| {
                let next = count.update(|value| *value += 1);
                ctx.events.change(next);
            }>
                "Increment"
            </button>
        </section>
    }
}
</rust>

<style scoped>
.counter {
    display: flex;
    gap: 8px;
    align-items: center;
}
</style>
```

`mount`, prop updates, event forwarding, disposal, framework adapters, and
TypeScript declarations are compiler responsibilities. Component authors
should not have to hand-write WASM export names or Vue/React adapter factories.

## Current Status

Voya is currently an architecture-validation prototype, not a published stable
compiler.

The repository already has:

- a Rust core compiled for `wasm32-unknown-unknown`;
- a Vite plugin that resolves `.voo` imports and initializes WASM;
- working Vue and React lifecycle bridges;
- props flowing into a Rust counter and events flowing back to the host;
- Rust implementations of a task list and a virtualized data-grid experiment.

The current `.voo` files are transitional manifests. They select an existing
Rust/WASM export and framework adapter; their Rust implementation does not live
inside the file yet. Props and events are parsed as metadata but do not yet
generate adapters or TypeScript declarations.

## Development

Install the JavaScript dependencies and ensure the Rust WASM target and
`wasm-bindgen` CLI are available:

```sh
npm install
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli
```

Run the examples:

```sh
npm run dev:vue       # Vue counter
npm run dev:react     # React counter
npm run dev:tasks     # Rust task list inside Vue
npm run dev:benchmark # Rust data grid and benchmark harness
```

Build and type-check all current examples:

```sh
npm run typecheck
npm run typecheck:react
npm run typecheck:tasks
npm run typecheck:benchmark
npm run build:vue
npm run build:react
npm run build:tasks
npm run build:benchmark
```

## Roadmap

The next milestone is one complete Counter component pipeline:

1. Parse a `.voo` file containing its Rust implementation.
2. Generate a Rust module and compile it into an application-level WASM binary.
3. Generate the Vue adapter from the declared props and events.
4. Generate TypeScript declarations for the imported component.
5. Map Rust compiler diagnostics back to the original `.voo` source.
6. Remove the hand-written Counter export and adapter.

After that foundation is real, the task list will validate reactive state and
keyed rendering, the data grid will validate performance on a meaningful
workload, and the generated component contract can be shared by Vue and React.

## Scope

Voya is not trying to replace Vue, React, routing, application state management,
or the JavaScript ecosystem. It is a way to introduce Rust at a component
boundary where Rust provides enough value to justify the WASM cost.

See [RFC 0001](docs/rfcs/0001-component-islands.md) for the ownership boundary,
[RFC 0002](docs/rfcs/0002-reactive-component-model.md) for the current reactive
prototype, and [the data-grid benchmark plan](docs/benchmarks/data-grid.md) for
the first performance validation case.
