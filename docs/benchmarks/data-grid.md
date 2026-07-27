# Data Grid Benchmark Plan

The first product-validation benchmark is a Vue data grid with a Vooya island
implementation and a Vue-only baseline. It is not a synthetic Rust-versus-JS
microbenchmark.

## Workload

- 100,000 generated rows with name and numeric score columns.
- Virtual scrolling with a fixed visible window.
- Client-side text filtering and numeric sorting.
- Repeated filter and scroll interactions after initial load.

## Measurements

- Compressed WASM and JavaScript asset sizes.
- Time from navigation to first interactive grid.
- Median and p95 interaction latency for filtering, sorting, and scrolling.
- Main-thread long tasks and peak memory under the same browser/device profile.
- The number of JS/WASM boundary crossings per interaction.

## Decision rule

Continue Stage 4 only when the Vooya implementation improves at least one
user-visible interaction under the target workload without introducing an
unacceptable first-load regression. The report must present both wins and
regressions; a faster isolated compute loop is insufficient evidence.

The first run and its decision are recorded in
[the Stage 3 result](2026-07-data-grid.md).
