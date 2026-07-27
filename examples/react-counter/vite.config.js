import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { vooya } from "@vooya/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), vooya({ framework: "react" })],
});
