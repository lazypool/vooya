import vue from "@vitejs/plugin-vue";
import { vooya } from "@vooya/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    vue(),
    vooya({
      rust: {
        dependencies: {
          "portable-math": { path: "rust/portable-math" },
        },
      },
    }),
  ],
});
