# RFC 0003: Production Readiness for the First Public Alpha

## Status

Proposed for Stage 6. This RFC authorizes build and packaging work only; it
does not authorize publishing to npm.

## Release unit

The first alpha is a coordinated package set:

| Package | Responsibility | Peer dependency |
| --- | --- | --- |
| `@voyajs/core` | Browser WASM and generated JavaScript bindings | none |
| `@voyajs/vite-plugin` | Rust build, `.voya` transform, development reload | Vite |
| `@voyajs/vue` | Vue host lifecycle bridge | Vue 3 |
| `@voyajs/react` | React host lifecycle bridge | React 19 |

All packages share one `0.0.x-alpha.y` version initially. Independently
versioning adapters is deferred until the WASM ABI is explicitly stable.

## Alpha distribution decision

The first alpha uses **prebuilt component artifacts**. Rust components are built
before application bundling and checked into, or otherwise supplied to, the
application as WASM plus bindgen output. `@voyajs/core`, `@voyajs/vue`, and
`@voyajs/react` are runtime packages and do not require a user's machine to have
Cargo installed.

The current Vite plugin remains a repository development tool. It is not part
of the first installable alpha because its current compiler path is tied to the
Voya checkout. A portable compiler distribution, including a Vite-integrated
mode, is deferred until it can run against a consumer project's source tree.

## ABI rule

The Rust export names, generated bindgen module shape, and adapter binding
interfaces form one ABI. A core release is compatible only with adapters from
the same alpha version. The Vite plugin builds `@voyajs/core` from the checked-out
source during development; installed packages consume prebuilt artifacts.

The initial public release will use exact internal dependency versions. A
mismatch must fail during component loading with an actionable message, not
silently mount an incompatible module.

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
npm run typecheck
npm run typecheck:react
npm run build:vue
npm run build:react
npm pack --dry-run --workspace @voyajs/core
npm pack --dry-run --workspace @voyajs/vite-plugin
npm pack --dry-run --workspace @voyajs/vue
npm pack --dry-run --workspace @voyajs/react
```

The packed archives must contain built JavaScript, declarations, and the WASM
asset where required, with no examples, source-only exports, or local paths.

## Non-goals

- Publishing a package in this stage without an explicit user request.
- SSR and hydration.
- Browser-extension DevTools.
- Backward compatibility across pre-1.0 alpha ABI revisions.
