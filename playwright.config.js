import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL || "";
// When CI already built dist/ and asks Playwright to serve that immutable
// artifact, apply the tiny final expectation migration before spec discovery.
// This touches browser tests only; it never modifies runtime geometry or assets.
if (process.env.PLAYWRIGHT_WEB_SERVER_COMMAND) {
  await import(`./scripts/prepare-kphx-final-browser-compat-v1.mjs?playwright=${Date.now()}`);
}

// Browser evidence must judge the exact production artifact, never a fresh
// development compilation of source that the clean build has already restored.
// Rebuilding here is intentional: it makes every direct Playwright invocation
// self-contained and then serves the immutable dist output through Vite preview.
const webServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND
  || "npm run build && npm run preview -- --port 4173 --strictPort";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  retries: 0,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: externalBaseURL || "http://127.0.0.1:4173",
    viewport: { width: 1280, height: 720 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseURL
    ? undefined
    : {
        command: webServerCommand,
        url: "http://127.0.0.1:4173",
        reuseExistingServer: false,
        timeout: 240_000,
      },
});
