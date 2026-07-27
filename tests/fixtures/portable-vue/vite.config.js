import vue from "@vitejs/plugin-vue";
import { voya } from "@voyajs/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [vue(), voya()],
});
