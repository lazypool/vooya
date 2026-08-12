# RFC 0004: `.voo` Compiler Boundary

## Status

Implemented for the public alpha.

## Decision

`@vooya/compiler` owns the pure `.voo` compilation pipeline:

```text
.voo source -> parsed component IR -> Rust wrapper / framework contract /
               TypeScript declaration text / scoped CSS / formatted source
```

The parsed component IR retains its source identifier and source line metadata.
The Rust build layer uses that metadata to map diagnostics from extracted Rust
files back to the originating `.voo` source.

`@vooya/vite-plugin` owns Vite-specific and filesystem work: project scanning,
declaration-file writes, application cache paths, Cargo and wasm-bindgen
execution, diagnostic rendering, virtual module generation, watching, and Vite
hooks.

## Public compiler API

`@vooya/compiler` exports the parser and parse error type, Rust wrapper and
adapter-contract generators, TypeScript declaration generator, scoped-style
compiler, and `.voo` formatter. It does not scan projects, write files, invoke
Rust tools, or depend on Vite.

`@vooya/vite-plugin/format` remains available and forwards to the compiler
formatter, so existing formatter imports and the `voo-format` executable use
the same implementation.

## Compatibility

This boundary does not change `.voo` syntax, the generated WASM ABI, or the
Vue and React adapter interfaces.

## Non-goals

- A new `.voo` syntax or source language.
- A standalone compiler CLI.
- Artifact registry, DevTools, or protocol packages.
- Changes to the Rust runtime or host adapter behavior.
