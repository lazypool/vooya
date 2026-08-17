# Project Status

Vooya is a public alpha and an architecture-validation project. It is not a
stable compiler or a production compatibility promise. The latest published
coordinated release is `v0.1.0-alpha.7`; use the npm `alpha` tag to resolve the
latest published set.

The seven packages form one coordinated release unit:

- `@vooya/compiler`
- `@vooya/core`
- `@vooya/build-core`
- `@vooya/vite-plugin`
- `@vooya/vue`
- `@vooya/react`
- `@vooya/rspack`

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
- Ship `vooya doctor` for coherent Cargo-selected Rust target, CLI-version, and rustup-path diagnostics.
- Demonstrate a Vue-hosted 150,000-point Rust/WASM Canvas scatter plot.
- Build packed npm artifacts from a project outside the repository checkout.
- Verify a test-only precompiled Vue WASM consumer in a clean Vite project
  without Cargo, Rust, a Rust target, `wasm-bindgen`, or the Vite plugin.

## Current limits

- Source consumers need Cargo, the WASM target, and `wasm-bindgen-cli`.
- Vite 7 and Vite 8 are the stable source-authoring bundler paths. Rspack 2.1
  has an experimental first-party adapter with Rsbuild, Rslib, and direct
  Rspack fixtures. Webpack, Rollup, and other bundlers remain unsupported.
- Vite+ has a compatibility smoke path because it aliases Vite to its bundled
  Vite core; it is not a separate Vooya bundler integration or a promise that
  every Vite+ workflow is supported.
- No precompiled component product is currently published; the retained Vue
  fixture is build-contract evidence, not a user-facing package.
- A non-trivial component still uses some direct `web_sys` APIs.
- The contract is limited to primitive prop and event values.
- Reactive dependencies and cleanup are explicit and minimal.
- Successful Rust HMR performs a full reload and loses component state.
- The VS Code extension can run an explicit embedded-Rust diagnostics check and
  checks saved `.voo` documents through a generated local rust-analyzer
  workspace. It intentionally does not provide rust-analyzer completion,
  navigation, rename, or code actions inside `.voo` documents.
- `vooya doctor` is a local diagnostic and deterministic PATH candidate selector,
  not a toolchain installer; it warns when its valid Cargo choice differs from
  the first Cargo on `PATH`.
- SSR, hydration, slots, and standalone application rendering are out of scope.
- Alpha ABI revisions can be breaking.
- The current browser evidence covers the repository's Playwright Chromium
  project plus one Firefox Vue source-component path; see the
  [compatibility matrix](compatibility.md).

## Next milestones

1. Grow the Rust view layer into declarative trees, reactive bindings, and
   explicit effect cleanup.
2. Design a supported, explicitly named component product on top of the generic
   precompiled Vue producer.
3. Evaluate editor interactions beyond diagnostics only after their `.voo`
   source mapping and lifecycle semantics can be specified and tested.
4. Define state-preserving HMR semantics.
5. Expand component contracts beyond primitive values.
6. Establish and continuously test a browser and framework compatibility
   matrix.

The benchmark result remains deliberately modest: the first 100,000-row case
showed approximate parity with its Vue baseline. See the
[recorded result](../benchmarks/2026-07-data-grid.md) rather than assuming WASM
is automatically faster.
