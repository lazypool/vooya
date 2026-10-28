---
"@vooya/rspack": patch
"@vooya/webpack": patch
---

Promote the Vue/React Rust-file integrations from experimental to supported. Update package descriptions and setup guidance, and extend packed watch and development-server recovery acceptance to React alongside Vue. The supported contract covers production WASM/CSS, generated declarations, Components/Stores, props/events, lifecycle and rebuild recovery within the documented matrix.

Use the current 0.2 alpha package graph; this support decision does not change npm release channels. Solid/Svelte on these bundlers, SSR, hydration, Module Federation and state-preserving Rust HMR remain outside the supported contract.
