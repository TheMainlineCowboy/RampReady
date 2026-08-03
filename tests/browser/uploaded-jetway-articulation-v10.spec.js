import fs from "node:fs";
import { expect, test } from "@playwright/test";

const FULL_3D_AUTHORITY = "user-supplied-airport-jetway-full-3d-door-plane-v11";
const CAB_CONTACT_AUTHORITY = "supplied-cab-aircraft-side-opening-threshold-v12";

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

function number(runtime, key) {
  const value = Number(runtime[key]);
  expect(Number.isFinite(value), `${key} must be finite, received ${runtime[key]}`).toBe(true);
  return value;
}

test("the exact supplied A1 jetway aligns its real Cab threshold without crossing the CRJ door plane", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  page.on("console", (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => console.log(`[browser:pageerror] ${error.message}`));
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({ articulation, contact }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return (
      data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayArticulationAuthority === articulation
      && data?.terminal4UploadedJetwayCabContactAuthority === contact
      && data?.terminal4UploadedJetwayA1PartOrderValid === "true"
      && data?.terminal4UploadedJetwayStaticPartOrderValid === "true"
    ) || data?.environmentSource === "load-error"
      || data?.terminal4UploadedJetwayLoadState === "load-error";
  }, { articulation: FULL_3D_AUTHORITY, contact: CAB_CONTACT_AUTHORITY }, { timeout: 120_000, polling: 100 });

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
  expect(runtime.terminal4UploadedJetwayArticulationAuthority).toBe(FULL_3D_AUTHORITY);
  expect(runtime.terminal4UploadedJetwayCabContactAuthority).toBe(CAB_CONTACT_AUTHORITY);
  expect(runtime.terminal4UploadedJetwayA1PartOrderValid).toBe("true");
  expect(runtime.terminal4UploadedJetwayStaticPartOrderValid).toBe("true");

  const sourceReach = number(runtime, "terminal4UploadedJetwaySourceContactDistanceMeters");
  const target = number(runtime, "terminal4UploadedJetwayA1TargetDoorDistanceMeters");
  const extension = number(runtime, "terminal4UploadedJetwayA1AttachedExtensionMeters");
  const predictedGap = number(runtime, "terminal4UploadedJetwayA1PredictedDoorGapMeters");
  const actualGap = number(runtime, "terminal4UploadedJetwayA1ActualDoorGapMeters");
  const staticMaximumError = number(runtime, "terminal4UploadedJetwayStaticMaximumContactErrorMeters");
  const staticMaximumNormalError = number(runtime, "terminal4UploadedJetwayStaticMaximumCabNormalErrorDegrees");
  const staticMaximumHeightError = number(runtime, "terminal4UploadedJetwayStaticMaximumCabHeightErrorMeters");
  const staticMaximumPlaneIntrusion = number(runtime, "terminal4UploadedJetwayStaticMaximumAircraftPlaneIntrusionMeters");
  const staticMinimumCabRampClearance = number(runtime, "terminal4UploadedJetwayStaticMinimumCabRampClearanceMeters");
  const staticMinimumStairGround = number(runtime, "terminal4UploadedJetwayStaticMinimumStairGroundClearanceMeters");
  const staticMaximumStairGround = number(runtime, "terminal4UploadedJetwayStaticMaximumStairGroundClearanceMeters");
  const staticMinimumBogieGround = number(runtime, "terminal4UploadedJetwayStaticMinimumBogieGroundClearanceMeters");
  const staticMaximumBogieGround = number(runtime, "terminal4UploadedJetwayStaticMaximumBogieGroundClearanceMeters");
  const a1CabNormalError = number(runtime, "terminal4UploadedJetwayA1CabNormalErrorDegrees");
  const a1CabHeightError = number(runtime, "terminal4UploadedJetwayA1CabHeightErrorMeters");
  const a1CabAircraftPlaneIntrusion = number(runtime, "terminal4UploadedJetwayA1CabAircraftPlaneIntrusionMeters");
  const a1CabRampClearance = number(runtime, "terminal4UploadedJetwayA1CabRampClearanceMeters");
  const a1CabVerticalOffset = number(runtime, "terminal4UploadedJetwayA1CabVerticalOffsetMeters");
  const a1StairGround = number(runtime, "terminal4UploadedJetwayA1StairGroundClearanceMeters");
  const a1BogieGround = number(runtime, "terminal4UploadedJetwayA1BogieGroundClearanceMeters");
  const a1AnchorYaw = number(runtime, "terminal4UploadedJetwayA1AnchorYawDegrees");
  const a1CabYawOffset = number(runtime, "terminal4UploadedJetwayA1CabYawOffsetDegrees");

  expect(sourceReach).toBeGreaterThan(25.5);
  expect(sourceReach).toBeLessThan(26.5);
  expect(target).toBeGreaterThan(29);
  expect(target).toBeLessThan(31);
  expect(extension).toBeGreaterThan(5);
  expect(extension).toBeLessThan(6);
  expect(predictedGap).toBeLessThanOrEqual(0.05);
  expect(actualGap).toBeLessThanOrEqual(0.05);
  expect(staticMaximumError).toBeLessThanOrEqual(0.05);
  expect(staticMaximumNormalError).toBeLessThanOrEqual(2);
  expect(staticMaximumHeightError).toBeLessThanOrEqual(0.05);
  expect(staticMaximumPlaneIntrusion).toBeLessThanOrEqual(0.05);
  expect(staticMinimumCabRampClearance).toBeGreaterThanOrEqual(1.5);
  expect(staticMinimumStairGround).toBeGreaterThanOrEqual(-0.05);
  expect(staticMaximumStairGround).toBeLessThanOrEqual(0.65);
  expect(staticMinimumBogieGround).toBeGreaterThanOrEqual(-0.05);
  expect(staticMaximumBogieGround).toBeLessThanOrEqual(0.65);
  expect(a1CabNormalError).toBeLessThanOrEqual(2);
  expect(a1CabHeightError).toBeLessThanOrEqual(0.05);
  expect(a1CabAircraftPlaneIntrusion).toBeLessThanOrEqual(0.05);
  expect(a1CabRampClearance).toBeGreaterThanOrEqual(1.5);
  expect(a1CabVerticalOffset).toBeGreaterThan(-1.36);
  expect(a1CabVerticalOffset).toBeLessThan(-1.33);
  expect(a1StairGround).toBeGreaterThanOrEqual(-0.05);
  expect(a1StairGround).toBeLessThanOrEqual(0.65);
  expect(a1BogieGround).toBeGreaterThanOrEqual(-0.05);
  expect(a1BogieGround).toBeLessThanOrEqual(0.65);
  expect(a1AnchorYaw).toBeGreaterThan(33);
  expect(a1AnchorYaw).toBeLessThan(35);
  expect(a1CabYawOffset).toBeGreaterThan(54);
  expect(a1CabYawOffset).toBeLessThan(57);

  const actualContact = JSON.parse(runtime.terminal4UploadedJetwayA1ActualContactPoint);
  for (const axis of ["x", "y", "z"]) {
    expect(Number.isFinite(Number(actualContact[axis])), `A1 contact ${axis} must be finite`).toBe(true);
  }

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
  await captureCanvas(page, "test-results/uploaded-jetway-a1-threshold-v12.png");

  fs.writeFileSync("test-results/uploaded-jetway-a1-threshold-v12.json", `${JSON.stringify({
    authority: runtime.terminal4UploadedJetwayArticulationAuthority,
    cabContactAuthority: runtime.terminal4UploadedJetwayCabContactAuthority,
    sourceReach,
    target,
    extension,
    predictedGap,
    actualGap,
    staticMaximumError,
    staticMaximumNormalError,
    staticMaximumHeightError,
    staticMaximumPlaneIntrusion,
    staticMinimumCabRampClearance,
    staticMinimumStairGround,
    staticMaximumStairGround,
    staticMinimumBogieGround,
    staticMaximumBogieGround,
    a1CabNormalError,
    a1CabHeightError,
    a1CabAircraftPlaneIntrusion,
    a1CabRampClearance,
    a1CabVerticalOffset,
    a1StairGround,
    a1BogieGround,
    a1AnchorYaw,
    a1CabYawOffset,
    actualContact,
    centers,
  }, null, 2)}\n`);
});
