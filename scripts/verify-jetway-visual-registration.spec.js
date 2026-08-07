import { test, expect } from "@playwright/test";
import fs from "node:fs";

const pageUrl = process.env.PAGE_URL || "http://127.0.0.1:4173/RampReady/";
const evidenceDirectory = "jetway-visual-evidence";
const progressPath = `${evidenceDirectory}/capture-progress.json`;

function checkpoint(stage, detail = {}) {
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(progressPath, `${JSON.stringify({ stage, capturedAtUtc: new Date().toISOString(), ...detail }, null, 2)}\n`);
}

async function captureCanvas(page, outputPath) {
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toBeVisible({ timeout: 10000 });
  const buffer = await canvas.screenshot({ path: outputPath, timeout: 15000, animations: "disabled" });
  expect(buffer.length).toBeGreaterThan(100000);
  return buffer.length;
}

async function selectInspectionPreset(page, preset) {
  const selector = page.locator('select[aria-label="Inspection location"]');
  await expect(selector).toBeVisible({ timeout: 10000 });
  await selector.selectOption(preset, { timeout: 10000 });
  await expect(selector).toHaveValue(preset, { timeout: 5000 });
  await page.waitForTimeout(500);
  const state = await page.locator("canvas.trainerCanvas").evaluate((element, expectedPreset) => ({
    ok: element.dataset.inspectionPreset === expectedPreset,
    expectedPreset,
    selected: element.dataset.inspectionPreset || null,
    routeAuthority: element.dataset.inspectionRouteAuthority || null,
    cameraAuthority: element.dataset.inspectionCameraAuthority || null,
  }), preset);
  if (!state.ok) throw new Error(`Inspection preset ${preset} did not propagate to the rendered canvas: ${JSON.stringify(state)}`);
  return state;
}

async function waitForTerminal4Readiness(page, consoleErrors, pageErrors, failedRequests) {
  const deadline = Date.now() + 90000;
  let lastRuntime = {};
  while (Date.now() < deadline) {
    lastRuntime = await page.locator("canvas.trainerCanvas").evaluate(element => ({ ...element.dataset }));
    if (
      lastRuntime.environmentSource === "authored-phx-terminal4-textured-source-jetways"
      && lastRuntime.groundSource === "authored-kphx-v181-source-textured-nearfield"
      && lastRuntime.photoGroundSource === "source-authored-phx-photo"
    ) return lastRuntime;

    const fatalConsole = consoleErrors.find(message => /Exact jetway readiness mismatch|Airport_Jetway\.glb fleet|A1 Rotunda|source[- ]locked|Static jetway|Terminal 4|KPHX|ReferenceError|TypeError|SyntaxError/i.test(message));
    const fatalPage = pageErrors.find(message => /jetway|A1|Terminal 4|KPHX|ReferenceError|TypeError|SyntaxError/i.test(message));
    if (fatalConsole || fatalPage) {
      const failure = { runtime: lastRuntime, fatalConsole: fatalConsole || null, fatalPage: fatalPage || null, consoleErrors, pageErrors, failedRequests };
      fs.writeFileSync(`${evidenceDirectory}/readiness-failure.json`, `${JSON.stringify(failure, null, 2)}\n`);
      throw new Error(`Terminal 4 readiness failed before visual capture: ${fatalConsole || fatalPage}`);
    }
    await page.waitForTimeout(200);
  }
  fs.writeFileSync(`${evidenceDirectory}/readiness-timeout.json`, `${JSON.stringify({ runtime: lastRuntime, consoleErrors, pageErrors, failedRequests }, null, 2)}\n`);
  throw new Error(`Terminal 4 readiness timed out. Last canvas dataset: ${JSON.stringify(lastRuntime)}`);
}

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
test.setTimeout(180000);

test("Terminal 4 exact jetways are visually registered to their source terminal positions", async ({ page }) => {
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("requestfailed", request => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`));

  checkpoint("open");
  const response = await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
  expect(response?.ok()).toBe(true);
  await page.getByRole("heading", { name: "Choose pushback equipment" }).waitFor({ state: "visible", timeout: 15000 });
  const lektro = page.getByRole("radio", { name: /Lektro 88/i });
  if (await lektro.getAttribute("aria-checked") !== "true") await lektro.click();
  const directInspection = page.getByRole("button", { name: "Drive tug / inspect airport" });
  await expect(directInspection).toBeEnabled({ timeout: 10000 });
  checkpoint("direct-inspection-launch");
  await directInspection.click({ timeout: 10000 });

  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toBeVisible({ timeout: 20000 });
  checkpoint("readiness");
  const readiness = await waitForTerminal4Readiness(page, consoleErrors, pageErrors, failedRequests);

  const inspectionSelector = page.locator('select[aria-label="Inspection location"]');
  await expect(inspectionSelector).toBeVisible({ timeout: 15000 });
  const returnToTraining = page.getByRole("button", { name: "Return to training" });
  await expect(returnToTraining).toBeVisible({ timeout: 15000 });
  checkpoint("inspection-active");

  const camera = page.getByLabel("Camera view");
  await expect(camera).toBeVisible({ timeout: 10000 });
  await camera.selectOption("chase", { timeout: 10000 });

  const captures = {};
  const presetSelection = {};
  for (const [preset, file] of [
    ["a1Connection", "a1-terminal-connection.png"],
    ["a14", "a-concourse-fleet.png"],
    ["b14", "b-concourse-fleet.png"],
    ["b15", "b15-terminal-jetways.png"],
  ]) {
    checkpoint(`preset-${preset}`);
    presetSelection[preset] = await selectInspectionPreset(page, preset);
    await page.waitForTimeout(900);
    checkpoint(`capture-${preset}`, { presetSelection: presetSelection[preset] });
    captures[file] = await captureCanvas(page, `${evidenceDirectory}/${file}`);
  }

  const runtime = await canvas.evaluate(element => ({ ...element.dataset }));
  const criticalErrors = consoleErrors.filter(message => /PHX|KPHX|Terminal 4|jetway|GLTFLoader|WebGL|ReferenceError|TypeError|SyntaxError/i.test(message));
  const criticalFailedRequests = failedRequests.filter(message => /airport-jetway|phx-terminal4|kphx-ground|kphx-photo|assets\/.*\.js/i.test(message));
  expect(criticalErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(criticalFailedRequests).toEqual([]);

  fs.writeFileSync(`${evidenceDirectory}/report.json`, `${JSON.stringify({
    capturedAtUtc: new Date().toISOString(), pageUrl, readiness, runtime, captures, presetSelection, consoleErrors, pageErrors, failedRequests,
  }, null, 2)}\n`);
  checkpoint("complete", { captures });
});
