# RFC 0006: Precompiled Vue artifacts

## Status

Implemented as an alpha reference artifact / validation specimen for
`@vooya/artifact-vue-counter`. It is a reusable build-contract prototype, not the
intended durable name of a component product.

## Artifact contents

`buildPrecompiledVueArtifact` from `@vooya/vite-plugin/build` accepts one explicit
artifact package root and one source `.voo` component. It validates the package
identity and exact Vue-adapter version, then produces `dist/manifest.json`,
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

The producer needs the existing Rust and wasm-bindgen build path. Consumers
install one explicit precompiled-component package; its framework adapter is
transitive, and no Cargo, Rust target, wasm-bindgen, or Vite plugin is needed.
The clean fixture builds with Rust tools absent from PATH and loads the component
in Chromium. The current package has an exact `@vooya/vue` dependency, so it
remains compatible with the fixed alpha release group.

A generic artifact builder and supported component products may supersede this
specimen later. Historical published versions will not be unpublished. Any
future artifact package should be named for the component product users adopt,
not for this packaging experiment.

## Non-goals

No npm publication, remote registry, React support, event/diagnostics ABI
freezing, SSR, hydration, slots, or cross-island state are included.
