# RFC 0006: Precompiled Vue artifacts

## Status

Implemented as an alpha vertical slice for `@vooya/artifact-vue-counter`.

## Artifact contents

The package contains `dist/manifest.json`, wasm-bindgen JavaScript and WASM under
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

The producer needs the existing Rust and wasm-bindgen build path. Consumers only
install the packed artifact and `@vooya/vue`: no Cargo, Rust target, or
wasm-bindgen is needed. The clean fixture builds with Rust tools absent from
PATH and loads the component in Chromium.

## Non-goals

No npm publication, remote registry, React support, event/diagnostics ABI
freezing, SSR, hydration, slots, or cross-island state are included.
