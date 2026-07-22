import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { voya } from "../../packages/vite-plugin/src/index.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root,
  plugins: [react(), voya({ framework: "react" })],
  resolve: {
    alias: {
      "@voyajs/core": `${repositoryRoot}/packages/core`,
      "@voyajs/react": `${repositoryRoot}/packages/react/src/index.tsx`,
    },
  },
});
