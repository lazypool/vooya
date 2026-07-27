import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { voya } from "@vooya/vite-plugin";
import { defineConfig } from "vite";

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react(), voya({ framework: "react" })],
});
