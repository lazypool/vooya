# Project Status

Vooya is a public alpha and an architecture-validation project. It is not a
stable compiler or a production compatibility promise. The latest published
coordinated release is `v0.1.0-alpha.5`; use the npm `alpha` tag to resolve the
latest published set.

The six packages form one coordinated release unit:

- `@vooya/compiler`
- `@vooya/core`
- `@vooya/vite-plugin`
- `@vooya/vue`
- `@vooya/react`
- `@vooya/artifact-vue-counter`

Use the same exact version for every package. The npm `alpha` dist-tag identifies
the latest published set, while `main` can contain changes queued for the next
prerelease.

## Working today

- Compile Rust directly from `<rust>` blocks into application-level WASM.
- Generate typed mount, prop update, event, dispose, and ABI bindings.
- Import one `.voo` file as a Vue 3 or React 19 component.
- Generate adjacent TypeScript declarations from component contracts.
- Compile optional PostCSS-based scoped styles.
- Map extracted Rust diagnostics back to `.voo` source lines.
- Configure registry, Git, and application-relative path dependencies.
- Recover from Rust build errors and coalesce rapid development saves.
- Format `.voo` files and package a VS Code syntax extension.
- Validate Vue Counter, React Counter, TaskList, and 100,000-row DataGrid flows
  in real browsers.
- Validate loop-created Rust listeners, cloned event dispatch, and repeated
  mount/unmount behavior in both Vue and React browser fixtures.
- Ship `vooya doctor` for Rust target, CLI-version, and rustup-path diagnostics.
- Demonstrate a Vue-hosted 150,000-point Rust/WASM Canvas scatter plot.
- Build packed npm artifacts from a project outside the repository checkout.
- Consume the Vue-only `@vooya/artifact-vue-counter` reference artifact in a
  clean Vite project without Cargo, Rust, a Rust target, `wasm-bindgen`, or the
  Vite plugin. It demonstrates the retained requirement that each precompiled
  component is consumable as one explicit package.

## Current limits

- Source consumers need Cargo, the WASM target, and `wasm-bindgen-cli`; the
  Vue-only precompiled artifact consumer does not.
- React artifact consumption is not implemented.
- A non-trivial component still uses some direct `web_sys` APIs.
- The contract is limited to primitive prop and event values.
- Reactive dependencies and cleanup are explicit and minimal.
- Successful Rust HMR performs a full reload and loses component state.
- The VS Code extension does not bridge `.voo` Rust into rust-analyzer.
- `vooya doctor` is a local diagnostic, not a toolchain installer or an
  automatic Homebrew/rustup selector.
- SSR, hydration, slots, and standalone application rendering are out of scope.
- Alpha ABI revisions can be breaking.
- The current browser evidence covers the repository's Playwright Chromium
  project plus one Firefox Vue source-component path; see the
  [compatibility matrix](compatibility.md).

## Next milestones

1. Grow the Rust view layer into declarative trees, reactive bindings, and
   explicit effect cleanup.
2. Build a generic artifact producer and supported component products that can
   supersede the Vue-only reference artifact; React artifact consumption
   remains unimplemented.
3. Bridge extracted Rust source to rust-analyzer for completion, navigation,
   and diagnostics.
4. Define state-preserving HMR semantics.
5. Expand component contracts beyond primitive values.
6. Establish and continuously test a browser and framework compatibility
   matrix.

The benchmark result remains deliberately modest: the first 100,000-row case
showed approximate parity with its Vue baseline. See the
[recorded result](../benchmarks/2026-07-data-grid.md) rather than assuming WASM
is automatically faster.
