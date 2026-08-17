# Changelog

## v0.1.0-alpha.8

### Features

- Add the first experimental Rspack 2.1 source `.voo` integration for Vue and React, backed by the shared Rust/WASM build core, strict packed fixtures, browser lifecycle checks, mapped diagnostics, and configured Rust path dependencies.

### Fixes

- Publish complete TypeScript declarations for the compiler and Vite plugin, remove duplicated generated JavaScript from source control, and add the first public contribution and issue-reporting workflow.
- Verify Vite 8 source authoring, keep the runtime ABI entry browser-light, and record the Vite+ compatibility smoke path without presenting it as a separate bundler adapter.

### Dependencies

- Update vooya-build-core to 0.1.0-alpha.8.
- Update vooya-compiler to 0.1.0-alpha.8.
- Update vooya-core to 0.1.0-alpha.8.

## v0.1.0-alpha.7

### Maintenance

- Adopt Semifold for coordinated alpha releases and migrate repository-owned tooling implementation to TypeScript while retaining JavaScript consumer outputs.

### Dependencies

- Update vooya-compiler to 0.1.0-alpha.7.
- Update vooya-core to 0.1.0-alpha.7.
