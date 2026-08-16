import { defineConfig } from "@rsbuild/core";
import { pluginVue } from "@rsbuild/plugin-vue";
import { vooyaRsbuild } from "@vooya/rspack";

export default defineConfig({
  plugins: [pluginVue(), vooyaRsbuild({ rust: { dependencies: { counter_math: { path: "rust/counter-math", package: "counter-math" } } } })],
});
