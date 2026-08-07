import fs from "node:fs";
import { expect, test } from "@playwright/test";

const DIRECT_A1_TERMINAL_AUTHORITY = "nearest-structural-terminal-facade-photo-verified-v1";
const DIRECT_A1_CAMERA_AUTHORITY = "oblique-measured-final-cab-and-aircraft-a1-v9";
const AIRCRAFT_AUTHORITY = "source-a1-gate-stop-world-offset-persisted-no-cab-follow-v3";
const AIRCRAFT_MODE_POSE_AUTHORITY = "a1-single-aircraft-pose-training-and-free-drive-v1";
const CAB_CONTACT_AUTHORITY = "authored-rendered-forward-left-door-to-final-cab-v4";
const RENDERED_SCALE_AUTHORITY = "crj-authored-world-dimensions-preserved-v2";
const SOURCE_A1_NOSE_GEAR = Object.freeze({ x: 0, z: 6.2, yaw: 0.008570 });
const AUTHORED_FORWARD_LEFT_DOOR = Object.freeze({ x: -1.262, y: 3.0, z: 3.90 });

async function captureCanvas(page, path) {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Three.js canvas is missing");
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  const client = await page.context().newCDPSession(page);
  try {
    await client.send("Page.bringToFront");
    const { data } = await Promise.race([
      client.send("Page.captureScreenshot", {
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
      }),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("A1 compositor capture exceeded 75 seconds")),
        75_000,
      )),
    ]);
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync(path, Buffer.from(data, "base64"));
    expect(fs.statSync(path).size).toBeGreaterThan(30_000);
  } finally {
    await client.detach();
  }
}

async function numericCanvasAttribute(page, name) {
  return Number(await page.evaluate((attribute) => (
    document.querySelector("canvas.trainerCanvas")?.getAttribute(attribute) ?? "NaN"
  ), name));
}

async function chooseInspectionPreset(page, preset) {
  await page.evaluate((nextPreset) => {
    const select = document.querySelector('select[aria-label="Inspection location"]');
    if (!(select instanceof HTMLSelectElement)) throw new Error("Inspection location selector is missing");
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error("Native inspection selector setter is unavailable");
    setter.call(select, nextPreset);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, preset);
}

test("source-first A1 evidence proves the fixed gate aircraft, exact terminal-to-door chain and physical inspection mode", async ({ page }) => {
  test.setTimeout(780_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({
    terminalAuthority,
    aircraftAuthority,
    aircraftModePoseAuthority,
    cabContactAuthority,
    scaleAuthority,
  }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionMode === "active"
      && data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayCount === "58"
      && data?.terminal4UploadedJetwayConnectorCount === "58"
      && data?.terminal4UploadedJetwayVerifiedModelCount === "58"
      && data?.terminal4A1ConnectionAuthority === terminalAuthority
      && data?.inspectionAircraftPoseAuthority === aircraftAuthority
      && data?.aircraftModePoseAuthority === aircraftModePoseAuthority
      && data?.inspectionAircraftPoseStored === "true"
      && data?.inspectionAircraftPoseApplied === "true"
      && Number(data?.inspectionAircraftPoseErrorMeters) <= 0.01
      && data?.inspectionAircraftCabContactAuthority === cabContactAuthority
      && data?.inspectionAircraftRenderedScaleAuthority === scaleAuthority
      && Number.isFinite(Number(data?.inspectionAircraftCabContactX))
      && Number.isFinite(Number(data?.inspectionAircraftCabContactZ))
      && Number.isFinite(Number(data?.inspectionAircraftDoorTargetX))
      && Number.isFinite(Number(data?.inspectionAircraftDoorTargetZ))
      && Number(data?.inspectionAircraftCabContactErrorMeters) <= 0.01
      && Number.isFinite(Number(data?.inspectionAircraftDoorVerticalErrorMeters))
      && Number(data?.inspectionAircraftDoorVerticalErrorMeters) <= 6
      && Number.isFinite(Number(data?.inspectionAircraftDoorSignedVerticalGapMeters))
      && Number.isFinite(Number(data?.inspectionAircraftJetwayRequestedVerticalFitMeters))
      && Math.abs(Number(data?.inspectionAircraftJetwayVerticalFitMeters)) <= 0.001
      && data?.inspectionAircraftJetwayAuthoredBogieGroundPreserved === "true"
      && Math.abs(Number(data?.inspectionAircraftGroundClearanceMeters)) <= 0.01
      && data?.inspectionAircraftJetwayVerticalFitAuthority === "grounded-jetway-door-gap-reported-no-child-lift-v1"
      && Number(data?.inspectionAircraftRenderedLengthMeters) > 31
      && Number(data?.inspectionAircraftRenderedWingspanMeters) > 22.5
      && Number.isFinite(Number(data?.aircraftModePoseLiveX))
      && Number.isFinite(Number(data?.aircraftModePoseLiveZ))
      && Number.isFinite(Number(data?.aircraftModePoseLiveYaw))
      && data?.airportCollisionReady === "true";
  }, {
    terminalAuthority: DIRECT_A1_TERMINAL_AUTHORITY,
    aircraftAuthority: AIRCRAFT_AUTHORITY,
    aircraftModePoseAuthority: AIRCRAFT_MODE_POSE_AUTHORITY,
    cabContactAuthority: CAB_CONTACT_AUTHORITY,
    scaleAuthority: RENDERED_SCALE_AUTHORITY,
  }, { timeout: 180_000, polling: 250 });

  const runtime = await page.evaluate(() => ({
    ...document.querySelector("canvas.trainerCanvas").dataset,
  }));
  expect(runtime.terminal4UploadedJetwayReadyAuthority).toBe(
    "exact-uploaded-airport-jetway-complete-58-gates-v1",
  );
  expect(runtime.terminal4JetwaySourceGeometryMode).toBe(
    "exact-uploaded-airport-jetway-glb-562e3144-v1",
  );
  expect(runtime.terminal4A1ConnectionAuthority).toBe(DIRECT_A1_TERMINAL_AUTHORITY);
  expect(runtime.terminal4A1ConnectionAuthority).not.toMatch(/WALK/i);
  expect(Number(runtime.terminal4A1JetwayWallDistance)).toBeGreaterThan(2.9);
  expect(Number(runtime.terminal4A1JetwayWallDistance)).toBeLessThan(5.8);
  expect(Math.abs(Number(runtime.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters) - 2.4)).toBeLessThanOrEqual(0.05);
  expect(runtime.terminal4A1RetractionAuthority).toBe("aircraft-door-clearance-without-overtravel-v6");
  expect(runtime.terminal4A1RetractionClearanceMeters).toBe("2.38");

  const direction = runtime.terminal4A1ConnectionDirection.split(",").map(Number);
  expect(direction).toHaveLength(2);
  expect(Math.abs(Math.hypot(...direction) - 1)).toBeLessThanOrEqual(0.01);

  const noseGearX = Number(runtime.inspectionAircraftNoseGearX);
  const noseGearZ = Number(runtime.inspectionAircraftNoseGearZ);
  const liveX = Number(runtime.aircraftModePoseLiveX);
  const liveZ = Number(runtime.aircraftModePoseLiveZ);
  const liveYaw = Number(runtime.aircraftModePoseLiveYaw);
  expect(noseGearX).toBeCloseTo(SOURCE_A1_NOSE_GEAR.x, 5);
  expect(noseGearZ).toBeCloseTo(SOURCE_A1_NOSE_GEAR.z, 5);
  expect(liveX).toBeCloseTo(SOURCE_A1_NOSE_GEAR.x, 5);
  expect(liveZ).toBeCloseTo(SOURCE_A1_NOSE_GEAR.z, 5);
  expect(liveYaw).toBeCloseTo(SOURCE_A1_NOSE_GEAR.yaw, 5);
  expect(runtime.inspectionAircraftPoseAuthority).toBe(AIRCRAFT_AUTHORITY);
  expect(runtime.aircraftModePoseAuthority).toBe(AIRCRAFT_MODE_POSE_AUTHORITY);
  expect(runtime.inspectionAircraftCabContactAuthority).toBe(CAB_CONTACT_AUTHORITY);
  expect(runtime.inspectionAircraftRenderedScaleAuthority).toBe(RENDERED_SCALE_AUTHORITY);
  expect(runtime.inspectionAircraftPoseApplied).toBe("true");
  expect(Number(runtime.inspectionAircraftPoseErrorMeters)).toBeLessThanOrEqual(0.01);

  const cabContactX = Number(runtime.inspectionAircraftCabContactX);
  const cabContactZ = Number(runtime.inspectionAircraftCabContactZ);
  const cabDirectionX = Number(runtime.inspectionAircraftCabDirectionX);
  const cabDirectionZ = Number(runtime.inspectionAircraftCabDirectionZ);
  const renderedDoorX = Number(runtime.inspectionAircraftDoorTargetX);
  const renderedDoorZ = Number(runtime.inspectionAircraftDoorTargetZ);
  expect([
    cabContactX,
    cabContactZ,
    cabDirectionX,
    cabDirectionZ,
    renderedDoorX,
    renderedDoorZ,
  ].every(Number.isFinite)).toBe(true);
  expect(Math.abs(Math.hypot(cabDirectionX, cabDirectionZ) - 1)).toBeLessThanOrEqual(0.01);
  expect(Math.hypot(renderedDoorX - cabContactX, renderedDoorZ - cabContactZ)).toBeLessThanOrEqual(0.01);
  expect(Number(runtime.inspectionAircraftCabContactErrorMeters)).toBeLessThanOrEqual(0.01);

  const signedDoorVerticalGapMeters = Number(runtime.inspectionAircraftDoorSignedVerticalGapMeters);
  const requestedJetwayVerticalFitMeters = Number(runtime.inspectionAircraftJetwayRequestedVerticalFitMeters);
  expect(Number.isFinite(signedDoorVerticalGapMeters)).toBe(true);
  expect(Number.isFinite(requestedJetwayVerticalFitMeters)).toBe(true);
  expect(Number(runtime.inspectionAircraftDoorVerticalErrorMeters)).toBeCloseTo(
    Math.abs(signedDoorVerticalGapMeters),
    5,
  );
  expect(Number(runtime.inspectionAircraftDoorVerticalErrorMeters)).toBeLessThanOrEqual(6);
  expect(requestedJetwayVerticalFitMeters).toBeCloseTo(signedDoorVerticalGapMeters, 5);
  expect(Number(runtime.inspectionAircraftJetwayVerticalFitMeters)).toBeCloseTo(0, 5);
  expect(runtime.inspectionAircraftJetwayAuthoredBogieGroundPreserved).toBe("true");
  expect(Math.abs(Number(runtime.inspectionAircraftGroundClearanceMeters))).toBeLessThanOrEqual(0.01);
  expect(runtime.inspectionAircraftJetwayVerticalFitAuthority).toBe(
    "grounded-jetway-door-gap-reported-no-child-lift-v1",
  );
  expect(Number(runtime.inspectionAircraftDoorLocalX)).toBeCloseTo(AUTHORED_FORWARD_LEFT_DOOR.x, 3);
  expect(Number(runtime.inspectionAircraftDoorLocalY)).toBeCloseTo(AUTHORED_FORWARD_LEFT_DOOR.y, 3);
  expect(Number(runtime.inspectionAircraftDoorLocalZ)).toBeCloseTo(AUTHORED_FORWARD_LEFT_DOOR.z, 3);
  expect(Number(runtime.inspectionAircraftRenderedLengthMeters)).toBeGreaterThan(31);
  expect(Number(runtime.inspectionAircraftRenderedLengthMeters)).toBeLessThan(34);
  expect(Number(runtime.inspectionAircraftRenderedWingspanMeters)).toBeGreaterThan(22.5);
  expect(Number(runtime.inspectionAircraftRenderedWingspanMeters)).toBeLessThan(25);

  await chooseInspectionPreset(page, "a1Connection");
  await page.waitForFunction((authority) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionPreset === "a1Connection"
      && data?.inspectionCameraAuthority === authority
      && data?.a1JetwayDeployment === "1.000"
      && data?.a1JetwayState === "attached-to-aircraft-door"
      && Number.isFinite(Number(data?.inspectionAircraftDoorVerticalErrorMeters))
      && Number(data?.inspectionAircraftDoorVerticalErrorMeters) <= 6
      && Number.isFinite(Number(data?.inspectionAircraftDoorSignedVerticalGapMeters))
      && Number.isFinite(Number(data?.inspectionAircraftJetwayRequestedVerticalFitMeters))
      && Math.abs(Number(data?.inspectionAircraftJetwayVerticalFitMeters)) <= 0.001
      && data?.inspectionAircraftJetwayAuthoredBogieGroundPreserved === "true";
  }, DIRECT_A1_CAMERA_AUTHORITY, { timeout: 30_000, polling: 100 });
  await page.addStyleTag({
    content: ".rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}",
  });
  await page.waitForTimeout(1_000);
  await captureCanvas(page, "test-results/source-first-a1-terminal-connection.png");

  await page.evaluate(() => {
    const select = document.querySelector('select[aria-label="Camera view"]');
    if (!(select instanceof HTMLSelectElement)) throw new Error("Camera view selector is missing");
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error("Native camera selector setter is unavailable");
    setter.call(select, "overhead");
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(1_000);
  await captureCanvas(page, "test-results/source-first-a1-terminal-aircraft-overhead.png");

  fs.writeFileSync("test-results/source-first-a1-terminal-connection.json", `${JSON.stringify({
    terminalWallDistance: Number(runtime.terminal4A1JetwayWallDistance),
    terminalConnectionAuthority: runtime.terminal4A1ConnectionAuthority,
    terminalConnectionDirection: direction,
    inspectionCameraAuthority: DIRECT_A1_CAMERA_AUTHORITY,
    inspectionAircraftPoseAuthority: runtime.inspectionAircraftPoseAuthority,
    aircraftModePoseAuthority: runtime.aircraftModePoseAuthority,
    aircraftModePose: [liveX, Number(runtime.aircraftModePoseLiveY), liveZ, liveYaw],
    inspectionAircraftCabContactAuthority: runtime.inspectionAircraftCabContactAuthority,
    inspectionAircraftRenderedScaleAuthority: runtime.inspectionAircraftRenderedScaleAuthority,
    inspectionAircraftNoseGear: [noseGearX, noseGearZ],
    inspectionAircraftCabContact: [cabContactX, cabContactZ],
    inspectionAircraftRenderedDoor: [renderedDoorX, renderedDoorZ],
    inspectionAircraftDoorLocal: [
      Number(runtime.inspectionAircraftDoorLocalX),
      Number(runtime.inspectionAircraftDoorLocalY),
      Number(runtime.inspectionAircraftDoorLocalZ),
    ],
    inspectionAircraftRenderedDimensions: [
      Number(runtime.inspectionAircraftRenderedLengthMeters),
      Number(runtime.inspectionAircraftRenderedWingspanMeters),
    ],
    inspectionAircraftCabDirection: [cabDirectionX, cabDirectionZ],
    inspectionAircraftCabContactErrorMeters: Number(runtime.inspectionAircraftCabContactErrorMeters),
    legacyRelocationTelemetryOnly: [
      Number(runtime.inspectionAircraftExactParentRelocationX),
      Number(runtime.inspectionAircraftExactParentRelocationZ),
    ],
    evidenceAuthority: "user-overhead-and-same-day-a1-ramp-photos",
  }, null, 2)}\n`);

  await chooseInspectionPreset(page, "b15");
  await page.waitForFunction(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionPreset === "b15"
      && data?.inspectionTugX === "-18.500"
      && data?.inspectionTugZ === "539.200";
  }, null, { timeout: 30_000, polling: 100 });
  const startX = await numericCanvasAttribute(page, "data-inspection-tug-x");
  const startCount = await numericCanvasAttribute(page, "data-airport-collision-count");
  await page.keyboard.down("w");
  try {
    await page.waitForFunction((initialCount) => (
      Number(document.querySelector("canvas.trainerCanvas")?.dataset.airportCollisionCount ?? "0") > initialCount
    ), startCount, { timeout: 120_000, polling: 100 });
  } finally {
    await page.keyboard.up("w");
  }
  const stoppedX = await numericCanvasAttribute(page, "data-inspection-tug-x");
  expect(stoppedX).toBeLessThan(startX - 5);
  expect(stoppedX).toBeGreaterThan(-27.35);
});
