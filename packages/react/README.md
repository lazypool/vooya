# `@vooya/react`

React 19 lifecycle adapter for Rust components compiled by Vooya.

```sh
npm install @vooya/react@alpha
npm install --save-dev @vooya/vite@alpha
```

Configure `vooya({ framework: "react" })` after `@vitejs/plugin-react`, then
import a `.voo` file as a normal React component. Generated declarations expose
its props and event callbacks to TypeScript.

This package is an alpha and must use the same version as the other `@vooya`
packages.
