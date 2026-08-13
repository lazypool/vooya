# Compatibility matrix

This matrix records browser tests that run in this repository. It is not a
cross-browser certification, a production-support promise, or a claim about
SSR and hydration. Each entry is evidence for the named test path only.

## Verified in the local Playwright Chromium project

| Consumer path | Verified behavior | Evidence |
| --- | --- | --- |
| Vue 3 source `.voo` | Mount, prop updates, typed events, scoped styles, failed-mount cleanup, lifecycle diagnostics, repeated unmount/remount | `npm run test:e2e` (Vue target) |
| React 19 source `.voo` | Mount, prop updates, typed events, failed-mount cleanup, lifecycle diagnostics, repeated unmount/remount | `npm run test:e2e` (React target) |
| Vue TaskList | Reactive state, keyed rows, filtering, validation error state | `npm run test:e2e` (tasks target) |
| Vue DataGrid | Filter, sort, virtual scroll, local measurement control | `npm run test:e2e` (benchmark target) |
| Vue Canvas scatter | 150,000-point initial island, point-count update, zoom/reset, no page or console error | `npm run test:e2e:scatter` |
| Vue precompiled artifact | Packed artifact in a clean Vite consumer without Rust tooling; WASM mount and prop update | `npm run test:artifact` |

## Not verified / not supported yet

- Firefox, WebKit/Safari, mobile browsers, SSR, and hydration have no current
  compatibility claim.
- React precompiled artifact consumption is not implemented.
- Alpha ABI revisions may be breaking; use one exact coordinated `@vooya`
  package version.

## Updating this matrix

Add an entry only with an automated command that runs against a fresh browser
or packed consumer. State the exact framework and browser project; do not turn
a passing Chromium fixture into a general browser-support statement.
