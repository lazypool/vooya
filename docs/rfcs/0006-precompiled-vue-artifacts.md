# RFC 0006: Precompiled Vue artifacts

## Status

The initial alpha validation specimen was published as
`@vooya/artifact-vue-counter`. It was retired from the coordinated release unit:
it proved a build contract, not a useful component product. The generic builder
and a test-only consumer proof remain. Historical npm versions are not removed.

## Artifact contents

`buildPrecompiledVueArtifact` from `@vooya/vite-plugin/build` accepts one explicit
artifact package root and one source `.voo` component. It validates the package
root, non-empty package identity and version, source location, and exact
Vue-adapter version. The source must remain under the package root and output
is deliberately restricted to `packageRoot/dist`. It then produces `dist/manifest.json`,
wasm-bindgen JavaScript and WASM under
`dist/wasm`, a Vue component entry, and TypeScript declarations. The manifest
records format, framework, component, artifact and ABI versions, binding names,
and the WASM/type paths.

The entry initializes the shipped binding, checks its WASM ABI against the
manifest, and passes generated mount/update/dispose bindings to `@vooya/vue`.

## Compatibility

This slice supports Vue only. React artifact consumption is not implemented.
An ABI disagreement throws `Vooya artifact ABI mismatch for <component>:
artifact expects <expected>, but WASM provides <actual>.` before mount.

## Consumer boundary

The producer needs the existing Rust and wasm-bindgen build path. The retained
clean fixture builds generated WASM with Rust tools absent from the consumer
PATH and loads it in Chromium. It is not an installation API.

Any future precompiled package must be named for a component product users
actually adopt, carry its framework adapter transitively, and have a clean
consumer contract. It must not use `artifact-*` or a demo name as its product
identity.

## Non-goals

No npm publication, remote registry, React support, event/diagnostics ABI
freezing, SSR, hydration, slots, or cross-island state are included.
