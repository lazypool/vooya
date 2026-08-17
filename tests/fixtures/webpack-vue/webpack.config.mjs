import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import HtmlWebpackPlugin from "html-webpack-plugin";
import { vooyaWebpack } from "@vooya/webpack";

const root = dirname(fileURLToPath(import.meta.url));
const vooya = vooyaWebpack({
  framework: "vue",
  rust: {
    dependencies: {
      counter_math: { path: "rust/counter-math", package: "counter-math" },
    },
  },
});

export default {
  context: root,
  entry: "./src/main.js",
  output: { path: resolve(root, "dist"), clean: true },
  experiments: { asyncWebAssembly: true },
  module: {
    rules: [
      vooya.rule(),
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
    ],
  },
  plugins: [vooya, new HtmlWebpackPlugin({ template: "index.html" })],
};
