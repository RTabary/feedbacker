import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const directory = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  build: {
    lib: {
      entry: resolve(directory, "src/index.ts"),
      formats: ["iife"],
      name: "feedbackerConnector",
      fileName: () => "connector.js",
    },
    outDir: resolve(directory, "../../apps/web/public"),
    emptyOutDir: false,
    minify: true,
  },
});
