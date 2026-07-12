import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const isGitHubPagesBuild = process.env.GITHUB_PAGES === "true";

export default defineConfig({
  plugins: [react()],
  base: isGitHubPagesBuild ? "/RampReady/" : "/",
  build: {
    outDir: "dist",
    sourcemap: true,
  },
});
