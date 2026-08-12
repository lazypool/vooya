---
"@vooya/compiler": patch
"@vooya/artifact-vue-counter": patch
---

Expose the pure `.voo` parsing, formatting, declaration, style, and Rust wrapper
generation pipeline as `@vooya/compiler`. The existing Vite formatter subpath
continues to work as a compatibility forwarding entry.

Add the first Vue-only precompiled artifact vertical slice. Its packed consumer
uses shipped WASM and bindings without a Rust toolchain; React artifact support
is not included.
