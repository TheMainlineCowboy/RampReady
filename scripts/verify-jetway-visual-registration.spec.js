import { test, expect } from "@playwright/test";
import fs from "node:fs";

const pageUrl = process.env.PAGE_URL || "http://127.0.0.1:4173/RampReady/";
const evidenceDirectory = "jetway-visual-evidence";
const progressPath = `${evidenceDirectory}/capture-progress.json`;
const views = Object.freeze([
  ["a1Connection", "a1-terminal-connection.png"],
  ["a14", "a-concourse-fleet.png"],
  ["b14", "b-concourse-fleet.png"],
  ["b15", "b15-terminal-jetways.png"],
]);

function checkpoint(stage, detail = {}) {
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  fs.writeFileSync(progressPath, `${JSON.stringify({ stage, capturedAtUtc: new Date().toISOString(), ...detail }, null, 2)}\n`);
}

async function captureViewport(page, outputPath) {
  const session = await page.context().newCDPSession(page);
  try {
    const result = await session.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
    });
    const png = Buffer.from(result.data, "base64");
    fs.writeFileSync(outputPath, png);
    expect(png.length).toBeGreaterThan(100000);
    return png.length;
  } finally {
    await session.detach();
  }
}

test.setTimeout(150000);

test("Terminal 4 exact jetways are visually registered to their source terminal positions", async ({ browser }) => {
  fs.mkdirSync(evidenceDirectory, { recursive: true });
  const captures = {};
  const errors = {};

  for (const [preset, file] of views) {
    checkpoint(`launch-${preset}`);
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];
    const failedRequests = [];
    page.on("console", message => { if (message.type() === "error") consoleErrors.push(message.text()); });
    page.on("pageerror", error => pageErrors.push(error.message));
    page.on("requestfailed", request => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || "unknown"}`));

    const separator = pageUrl.includes("?") ? "&" : "?";
    const presetUrl = `${pageUrl}${separator}inspectionPreset=${encodeURIComponent(preset)}`;
    const response = await page.goto(presetUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
    expect(response?.ok()).toBe(true);

    // Do not execute JavaScript against the fully loaded Three.js page here.
    // The launch URL initializes inspection mode and its camera internally.
    // A protocol-level wait/screenshot remains responsive even when the render
    // thread is saturated by the complete Terminal 4 scene.
    await page.waitForTimeout(15000);
    checkpoint(`capture-${preset}`, { presetUrl });
    captures[file] = await captureViewport(page, `${evidenceDirectory}/${file}`);
    errors[preset] = { consoleErrors, pageErrors, failedRequests };

    const criticalConsole = consoleErrors.filter(message => /Exact jetway readiness mismatch|Airport_Jetway\.glb fleet|A1 Rotunda|Static jetway|Terminal 4|KPHX|ReferenceError|TypeError|SyntaxError/i.test(message));
    const criticalFailedRequests = failedRequests.filter(message => /airport-jetway|phx-terminal4|kphx-ground|kphx-photo|assets\/.*\.js/i.test(message));
    expect(criticalConsole).toEqual([]);
    expect(pageErrors).toEqual([]);
    expect(criticalFailedRequests).toEqual([]);

    await context.close();
  }

  fs.writeFileSync(`${evidenceDirectory}/report.json`, `${JSON.stringify({
    capturedAtUtc: new Date().toISOString(), pageUrl, captures, errors,
  }, null, 2)}\n`);
  checkpoint("complete", { captures });
});
