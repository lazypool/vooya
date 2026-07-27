# RFC 0001: Voya Component Islands

## Status

Accepted for the Stage 0 architecture validation.

## Problem

Some JavaScript UI components spend material time in state derivation, list
reconciliation, and event-heavy rendering. Rewriting an entire existing
application in another framework is usually disproportionate. Voya investigates
whether a Rust/WASM component can replace only the expensive subtree while
remaining an ordinary component from the host framework's perspective.

## Decision

Voya components compile from Rust to `wasm32-unknown-unknown`. A host adapter
mounts one component into one host-owned element. Once mounted, Voya owns every
DOM node below that element. The host owns the element itself and its place in
the application tree.

The first host is Vue 3 through a Vite plugin and `@vooya/vue`. The core is not
allowed to depend on Vue APIs.

```text
Host framework             Adapter                 Voya runtime
--------------             -------                 ------------
props -------------------> compact ABI ----------> state + render
unmount -----------------> dispose --------------> release state/listeners
events <------------------ CustomEvent <---------- component dispatch
```

## Non-goals for Stages 0-4

- Reimplementing Vue, React, routing, or global state management.
- Rendering into DOM nodes owned by the host framework.
- Vue slots, arbitrary host VNodes, `provide`/`inject`, or deep reactive object
  synchronisation.
- Server-side rendering, hydration, or a standalone Voya application framework.
- Claiming that WASM improves ordinary DOM-bound UI without measurement.
- A global CLI or a CLI bundled into runtime packages.

## Build decision

Use Cargo plus `wasm-bindgen` directly. `wasm-pack` is a useful publishing
wrapper but does not own Voya's Vite-oriented development workflow, incremental
cache, or generated component module shape. The future Vite plugin will invoke
the build pipeline; users will not need a global CLI.

The initial release profile uses size-oriented optimization and must be compared
against `opt-level = 3` on measured workloads before a default is chosen.

## ABI and component boundary

The first ABI supports JSON-compatible props and event payloads. JavaScript
calls into WASM only for mount, prop update, and dispose. DOM updates and event
delegation remain inside the component where possible. This avoids treating
individual DOM calls across the JS/WASM boundary as a performance strategy.

## Deferred decisions

- Rust component syntax and macro design.
- DOM renderer architecture: retained tree versus direct incremental updates.
- HMR state preservation semantics. The Stage 2 plugin rebuilds the Rust core
  and requests a full page reload when Rust source changes; it does not claim
  state preservation.
- CSS scoping and asset loading.
- A React adapter, to be reconsidered only after Stage 4.
