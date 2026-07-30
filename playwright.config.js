import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defineConfig } from "@playwright/test";

const externalBaseURL = process.env.PLAYWRIGHT_BASE_URL || "";
const requestedWebServerCommand = process.env.PLAYWRIGHT_WEB_SERVER_COMMAND || "npm run dev -- --port 4173";
const terminal4Preparation = "npm run prepare:terminal4-runtime";
const webServerCommand = requestedWebServerCommand.includes("prepare:terminal4-runtime")
  ? requestedWebServerCommand
  : `${terminal4Preparation} && ${requestedWebServerCommand}`;

async function applyKphxFlatConcreteIsolationBeforeServer() {
  const isKphxDiagnostic = process.argv.some((argument) => argument.includes("kphx-ground-runtime.spec.js"));
  if (!isKphxDiagnostic || externalBaseURL) return;

  const sourcePath = path.resolve("src/environment/authoredKphxGround.js");
  let source = await readFile(sourcePath, "utf8");
  const anchor = `      } else if (material.name === "concrete") {
        material.visible = true;
        material.color.setHex(0xffffff);
        material.transparent = false;
        material.opacity = 1;
        material.alphaTest = 0;
        material.depthWrite = true;
        material.map = textures.concrete.albedo;
        material.bumpMap = textures.concrete.bump;
        material.bumpScale = 0.028;
        material.roughness = 0.96;
        material.metalness = 0;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -0.25;
        material.polygonOffsetUnits = -0.5;
        material.userData.nearfieldBlendMode = "opaque-authored-pavement-over-aerial-background";
        node.renderOrder = Math.max(node.renderOrder || 0, 30);
        sourceDetailedSurfaceMaterialCount += 1;`;
  const replacement = `      } else if (material.name === "concrete") {
        material.visible = true;
        material.color.setHex(0x000000);
        material.transparent = false;
        material.opacity = 1;
        material.alphaTest = 0;
        material.depthWrite = true;
        material.map = null;
        material.bumpMap = null;
        material.bumpScale = 0;
        material.roughness = 1;
        material.metalness = 0;
        material.emissive?.setHex?.(0xb4b6b7);
        material.emissiveMap = null;
        material.emissiveIntensity = 1;
        material.toneMapped = false;
        material.polygonOffset = true;
        material.polygonOffsetFactor = -0.25;
        material.polygonOffsetUnits = -0.5;
        material.userData.nearfieldBlendMode = "opaque-authored-pavement-over-aerial-background";
        material.userData.diagnosticMaterialAuthority = "unlit-flat-concrete-before-vite";
        node.receiveShadow = false;
        node.renderOrder = Math.max(node.renderOrder || 0, 30);
        sourceDetailedSurfaceMaterialCount += 1;`;
  const occurrences = source.split(anchor).length - 1;
  if (occurrences !== 1) {
    throw new Error(`KPHX flat-concrete source isolation expected 1 anchor, found ${occurrences}`);
  }

  source = source.replace(anchor, replacement);
  await writeFile(sourcePath, source, "utf8");
}

await applyKphxFlatConcreteIsolationBeforeServer();

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
