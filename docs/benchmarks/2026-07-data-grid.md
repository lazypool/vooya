# 100k Data Grid: Stage 3 Result

## Decision

**Narrow pass.** The Voya island was faster than the Vue baseline for this
specific local, filter-and-sort-heavy workload, but the difference is too small
to justify a general "WASM UI is faster" claim. Continue to Stage 4 only to
test whether a reusable component model can reduce the cost of the current
special-purpose runtime; do not treat this benchmark as product-market proof.

## Workload

Both panes in `examples/data-grid-benchmark` generate the same 100,000 local
rows. Each pane sorts by score, filters by twenty fixed query prefixes, and
renders only a 24-row virtual window. Clicking **Run filter benchmark** runs
twenty rounds of those twenty filter/sort operations, then reports median and
p95 wall time in the page.

The Voya pane keeps the row data, filtering, sorting, and DOM window renderer
in Rust/WASM. The Vue pane keeps the equivalent data and computed list in Vue.
Both render the final matching 1,000-row result after the same final query.

## Environment

- macOS 26.5.1 on arm64.
- Node 22.22.0, Vite 7.3.6, Vue 3.5.
- Rust 1.94.0 and `wasm-bindgen` 0.2.115.
- Browser validation through Playwright against the Vite development server.

## Result

| Implementation | Median | p95 | Relative median |
| --- | ---: | ---: | ---: |
| Voya WASM island | 36.0 ms | 37.0 ms | 1.00x |
| Vue baseline | 37.4 ms | 39.3 ms | 1.04x slower |

The production Vite build emitted a 115.09 KB WASM file, 45.82 KB gzip. The
JavaScript entry was 28.94 KB gzip. The WASM asset is a real adoption cost, but
is within a reasonable initial budget for an explicitly selected, heavy widget;
it is not acceptable as a default replacement for ordinary components.

## Interpretation

The result confirms the component-island boundary works without erasing the
benefit from local computation. It does **not** demonstrate a transformative
speed-up. The primary remaining opportunity is avoiding repeated full-list
sorting and making renderer updates incremental, rather than merely moving the
same algorithm into Rust.

## Reproduction

```bash
npm install
npm run dev:benchmark
```

Open the reported local URL, click each pane's **Run filter benchmark**, and
record the values displayed by that run. Production asset sizes come from:

```bash
npm run build:benchmark
```
