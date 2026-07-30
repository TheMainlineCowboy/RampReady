import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL || "";
const requestedWebServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || "npm run dev -- --port 4173";
const terminal4Preparation = "npm run prepare:terminal4-runtime";
const webServerCommand = requestedWebServerCommand.includes("prepare:terminal4-runtime")
  ? requestedWebServerCommand
  : `${terminal4Preparation} && ${requestedWebServerCommand}`;

async function applyKphxSourceAerialIsolationBeforeServer() {
  const isKphxDiagnostic = process.argv.some((argument) => argument.includes("kphx-ground-runtime.spec.js"));
  if (!isKphxDiagnostic || externalBaseURL) return;

  const assetsDirectory = path.resolve("dist/assets");
  const files = (await readdir(assetsDirectory)).filter((file) => file.endsWith(".js"));
  const sourceAerialGroup = /(return ([A-Za-z_$][\w$]*)\.add\(\.\.\.[A-Za-z_$][\w$]*\),)\2\.userData\.textureMode=/;
  let patchCount = 0;

  for (const file of files) {
    const filePath = path.join(assetsDirectory, file);
    let body = await readFile(filePath, "utf8");
    if (sourceAerialGroup.test(body) && body.includes("PHX_KPHX_SourceAuthoredPhotoGround_Tiled")) {
      body = body.replace(sourceAerialGroup, (_statement, prefix, groupName) =>
        `${prefix}${groupName}.visible=!1,${groupName}.userData.textureMode=`);
      patchCount += 1;
    }
    await writeFile(filePath, body, "utf8");
  }

  if (patchCount !== 1) {
    throw new Error(`KPHX pre-server source-aerial isolation expected 1 patch, found ${patchCount}`);
  }
}

await applyKphxSourceAerialIsolationBeforeServer();

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