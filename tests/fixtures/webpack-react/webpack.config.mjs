import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import HtmlWebpackPlugin from "html-webpack-plugin";
import { vooyaWebpack } from "@vooya/webpack";

const root = dirname(fileURLToPath(import.meta.url));
const vooya = vooyaWebpack({ framework: "react" });

export default {
  context: root,
  entry: "./src/main.jsx",
  output: { path: resolve(root, "dist"), clean: true },
  resolve: { extensions: [".js", ".jsx"] },
  experiments: { asyncWebAssembly: true },
  module: {
    rules: [
      vooya.rule(),
      {
        test: /\.jsx$/,
        use: {
          loader: "babel-loader",
          options: { presets: [["@babel/preset-react", { runtime: "automatic" }]] },
        },
      },
      { test: /\.css$/, use: ["style-loader", "css-loader"] },
    ],
  },
  plugins: [vooya, new HtmlWebpackPlugin({ template: "index.html" })],
};
