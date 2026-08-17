import { defineConfig } from "@rslib/core";
import { pluginVue } from "@rsbuild/plugin-vue";
import { vooyaRsbuild } from "@vooya/rspack";
export default defineConfig({ lib: [{ bundle: true }], output: { target: "web" }, plugins: [pluginVue(), vooyaRsbuild()] });
