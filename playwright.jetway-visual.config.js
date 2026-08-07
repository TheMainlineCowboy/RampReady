import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./scripts",
  testMatch: "verify-jetway-visual-registration.spec.js",
  timeout: 720_000,
  expect: { timeout: 45_000 },
  retries: 0,
  workers: 1,
  use: {
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
