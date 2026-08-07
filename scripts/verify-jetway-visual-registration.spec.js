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
  const changed = await page.evaluate((expectedPreset) => {
    const element = document.querySelector('select[aria-label="Inspection location"]');
    if (!(element instanceof HTMLSelectElement)) return { ok: false, reason: "not-select" };
    const optionExists = [...element.options].some(option => option.value === expectedPreset);
    if (!optionExists) return { ok: false, reason: "missing-option", options: [...element.options].map(option => option.value) };
    element.value = expectedPreset;
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, value: element.value };
  }, preset);
  if (!changed.ok) throw new Error(`Inspection selector rejected ${preset}: ${JSON.stringify(changed)}`);

  let state = null;
  for (let attempt = 0; attempt < 80; attempt += 1) {
    state = await page.evaluate((expectedPreset) => {
      const select = document.querySelector('select[aria-label="Inspection location"]');
      const canvas = document.querySelector("canvas.trainerCanvas");
      return {
        ok: select?.value === expectedPreset && canvas?.dataset.inspectionPreset === expectedPreset,
        expectedPreset,
        selected: canvas?.dataset.inspectionPreset || null,
        selectValue: select?.value || null,
        routeAuthority: canvas?.dataset.inspectionRouteAuthority || null,
        cameraAuthority: canvas?.dataset.inspectionCameraAuthority || null,
        cameraYaw: canvas?.dataset.cameraYaw || null,
        cameraDistance: canvas?.dataset.cameraDistance || null,
      };
    }, preset);
    if (state.ok) return state;
    await page.waitForTimeout(100);
  }
  throw new Error(`Inspection preset ${preset} did not propagate to the rendered canvas: ${JSON.stringify(state)}`);
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
test.setTimeout(90000);

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

  const inspectionControls = await page.evaluate(() => ({
    location: document.querySelector('select[aria-label="Inspection location"]') instanceof HTMLSelectElement,
    camera: document.querySelector('select[aria-label="Camera view"]') instanceof HTMLSelectElement,
    returnButton: [...document.querySelectorAll("button")].some(button => button.textContent?.trim() === "Return to training"),
  }));
  if (!inspectionControls.location || !inspectionControls.camera || !inspectionControls.returnButton) {
    throw new Error(`Visible inspection controls are incomplete: ${JSON.stringify(inspectionControls)}`);
  }
  checkpoint("inspection-active");

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
    await page.waitForTimeout(700);
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
