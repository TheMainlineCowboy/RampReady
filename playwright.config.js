import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL || "";
const requestedWebServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || "npm run dev -- --port 4173";
const terminal4Preparation = "npm run prepare:terminal4-runtime";
const webServerCommand = requestedWebServerCommand.includes("prepare:terminal4-runtime")
  ? requestedWebServerCommand
  : `${terminal4Preparation} && ${requestedWebServerCommand}`;

async function applyKphxAerialIsolationBeforeServer() {
  const isKphxDiagnostic = process.argv.some((argument) => argument.includes("kphx-ground-runtime.spec.js"));
  if (!isKphxDiagnostic || externalBaseURL) return;

  const assetsDirectory = path.resolve("dist/assets");
  const files = (await readdir(assetsDirectory)).filter((file) => file.endsWith(".js"));
  const tileAssignment = /(\.name=`PHX_KPHX_SourceAerialTile_\$\{[^`]+\}`,)([A-Za-z_$][\w$]*)\.receiveShadow=!1,\2\.castShadow=!1/;
  let patchCount = 0;

  for (const file of files) {
    const filePath = path.join(assetsDirectory, file);
    let body = await readFile(filePath, "utf8");
    if (!tileAssignment.test(body)) continue;
    body = body.replace(tileAssignment, "$1$2.visible=!1,$2.receiveShadow=!1,$2.castShadow=!1");
    await writeFile(filePath, body, "utf8");
    patchCount += 1;
  }

  if (patchCount !== 1) {
    throw new Error(`KPHX pre-server aerial isolation expected one production bundle patch, found ${patchCount}`);
  }
}

await applyKphxAerialIsolationBeforeServer();

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
