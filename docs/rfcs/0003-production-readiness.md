# RFC 0003: Production Readiness for the First Public Alpha

## Status

Proposed for Stage 6. This RFC authorizes build and packaging work only; it
does not authorize publishing to npm.

## Release unit

The first alpha is a coordinated package set:

| Package | Responsibility | Peer dependency |
| --- | --- | --- |
| `@voyajs/core` | Rust runtime source and baseline browser bindings | none |
| `@voyajs/vite-plugin` | Rust build, `.voo` transform, development reload | Vite |
| `@voyajs/vue` | Vue host lifecycle bridge | Vue 3 |
| `@voyajs/react` | React host lifecycle bridge | React 19 |

All packages share one `0.0.x-alpha.y` version initially. Independently
versioning adapters is deferred until the WASM ABI is explicitly stable.

## Compiler distribution decision

The Vite plugin compiles source `.voo` files in a generated, application-local
Cargo crate under `.voo-cache`. `@voyajs/core` ships the Rust runtime source used
by that crate. Each application has isolated Cargo targets and wasm-bindgen
output; no build writes component exports into a shared package directory.

Source component authors therefore need Cargo, the `wasm32-unknown-unknown`
target, and the matching `wasm-bindgen` CLI. `npm run test:portable` packs the
local npm packages, installs them in a temporary project outside the checkout,
and builds a source `.voo` component there.

Precompiled component artifacts remain a separate release milestone. Their
consumers must not need a Rust toolchain; the author or CI builds the WASM and
framework adapters before publication.

## ABI rule

The Rust export names, generated bindgen module shape, and adapter binding
interfaces form one ABI. A core release is compatible only with adapters from
the same alpha version. The Vite plugin builds an application-specific WASM
module against the Rust runtime source shipped by `@voyajs/core`.

Generated WASM exports `voo_abi_version()`. The virtual component module checks
that value against the compiler runtime before returning mount bindings. A
mismatch fails during component loading with both expected and actual versions
in the error; it never reaches the component mount function.

The initial public release will also use exact internal dependency versions.

## Error model

The host adapters must surface three failures at the component boundary:

- WASM fetch or initialization failure.
- ABI/binding mismatch.
- Rust mount failure.

Vue exposes these as an `error` emit; React exposes an `onError` callback. The
adapter must keep the host element empty after a failed mount and must not leave
an event listener or handle alive.

## Development instrumentation

Voya dispatches non-bubbling development events from the host element for mount,
mount failure, update, and dispose. A future DevTools package can observe these
events without becoming part of the runtime dependency graph.

## Release gate

Before changing package visibility or publishing an alpha, CI must pass:

```bash
cargo test -p voya-core
npm run test:voo
npm run test:portable
npm run test:e2e
npm run typecheck
npm run typecheck:react
npm run build:vue
npm run build:react
npm pack --dry-run --workspace @voyajs/core
npm pack --dry-run --workspace @voyajs/vite-plugin
npm pack --dry-run --workspace @voyajs/vue
npm pack --dry-run --workspace @voyajs/react
```

The packed archives must contain the compiler JavaScript, adapter JavaScript and
declarations, baseline WASM where required, and the `@voyajs/core` Rust runtime
source. They must not contain examples, generated application caches, or paths
that point back to the Voya checkout.

## Non-goals

- Publishing a package in this stage without an explicit user request.
- SSR and hydration.
- Browser-extension DevTools.
- Backward compatibility across pre-1.0 alpha ABI revisions.
