import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL || "";
const requestedWebServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || "npm run dev -- --port 4173";
const terminal4Preparation = "npm run prepare:terminal4-runtime";
const webServerCommand = requestedWebServerCommand.includes("prepare:terminal4-runtime")
  ? requestedWebServerCommand
  : `${terminal4Preparation} && ${requestedWebServerCommand}`;

async function applyKphxAuthoredGroundIsolationBeforeServer() {
  const isKphxDiagnostic = process.argv.some((argument) => argument.includes("kphx-ground-runtime.spec.js"));
  if (!isKphxDiagnostic || externalBaseURL) return;

  const sourcePath = path.resolve("src/environment/authoredKphxGround.js");
  let source = await readFile(sourcePath, "utf8");
  const anchor = "  environment.add(authored);";
  const occurrences = source.split(anchor).length - 1;
  if (occurrences !== 1) {
    throw new Error(`KPHX authored-ground source isolation expected 1 anchor, found ${occurrences}`);
  }

  source = source.replace(
    anchor,
    `  authored.visible = false;\n  authored.userData.diagnosticVisibilityAuthority = "hidden-complete-authored-adex-ground-before-vite";\n\n${anchor}`,
  );
  await writeFile(sourcePath, source, "utf8");
}

await applyKphxAuthoredGroundIsolationBeforeServer();

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 45_000,
  expect: { timeout: 15_000 },
  retries: 1,
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
        timeout: 120_000,
      },
});
