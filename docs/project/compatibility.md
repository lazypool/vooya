# Compatibility matrix

This matrix records browser tests that run in this repository. It is not a
cross-browser certification, a production-support promise, or a claim about
SSR and hydration. Each entry is evidence for the named test path only.

## Verified in local Playwright projects

| Consumer path | Verified behavior | Evidence |
| --- | --- | --- |
| Vue 3 source `.voo` | Mount, prop updates, typed events, scoped styles, failed-mount cleanup, lifecycle diagnostics, repeated unmount/remount | `npm run test:e2e` (Vue target) |
| React 19 source `.voo` | Mount, prop updates, typed events, failed-mount cleanup, lifecycle diagnostics, repeated unmount/remount | `npm run test:e2e` (React target) |
| Vue TaskList | Reactive state, keyed rows, filtering, validation error state | `npm run test:e2e` (tasks target) |
| Vue DataGrid | Filter, sort, virtual scroll, local measurement control | `npm run test:e2e` (benchmark target) |
| Vue Canvas scatter | 150,000-point initial island, point-count update, zoom/reset, no page or console error | `npm run test:e2e:scatter` |
| Vue precompiled build fixture | Generated WASM in a clean Vite consumer without Rust tooling; mount and prop update | `npm run test:precompiled-vue` |
| Vue 3 source `.voo` in Firefox | Mount, prop updates, typed events, scoped styles, failed-mount cleanup, lifecycle diagnostics, repeated unmount/remount | `npm run test:e2e:firefox` |

## Verified bundler/toolchain matrix

These entries run against packed Vooya packages in a fresh temporary consumer.
The evidence and boundary columns state the exact checks exercised by each
toolchain; a production smoke does not imply development-server or HMR support.

| Toolchain | Verified version | Evidence | Boundary |
| --- | --- | --- | --- |
| Vite | 8.2.1 | `npm run test:vite8` | Strict install, production output and browser WASM loading, development mount, Rust dependency rebuilds, full reload, failed-build recovery, and coalesced rapid saves; Vite 7 remains covered by the repository fixtures and release gate |
| Vite+ | 0.2.9 | `npm run test:vite-plus` | Production output and browser WASM loading using Vite+'s Vite core alias; the alias currently requires npm legacy peer resolution, and development rebuild and HMR behavior are not claimed |
| Rspack / Rsbuild | Rspack 2.1.10, Rsbuild 2.1.13 | `npm run test:rspack` | Strict packed Vue/React/Rslib/native-Rspack builds, WASM and scoped CSS output, Vue/React Chromium lifecycle checks, mapped Rust diagnostics, failed-build recovery, and `.voo` source rebuild/full reload; configured Rust path dependencies require a dev-server restart after edits, and this is an experimental 2.1-only claim |

## Not verified / not supported yet

- WebKit/Safari, mobile browsers, SSR, and hydration have no current
  compatibility claim. Firefox evidence is limited to the named Vue source
  component path above.
- No precompiled component product is currently published; the Vue fixture is
  build-contract evidence only.
- Webpack, Rollup, and other unlisted bundlers have no current `.voo`
  compatibility claim. Rspack evidence is limited to the experimental 2.1 row
  above and does not imply Rspack 1.x or every 2.x release.
- Vite+ adds a CLI, runtime/package-manager management, and a Vite core alias;
  it does not remove the need for the normal `vooya()` Vite plugin. Its smoke
  path is intentionally tracked separately from the Vite support promise.
- Alpha ABI revisions may be breaking; use one exact coordinated `@vooya`
  package version.

## Updating this matrix

Add an entry only with an automated command that runs against a fresh browser
or packed consumer. State the exact framework and browser project; do not turn
a passing Chromium fixture into a general browser-support statement.
