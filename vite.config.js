import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const legacyAircraftModel = fileURLToPath(new URL("./src/components/aircraft/crj700Model.js", import.meta.url));
const runtimeAircraftModel = fileURLToPath(new URL("./src/components/aircraft/crj700RuntimeModel.js", import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@legacy-crj700", replacement: legacyAircraftModel },
      { find: legacyAircraftModel, replacement: runtimeAircraftModel },
    ],
  },
  base: "/RampReady/",
  build: {
    outDir: "dist",
    sourcemap: true,
    // Separate, opt-in GLB review route. The main simulator entry remains
    // unchanged; GitHub Pages can serve both as ordinary static files.
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        a1CrewPreview: fileURLToPath(new URL("./a1-crew-preview.html", import.meta.url)),
      },
    },
  },
});
