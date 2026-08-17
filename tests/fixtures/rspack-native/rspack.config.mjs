import { resolve } from "node:path";
import { vooyaRspack } from "@vooya/rspack";

const plugin = vooyaRspack({ framework: "vue" });
export default {
  context: import.meta.dirname,
  mode: "production",
  entry: "./src/main.js",
  output: { path: resolve(import.meta.dirname, "dist"), clean: true },
  experiments: { css: true },
  module: { rules: [plugin.rule(), { test: /\.css$/, type: "css" }] },
  plugins: [plugin],
};
