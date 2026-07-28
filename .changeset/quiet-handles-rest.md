---
"@vooya/vite-plugin": patch
"@vooya/vue": patch
"@vooya/react": patch
---

Use compiler-managed component IDs instead of wasm-bindgen class handles so framework teardown can safely dispose Rust components.
