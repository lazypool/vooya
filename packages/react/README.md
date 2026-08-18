# `@vooya/react`

React `>=19` lifecycle adapter for Rust components compiled by Vooya.

```sh
npm install @vooya/react@alpha
npm install --save-dev @vooya/vite@alpha
```

Configure `vooya({ framework: "react" })` after `@vitejs/plugin-react`, then
import a `.voo` file as a normal React component. Generated declarations expose
its props and event callbacks to TypeScript.

## Prop defaults

A `.voo` prop declared with a default (for example `name: String = "world"`) is
optional in the generated React props, and the default is passed to the WASM
`mount` when the consumer omits the prop. Explicit values — including `false`,
`0`, and `""` — are passed through untouched.

The same resolution applies to later prop updates: if a consumer removes a
previously set prop, the declared default is passed again. This matches the
`@vooya/vue` adapter's semantics.

This package is an alpha and must use the same version as the other `@vooya`
packages.
