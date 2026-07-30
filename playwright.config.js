import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL || "";
const requestedWebServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || "npm run dev -- --port 4173";
const terminal4Preparation = "npm run prepare:terminal4-runtime";
const webServerCommand = requestedWebServerCommand.includes("prepare:terminal4-runtime")
  ? requestedWebServerCommand
  : `${terminal4Preparation} && ${requestedWebServerCommand}`;

async function applyKphxAsphaltIsolationBeforeServer() {
  const isKphxDiagnostic = process.argv.some((argument) => argument.includes("kphx-ground-runtime.spec.js"));
  if (!isKphxDiagnostic || externalBaseURL) return;

  const assetsDirectory = path.resolve("dist/assets");
  const files = (await readdir(assetsDirectory)).filter((file) => file.endsWith(".js"));
  const initialAsphalt = /([A-Za-z_$][\w$]*)\.name==="asphalt"\?\(\1\.visible=!0,/;
  const photoAsphalt = /if\(([A-Za-z_$][\w$]*)\.has\(([A-Za-z_$][\w$]*)\.name\)\)\{\2\.visible=!0,/;
  let initialPatchCount = 0;
  let photoPatchCount = 0;

  for (const file of files) {
    const filePath = path.join(assetsDirectory, file);
    let body = await readFile(filePath, "utf8");
    if (initialAsphalt.test(body)) {
      body = body.replace(initialAsphalt, (statement, materialName) =>
        statement.replace(`${materialName}.visible=!0`, `${materialName}.visible=!1`));
      initialPatchCount += 1;
    }
    if (photoAsphalt.test(body) && body.includes("source-matched-charcoal-asphalt-with-shadow-floor-v1")) {
      body = body.replace(photoAsphalt, (statement, _setName, materialName) =>
        statement.replace(`${materialName}.visible=!0`, `${materialName}.visible=!1`));
      photoPatchCount += 1;
    }
    await writeFile(filePath, body, "utf8");
  }

  if (initialPatchCount !== 1 || photoPatchCount !== 1) {
    throw new Error(`KPHX pre-server asphalt isolation expected 1+1 patches, found ${initialPatchCount}+${photoPatchCount}`);
  }
}

await applyKphxAsphaltIsolationBeforeServer();

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
