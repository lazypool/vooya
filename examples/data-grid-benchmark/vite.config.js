import { fileURLToPath, URL } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";
import { voya } from "../../packages/vite-plugin/src/index.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  root,
  plugins: [vue(), voya()],
  resolve: {
    alias: {
      "@voya/core": `${repositoryRoot}/packages/core`,
      "@voya/vue": `${repositoryRoot}/packages/vue/src/index.ts`,
    },
  },
});
