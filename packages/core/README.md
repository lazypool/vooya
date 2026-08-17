# `@vooya/core`

Rust and browser runtime used by the Vooya component compiler.

The package contains the Rust runtime source consumed by `@vooya/vite`
and baseline wasm-bindgen output. Application code normally imports `.voo`
components instead of importing this package directly.

This package is an alpha. Source `.voo` compilation requires Cargo, the
`wasm32-unknown-unknown` target, and the matching `wasm-bindgen` CLI.
