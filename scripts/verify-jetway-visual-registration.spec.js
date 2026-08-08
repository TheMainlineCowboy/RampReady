import { test, expect } from "@playwright/test";
import fs from "node:fs";

const pageUrl = process.env.PAGE_URL || "http://127.0.0.1:4173/RampReady/";
const evidenceDirectory = "jetway-visual-evidence";
const progressPath = `${evidenceDirectory}/capture-progress.json`;
const views = Object.freeze([
  ["a1Connection", "a1-terminal-connection.png", "A1 terminal connection"],
  ["a14", "a-concourse-fleet.png", "A concourse midpoint"],
  ["b14", "b-concourse-fleet.png", "B concourse midpoint"],
  ["b15", "b15-terminal-jetways.png", "B15 ramp"],
]);
const CURRENT_SUBVIEW_AUTHORITY = "source-measured-a1-terminal-joint-camera-v3";
const LEGACY_SUBVIEW_AUTHORITY = "exact-a1-terminal-joint-and-bogie-contact-subviews-v2";
const A1_ENDPOINT_CAMERA_AUTHORITY = "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2";
const A1_ENDPOINT_CAMERA_LOCK_AUTHORITY = "exact-a1-evidence-camera-direct-lock-v1";
const A1_VISUAL_AUTHORITY = "same-day-a1-continuous-source-measured-solid-closed-grounded-v2";

function checkpoint(stage, detail = {}) {
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(progressPath, `${JSON.stringify({ stage, capturedAtUtc: new Date().toISOString(), ...detail }, null, 2)}\n`);
}

async function captureViewport(page, outputPath) {
  const session = await page.context().newCDPSession(page);
  try {
    const result = await session.send("Page.captureScreenshot", { format: "png", fromSurface: true, captureBeyondViewport: false });
    const png = Buffer.from(result.data, "base64");
    fs.writeFileSync(outputPath, png);
    expect(png.length).toBeGreaterThan(100000);
    return png.length;
  } finally {
    await session.detach();
  }
}

async function selectA1Subview(page, canvas, subview) {
  await page.evaluate(nextSubview => {
    const element = document.querySelector("canvas.trainerCanvas");
    if (!(element instanceof HTMLCanvasElement)) throw new Error("A1 evidence canvas is missing");
    element.dataset.a1EvidenceSubview = nextSubview;
  }, subview);
  await expect(canvas).toHaveAttribute("data-inspection-camera-endpoint-subview", subview, { timeout: 30000 });
  const authority = await canvas.getAttribute("data-inspection-camera-endpoint-subview-authority");
  expect([CURRENT_SUBVIEW_AUTHORITY, LEGACY_SUBVIEW_AUTHORITY]).toContain(authority);
  await expect(canvas).toHaveAttribute("data-inspection-camera-endpoint-authority", A1_ENDPOINT_CAMERA_AUTHORITY, { timeout: 30000 });
  await expect(canvas).toHaveAttribute("data-inspection-camera-endpoint-lock-authority", A1_ENDPOINT_CAMERA_LOCK_AUTHORITY, { timeout: 30000 });
  await expect.poll(async () => Number(await canvas.getAttribute("data-inspection-camera-endpoint-convergence-error-meters")), { timeout: 30000 }).toBeLessThanOrEqual(0.001);
}

async function selectCameraView(page, value) {
  await page.evaluate(nextValue => {
    const select = document.querySelector('select[aria-label="Camera view"]');
    if (!(select instanceof HTMLSelectElement)) throw new Error("Camera view control is missing");
    select.value = nextValue;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
  await page.waitForFunction(expected => document.querySelector('select[aria-label="Camera view"]')?.value === expected, value, { timeout: 10000, polling: 100 });
}

test.setTimeout(90000);

test("Terminal 4 exact jetways are visually registered to their source terminal positions", async ({ browser }) => {
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  const captures = {};
  const errors = {};

  for (const [preset, file, inspectionLabel] of views) {
    checkpoint(`launch-${preset}`);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("requestfailed", request => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`));

    const response = await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    expect(response?.ok()).toBe(true);
    const inspectionLaunch = page.getByRole("button", { name: "Drive tug / inspect airport" });
    await expect(inspectionLaunch).toBeVisible({ timeout: 30000 });
    await inspectionLaunch.click();
    const canvas = page.locator("canvas.trainerCanvas");
    await expect(canvas).toBeVisible({ timeout: 30000 });
    await expect(canvas).toHaveAttribute("data-inspection-mode", "active", { timeout: 30000 });
    await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-load-state", "ready", { timeout: 120000 });
    await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-count", "58", { timeout: 30000 });

    const inspectionLocation = page.getByRole("combobox", { name: "Inspection location" });
    await expect(inspectionLocation).toBeVisible({ timeout: 30000 });
    await inspectionLocation.selectOption({ label: inspectionLabel });
    await expect(canvas).toHaveAttribute("data-inspection-preset", preset, { timeout: 30000 });
    checkpoint(`preset-${preset}-verified`, { inspectionLabel, activePreset: await canvas.getAttribute("data-inspection-preset") });
    await page.waitForTimeout(2000);

    if (preset === "a1Connection") {
      await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-a1-visual-acceptance-authority", A1_VISUAL_AUTHORITY, { timeout: 30000 });
      await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-a1-assembly-continuity-authority", "exact-authored-five-part-chain-no-isolated-node-rotation-v2", { timeout: 30000 });
      await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-a1-assembly-part-count", "5", { timeout: 30000 });
      await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-a1-isolated-node-rotation-count", "0", { timeout: 30000 });
      await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-a1-apron-facing-rotunda-opening-closed", "true", { timeout: 30000 });
      await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-a1-no-generated-glass-corridor", "true", { timeout: 30000 });
      await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-bogie-ground-contact-authority", "exact-authored-a1-lowest-geometry-ramp-contact-v2", { timeout: 30000 });
      await expect.poll(async () => Math.abs(Number(await canvas.getAttribute("data-terminal4-uploaded-jetway-bogie-ground-clearance-meters"))), { timeout: 30000 }).toBeLessThanOrEqual(0.005);
      await expect.poll(async () => Math.abs(Number(await canvas.getAttribute("data-terminal4-uploaded-jetway-a1-visible-vestibule-length-meters")) - 2.4), { timeout: 30000 }).toBeLessThanOrEqual(0.05);

      await selectA1Subview(page, canvas, "terminal-joint");
      captures["a1-terminal-joint-close.png"] = await captureViewport(page, `${evidenceDirectory}/a1-terminal-joint-close.png`);
      await selectA1Subview(page, canvas, "bogie-contact");
      captures["a1-bogie-contact-close.png"] = await captureViewport(page, `${evidenceDirectory}/a1-bogie-contact-close.png`);
      await selectA1Subview(page, canvas, "full-assembly");
      await page.waitForTimeout(750);
    }

    captures[file] = await captureViewport(page, `${evidenceDirectory}/${file}`);
    if (preset === "a1Connection") {
      await selectCameraView(page, "overhead");
      await page.waitForTimeout(2000);
      captures["a1-terminal-overhead.png"] = await captureViewport(page, `${evidenceDirectory}/a1-terminal-overhead.png`);
    }

    errors[preset] = { consoleErrors, pageErrors, failedRequests };
    const criticalConsole = consoleErrors.filter(message => /Exact jetway readiness mismatch|Airport_Jetway\.glb fleet|A1 Rotunda|Static jetway|Terminal 4|KPHX|ReferenceError|TypeError|SyntaxError/i.test(message));
    const criticalFailedRequests = failedRequests.filter(message => /airport-jetway|phx-terminal4|kphx-ground|kphx-photo|assets\/.*\.js/i.test(message));
    expect(criticalConsole).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(criticalFailedRequests).toEqual([]);
    await context.close();
  }

  fs.writeFileSync(`${evidenceDirectory}/report.json`, `${JSON.stringify({ capturedAtUtc: new Date().toISOString(), pageUrl, captures, errors }, null, 2)}\n`);
  checkpoint("complete", { captures });
});
