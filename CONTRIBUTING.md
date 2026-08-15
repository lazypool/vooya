# Contributing to Vooya

Thank you for helping make Rust-backed components easier to use in existing
Vue and React applications. Vooya is still a public alpha, so focused changes
with clear evidence are more useful than broad framework promises.

## Before you start

- Small documentation fixes can be submitted directly as a pull request.
- Bugs should use the bug report template and include a minimal reproduction.
- Features, public API changes, new syntax, and architecture changes should
  start with an issue. Large accepted designs can then become an RFC under
  `docs/rfcs/`.
- Check the current product boundary in
  [Issue #16](https://github.com/vooyajs/vooya/issues/16). Do not assume that a
  future idea is already supported.

If you want a newcomer-sized task, look for issues labeled
[`good first issue`](https://github.com/vooyajs/vooya/labels/good%20first%20issue)
or [`help wanted`](https://github.com/vooyajs/vooya/labels/help%20wanted).

## Development setup

You need:

- Node.js `^20.19.0` or `>=22.12.0`;
- npm;
- a stable Rust toolchain managed by [rustup](https://rustup.rs/);
- the `wasm32-unknown-unknown` target; and
- `wasm-bindgen-cli` `0.2.115` for the current alpha.

```sh
npm install
rustup target add wasm32-unknown-unknown
cargo install wasm-bindgen-cli --version 0.2.115 --locked
npm exec -- vooya doctor
```

Windows contributors using the MSVC Rust toolchain also need Visual Studio
Build Tools with the **Desktop development with C++** workload, MSVC C++ build
tools, and a Windows SDK.

## Repository rules

### TypeScript is the implementation source

The compiler and JavaScript tooling are authored in TypeScript under
`packages/*/source` (or the package's documented source directory). Package
builds emit executable JavaScript and declarations into `dist/`.

- Edit the TypeScript source, not generated `dist/` files.
- Do not commit generated package JavaScript as a second source tree.
- Published packages must contain JavaScript and accurate `.d.ts` declarations;
  consumers do not need TypeScript installed at runtime.

### Keep claims evidence-based

- Distinguish current behavior, experimental behavior, and future plans.
- Do not claim that Rust or WASM is universally faster.
- Performance changes need a reproducible browser workload and comparison.
- A successful typecheck is not proof that a `.voo` component mounts, updates,
  emits events, disposes, and recovers after a failed Rust build.

### Keep private coordination out of the repository

Do not commit local collaboration logs, agent prompts, volunteer evaluations,
private contact details, or unpublished commitments. Mature technical decisions
belong in public issues, RFCs, tests, or user-facing documentation.

## Testing

Run the smallest relevant checks while developing. Common commands include:

```sh
npm run test:compiler
npm run test:voo
npm run typecheck
npm run typecheck:react
npm run verify:docs
npm run pack:check
```

The complete release gate is:

```sh
npm run verify:ci
```

Rust/WASM builds can share generated artifacts, so run build-dependent suites
serially unless a test explicitly documents that parallel execution is safe.

## Pull requests

Keep each pull request reviewable:

1. explain the user problem and the chosen boundary;
2. link the issue for non-trivial behavior or public API changes;
3. add or update tests for behavior changes;
4. update documentation when the user workflow changes;
5. list the exact verification you ran; and
6. avoid unrelated formatting or generated-file churn.

Vooya uses Semifold for coordinated package releases. Do not edit package
versions, changelogs, or exact internal dependency versions by hand. A
maintainer will confirm whether a user-visible change needs a Semifold entry;
when requested, create it with:

```sh
npm run changeset
```

## Reporting security issues

Please follow [SECURITY.md](SECURITY.md) and avoid publishing exploit details in
a normal issue.

By participating, you agree to follow the repository's
[Code of Conduct](CODE_OF_CONDUCT.md).
