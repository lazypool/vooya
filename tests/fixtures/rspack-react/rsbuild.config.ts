import { defineConfig } from "@rsbuild/core";
import { pluginReact } from "@rsbuild/plugin-react";
import { vooyaRsbuild } from "@vooya/rspack";
export default defineConfig({ plugins: [pluginReact(), vooyaRsbuild({ framework: "react" })] });
