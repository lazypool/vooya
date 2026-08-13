# Trace Waterfall Candidate

The trace-waterfall example models a local triage task: filter 12,000 synthetic spans by service, zoom the timeline, and focus the longest span. The Rust island and Vue baseline use the same deterministic span count, service distribution, viewport size, and 4-service × 12-round measurement shape.

The displayed median and p95 are page-local wall times. They include filtering, layout, and visible DOM updates in the active browser. They are not a throughput claim, a production tracing-data benchmark, or evidence that WASM is faster.

Reproduce with:

```bash
npm run dev:trace
```

Use **Measure workload** in each pane and record both displayed values with the browser, hardware, and versions used. The automated interaction regression is:

```bash
VOOYA_E2E_TARGET=trace playwright test
```

Use this record format for a real run; leave fields blank rather than inventing a comparison result:

```text
Date:
Browser + version:
OS / hardware:
Vooya commit:
Rust pane median / p95:
Vue pane median / p95:
Notes (cold/warm page, throttling, deviations):
```
