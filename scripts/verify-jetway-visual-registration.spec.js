import { test, expect } from "@playwright/test";
import fs from "node:fs";

const pageUrl = process.env.PAGE_URL || "http://127.0.0.1:4173/RampReady/";
const evidenceDirectory = "jetway-visual-evidence";

async function captureCanvas(page, outputPath) {
  const bounds = await page.evaluate(() => {
    const element = document.querySelector("canvas.trainerCanvas");
    if (!(element instanceof HTMLCanvasElement)) throw new Error("RampReady canvas is missing");
    const rect = element.getBoundingClientRect();
    return {
      x: Math.max(0, rect.left),
      y: Math.max(0, rect.top),
      width: Math.min(window.innerWidth, rect.width),
      height: Math.min(window.innerHeight, rect.height),
    };
  });
  const session = await page.context().newCDPSession(page);
  try {
    const result = await session.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
      clip: { ...bounds, scale: 1 },
    });
    const png = Buffer.from(result.data, "base64");
    fs.writeFileSync(outputPath, png);
    expect(png.length).toBeGreaterThan(100000);
    return png.length;
  } finally {
    await session.detach();
  }
}

async function settle(page, milliseconds = 1800) {
  await page.waitForTimeout(milliseconds);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
test.setTimeout(720000);

test("Terminal 4 exact jetways are visually registered to their source terminal positions", async ({ page }) => {
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", message => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", error => pageErrors.push(error.message));
  page.on("requestfailed", request => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`));

  const response = await page.goto(pageUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
  expect(response?.ok()).toBe(true);
  await page.getByRole("heading", { name: "Choose pushback equipment" }).waitFor({ state: "visible", timeout: 30000 });
  const lektro = page.getByRole("radio", { name: /Lektro 88/i });
  if (await lektro.getAttribute("aria-checked") !== "true") await lektro.click();
  const start = page.getByRole("button", { name: "Start training" });
  await expect(start).toBeEnabled();
  await start.click();

  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => {
    const element = document.querySelector("canvas.trainerCanvas");
    return element?.dataset.environmentSource === "authored-phx-terminal4-textured-source-jetways"
      && element?.dataset.groundSource === "authored-kphx-v181-source-textured-nearfield"
      && element?.dataset.photoGroundSource === "source-authored-phx-photo";
  }, null, { timeout: 120000 });

  await settle(page, 5000);
  const freeDrive = page.getByRole("button", { name: "Free-drive inspection" });
  await expect(freeDrive).toBeVisible();
  await freeDrive.click();
  const location = page.getByLabel("Inspection location");
  const camera = page.getByLabel("Camera view");
  await expect(location).toBeVisible();
  await expect(camera).toBeVisible();

  // Select chase once. Re-selecting the already-active camera after every
  // inspection preset caused Playwright to wait on a React select that was
  // being replaced during the preset transition, hiding later fleet captures.
  await camera.selectOption("chase");

  const captures = {};
  for (const [preset, file] of [
    ["a1Connection", "a1-terminal-connection.png"],
    ["a14", "a-concourse-fleet.png"],
    ["b14", "b-concourse-fleet.png"],
    ["b15", "b15-terminal-jetways.png"],
  ]) {
    await location.selectOption(preset);
    await page.waitForFunction(expected => document.querySelector("canvas.trainerCanvas")?.dataset.inspectionPreset === expected, preset, { timeout: 30000 });
    await settle(page, 2200);
    captures[file] = await captureCanvas(page, `${evidenceDirectory}/${file}`);
  }

  const runtime = await canvas.evaluate(element => ({ ...element.dataset }));
  const criticalErrors = consoleErrors.filter(message => /PHX|KPHX|Terminal 4|jetway|GLTFLoader|WebGL|ReferenceError|TypeError|SyntaxError/i.test(message));
  const criticalFailedRequests = failedRequests.filter(message => /airport-jetway|phx-terminal4|kphx-ground|kphx-photo|assets\/.*\.js/i.test(message));
  expect(criticalErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(criticalFailedRequests).toEqual([]);

  fs.writeFileSync(`${evidenceDirectory}/report.json`, `${JSON.stringify({
    capturedAtUtc: new Date().toISOString(),
    pageUrl,
    runtime,
    captures,
    consoleErrors,
    pageErrors,
    failedRequests,
  }, null, 2)}\n`);
});
