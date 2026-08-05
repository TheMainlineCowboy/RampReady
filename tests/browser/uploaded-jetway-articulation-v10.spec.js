import fs from "node:fs";
import { expect, test } from "@playwright/test";

async function captureCanvas(page, path) {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!canvas) throw new Error("Three.js canvas is missing");
    const bounds = canvas.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  });
  const client = await page.context().newCDPSession(page);
  try {
    const capture = client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: Math.max(1, Math.min(box.width, 1440 - Math.max(0, box.x))),
        height: Math.max(1, Math.min(box.height, 900 - Math.max(0, box.y))),
        scale: 1,
      },
    });
    const timeout = new Promise((_, reject) => setTimeout(
      () => reject(new Error("Jetway evidence capture exceeded 30 seconds")),
      30_000,
    ));
    const { data } = await Promise.race([capture, timeout]);
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync(path, Buffer.from(data, "base64"));
    expect(fs.statSync(path).size).toBeGreaterThan(50_000);
  } finally {
    await client.detach();
  }
}

async function captureInspectionPreset(page, inspectionLocation, presetId, outputPath) {
  await inspectionLocation.selectOption(presetId);
  await page.waitForFunction((expectedPreset) => (
    document.querySelector("canvas.trainerCanvas")?.dataset?.inspectionPreset === expectedPreset
  ), presetId, { timeout: 30_000, polling: 100 });
  await page.waitForTimeout(2_000);
  await captureCanvas(page, outputPath);
}

test("the exact supplied A1 jetway telescopes to the aircraft door in authored part order", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  page.on("console", (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => console.log(`[browser:pageerror] ${error.message}`));
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return (
      data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayArticulationAuthority === "user-supplied-airport-jetway-per-gate-telescoping-v10"
      && data?.terminal4UploadedJetwayA1PartOrderValid === "true"
    ) || data?.environmentSource === "load-error"
      || data?.terminal4UploadedJetwayLoadState === "load-error";
  }, null, { timeout: 90_000, polling: 100 });

  const readiness = await page.evaluate(() => ({
    runtime: { ...document.querySelector("canvas.trainerCanvas").dataset },
    hud: document.querySelector(".rr-hud p")?.textContent || "",
  }));
  if (readiness.runtime.environmentSource === "load-error"
    || readiness.runtime.terminal4UploadedJetwayLoadState === "load-error") {
    throw new Error(`Terminal 4 rejected the supplied jetway runtime: ${readiness.hud}`);
  }
  const runtime = readiness.runtime;
  expect(runtime.terminal4UploadedJetwayCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayVerifiedModelCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayStaticArticulatedGateCount).toBe("57");
  expect(runtime.terminal4UploadedJetwayArticulationAuthority).toBe(
    "user-supplied-airport-jetway-per-gate-telescoping-v10",
  );

  const sourceReach = Number(runtime.terminal4UploadedJetwaySourceContactDistanceMeters);
  const target = Number(runtime.terminal4UploadedJetwayA1TargetDoorDistanceMeters);
  const extension = Number(runtime.terminal4UploadedJetwayA1AttachedExtensionMeters);
  const predictedGap = Number(runtime.terminal4UploadedJetwayA1PredictedDoorGapMeters);
  const predictedContact = Number(runtime.terminal4UploadedJetwayA1PredictedContactDistanceMeters);
  const actualContact = Number(runtime.terminal4UploadedJetwayA1ActualContactDistanceMeters);
  const actualGap = Number(runtime.terminal4UploadedJetwayA1ActualDoorGapMeters);
  const staticMaximumError = Number(runtime.terminal4UploadedJetwayStaticMaximumContactErrorMeters);
  expect(sourceReach).toBeGreaterThan(25.5);
  expect(sourceReach).toBeLessThan(26.5);
  expect(target).toBeGreaterThan(30.3);
  expect(target).toBeLessThan(30.8);
  expect(extension).toBeGreaterThan(4.2);
  expect(extension).toBeLessThan(4.8);
  expect(predictedGap).toBeLessThanOrEqual(0.05);
  expect(actualGap).toBeLessThanOrEqual(0.05);
  expect(Math.abs(predictedContact - target)).toBeLessThanOrEqual(0.05);
  expect(Math.abs(actualContact - target)).toBeLessThanOrEqual(0.05);
  expect(staticMaximumError).toBeLessThanOrEqual(0.05);
  expect(runtime.terminal4UploadedJetwayA1PartOrderValid).toBe("true");

  const centers = JSON.parse(runtime.terminal4UploadedJetwayA1PartCentersMeters);
  expect(centers.Rotunda).toBeLessThan(centers.Tunnel_A);
  expect(centers.Tunnel_A).toBeLessThan(centers.Tunnel_B);
  expect(centers.Tunnel_B).toBeLessThan(centers.Tunnel_C);
  expect(centers.Tunnel_C).toBeLessThan(centers.Cab);

  const inspectionLocation = page.getByLabel("Inspection location");
  await inspectionLocation.selectOption("a1Connection");
  await page.waitForFunction(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionPreset === "a1Connection"
      && data?.inspectionCameraAuthority === "wide-diagonal-a1-terminal-joint-v6-clear-tug";
  }, null, { timeout: 30_000, polling: 100 });
  await page.waitForTimeout(2_000);
  await page.addStyleTag({ content: ".rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}" });
  await captureCanvas(page, "test-results/uploaded-jetway-a1-articulated-v10.png");
  await captureInspectionPreset(
    page,
    inspectionLocation,
    "a14",
    "test-results/uploaded-jetway-a-concourse-static-fleet-v10.png",
  );
  await captureInspectionPreset(
    page,
    inspectionLocation,
    "b14",
    "test-results/uploaded-jetway-b-concourse-static-fleet-v10.png",
  );
  await captureInspectionPreset(
    page,
    inspectionLocation,
    "b15",
    "test-results/uploaded-jetway-b15-static-fleet-v10.png",
  );

  fs.writeFileSync("test-results/uploaded-jetway-a1-articulated-v10.json", `${JSON.stringify({
    authority: runtime.terminal4UploadedJetwayArticulationAuthority,
    sourceReach,
    target,
    extension,
    predictedGap,
    actualGap,
    predictedContact,
    actualContact,
    staticMaximumError,
    verifiedModelCount: Number(runtime.terminal4UploadedJetwayVerifiedModelCount),
    staticArticulatedGateCount: Number(runtime.terminal4UploadedJetwayStaticArticulatedGateCount),
    centers,
    evidenceViews: ["a1Connection", "a14", "b14", "b15"],
  }, null, 2)}\n`);
});
