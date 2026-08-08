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
const A1_ENDPOINT_CAMERA_AUTHORITY = "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2";
const A1_ENDPOINT_CAMERA_LOCK_AUTHORITY = "exact-a1-evidence-camera-direct-lock-v1";

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

    // The production app does not reliably consume inspectionPreset from the
    // URL. Drive the actual inspection-location control and fail closed unless
    // the canvas proves that the requested scene is active before capture.
    await page.waitForTimeout(15000);
    const inspectionLocation = page.getByRole("combobox", { name: "Inspection location" });
    await expect(inspectionLocation).toBeVisible({ timeout: 30000 });
    await inspectionLocation.selectOption({ label: inspectionLabel });
    const canvas = page.locator("canvas").first();
    await expect(canvas).toHaveAttribute("data-inspection-preset", preset, { timeout: 30000 });
    checkpoint(`preset-${preset}-verified`, {
      inspectionLabel,
      activePreset: await canvas.getAttribute("data-inspection-preset"),
    });
    await page.waitForTimeout(2500);

    // For A1, fail closed unless the runtime has switched from the stale
    // fixed-coordinate fallback to the final wall/Rotunda/Cab-derived camera.
    if (preset === "a1Connection") {
      await expect(canvas).toHaveAttribute(
        "data-inspection-camera-endpoint-authority",
        A1_ENDPOINT_CAMERA_AUTHORITY,
        { timeout: 30000 },
      );
      await expect(canvas).toHaveAttribute(
        "data-inspection-camera-endpoint-lock-authority",
        A1_ENDPOINT_CAMERA_LOCK_AUTHORITY,
        { timeout: 5000 },
      );
      await expect(canvas).toHaveAttribute(
        "data-inspection-camera-endpoint-subview",
        "terminal-joint",
        { timeout: 5000 },
      );
      const endpointPosition = await canvas.getAttribute("data-inspection-camera-endpoint-position");
      const endpointTarget = await canvas.getAttribute("data-inspection-camera-endpoint-target");
      const endpointWall = await canvas.getAttribute("data-inspection-camera-endpoint-wall");
      const endpointRotunda = await canvas.getAttribute("data-inspection-camera-endpoint-rotunda");
      expect(endpointPosition).toBeTruthy();
      expect(endpointTarget).toBeTruthy();
      expect(endpointWall).toBeTruthy();
      expect(endpointRotunda).toBeTruthy();
      checkpoint("a1-endpoint-camera-verified", {
        endpointPosition,
        endpointTarget,
        endpointWall,
        endpointRotunda,
      });
      await page.waitForTimeout(750);
    }

    checkpoint(`capture-${preset}`, { inspectionLabel });
    captures[file] = await captureViewport(page, `${evidenceDirectory}/${file}`);

    // The user's overhead inspection exposed a see-through Rotunda/Tunnel-A
    // cavity that the side-on terminal-joint camera could hide. Preserve that
    // exact failure mode as mandatory evidence.
    if (preset === "a1Connection") {
      const cameraView = page.getByRole("combobox", { name: "Camera view" });
      await cameraView.selectOption({ label: "Overhead view" });
      await page.waitForTimeout(2500);
      checkpoint("capture-a1-overhead", { inspectionLabel });
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

  fs.writeFileSync(`${evidenceDirectory}/report.json`, `${JSON.stringify({
    capturedAtUtc: new Date().toISOString(), pageUrl, captures, errors,
  }, null, 2)}\n`);
  checkpoint("complete", { captures });
});
