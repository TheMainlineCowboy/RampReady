import fs from "node:fs";
import { expect, test } from "@playwright/test";

const JETWAY_GROUND_AUTHORITY = "exact-authored-a1-lowest-geometry-ramp-contact-v1";
const AIRCRAFT_GROUND_AUTHORITY = "authored-crj-lowest-geometry-contact-clusters-v2";
const VERTICAL_FIT_AUTHORITY = "grounded-aircraft-door-progressive-tunnel-slope-v1";
const CAMERA_ENDPOINT_AUTHORITY = "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2";
const CAMERA_LOCK_AUTHORITY = "exact-a1-evidence-camera-direct-lock-v1";

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
        () => reject(new Error("A1 ground-contact evidence capture exceeded 75 seconds")),
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

function parseTriplet(value, label) {
  const values = String(value || "").split(",").map(Number);
  expect(values, `${label} must contain three coordinates`).toHaveLength(3);
  expect(values.every(Number.isFinite), `${label} must be finite`).toBe(true);
  return values;
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

test("A1 evidence proves the supplied jetway and authored CRJ contact the ramp", async ({ page }) => {
  test.setTimeout(780_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({ jetwayAuthority, aircraftAuthority, verticalAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionMode === "active"
      && data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayBogieGroundContactAuthority === jetwayAuthority
      && Math.abs(Number(data?.terminal4UploadedJetwayBogieGroundClearanceMeters)) <= 0.005
      && data?.inspectionAircraftGroundingAuthority === aircraftAuthority
      && Number(data?.inspectionAircraftLandingGearContactPointCount) >= 6
      && Number(data?.inspectionAircraftLandingGearContactClusterCount) >= 3
      && Number(data?.inspectionAircraftLandingGearContactSpanX) >= 1
      && Number(data?.inspectionAircraftLandingGearContactSpanZ) >= 4
      && Math.abs(Number(data?.inspectionAircraftGroundClearanceMeters)) <= 0.01
      && Number(data?.inspectionAircraftDoorVerticalErrorMeters) <= 0.01
      && data?.inspectionAircraftJetwayVerticalFitAuthority === verticalAuthority;
  }, {
    jetwayAuthority: JETWAY_GROUND_AUTHORITY,
    aircraftAuthority: AIRCRAFT_GROUND_AUTHORITY,
    verticalAuthority: VERTICAL_FIT_AUTHORITY,
  }, { timeout: 300_000, polling: 100 });

  await page.getByLabel("Inspection location").selectOption("a1Connection");
  await page.waitForFunction(({ cameraAuthority, lockAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionPreset === "a1Connection"
      && data?.a1JetwayDeployment === "1.000"
      && data?.a1JetwayState === "attached-to-aircraft-door"
      && data?.inspectionCameraEndpointAuthority === cameraAuthority
      && data?.inspectionCameraEndpointLockAuthority === lockAuthority
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001
      && String(data?.inspectionCameraEndpointPosition || "").split(",").length === 3
      && String(data?.inspectionCameraEndpointTarget || "").split(",").length === 3
      && String(data?.inspectionCameraEndpointWall || "").split(",").length === 3
      && String(data?.inspectionCameraEndpointRotunda || "").split(",").length === 3
      && String(data?.inspectionCameraEndpointCab || "").split(",").length === 3
      && String(data?.inspectionCameraEndpointAircraftBoundsMin || "").split(",").length === 3
      && String(data?.inspectionCameraEndpointAircraftBoundsMax || "").split(",").length === 3
      && String(data?.inspectionCameraEndpointFrameSize || "").split(",").length === 3;
  }, {
    cameraAuthority: CAMERA_ENDPOINT_AUTHORITY,
    lockAuthority: CAMERA_LOCK_AUTHORITY,
  }, { timeout: 30_000, polling: 100 });

  const runtime = await page.evaluate(() => ({
    ...document.querySelector("canvas.trainerCanvas").dataset,
  }));
  expect(runtime.terminal4UploadedJetwayBogieGroundContactAuthority).toBe(JETWAY_GROUND_AUTHORITY);
  expect(Math.abs(Number(runtime.terminal4UploadedJetwayBogieGroundClearanceMeters))).toBeLessThanOrEqual(0.005);
  expect(runtime.inspectionAircraftGroundingAuthority).toBe(AIRCRAFT_GROUND_AUTHORITY);
  expect(Number(runtime.inspectionAircraftLandingGearContactPointCount)).toBeGreaterThanOrEqual(6);
  expect(Number(runtime.inspectionAircraftLandingGearContactClusterCount)).toBeGreaterThanOrEqual(3);
  expect(Number(runtime.inspectionAircraftLandingGearContactSpanX)).toBeGreaterThanOrEqual(1);
  expect(Number(runtime.inspectionAircraftLandingGearContactSpanZ)).toBeGreaterThanOrEqual(4);
  expect(Math.abs(Number(runtime.inspectionAircraftGroundClearanceMeters))).toBeLessThanOrEqual(0.01);
  expect(Number(runtime.inspectionAircraftDoorVerticalErrorMeters)).toBeLessThanOrEqual(0.01);
  expect(runtime.inspectionAircraftJetwayVerticalFitAuthority).toBe(VERTICAL_FIT_AUTHORITY);
  expect(runtime.inspectionCameraEndpointAuthority).toBe(CAMERA_ENDPOINT_AUTHORITY);
  expect(runtime.inspectionCameraEndpointLockAuthority).toBe(CAMERA_LOCK_AUTHORITY);
  expect(Math.abs(Number(runtime.inspectionCameraEndpointConvergenceErrorMeters))).toBeLessThanOrEqual(0.001);

  const cameraPosition = parseTriplet(runtime.inspectionCameraEndpointPosition, "A1 camera position");
  const cameraTarget = parseTriplet(runtime.inspectionCameraEndpointTarget, "A1 camera target");
  const wall = parseTriplet(runtime.inspectionCameraEndpointWall, "A1 measured terminal wall");
  const rotunda = parseTriplet(runtime.inspectionCameraEndpointRotunda, "A1 Rotunda endpoint");
  const cab = parseTriplet(runtime.inspectionCameraEndpointCab, "A1 Cab endpoint");
  const aircraftBoundsMin = parseTriplet(
    runtime.inspectionCameraEndpointAircraftBoundsMin,
    "A1 rendered-aircraft bounds minimum",
  );
  const aircraftBoundsMax = parseTriplet(
    runtime.inspectionCameraEndpointAircraftBoundsMax,
    "A1 rendered-aircraft bounds maximum",
  );
  const frameSize = parseTriplet(runtime.inspectionCameraEndpointFrameSize, "A1 complete frame size");
  const aircraftBoundsSize = aircraftBoundsMax.map((value, index) => value - aircraftBoundsMin[index]);
  expect(aircraftBoundsSize.every((value) => value > 0)).toBe(true);
  expect(Math.hypot(aircraftBoundsSize[0], aircraftBoundsSize[2])).toBeGreaterThan(30);
  expect(Math.hypot(aircraftBoundsSize[0], aircraftBoundsSize[2])).toBeLessThan(50);
  expect(Math.max(frameSize[0], frameSize[2])).toBeGreaterThanOrEqual(
    Math.max(aircraftBoundsSize[0], aircraftBoundsSize[2]),
  );
  const rotundaWallDistance = distance3(rotunda, wall);
  const rotundaCabDistance = distance3(rotunda, cab);
  expect(rotundaWallDistance).toBeGreaterThan(1.5);
  expect(rotundaWallDistance).toBeLessThan(6);
  expect(rotundaCabDistance).toBeGreaterThan(20);
  expect(rotundaCabDistance).toBeLessThan(45);
  expect(rotundaWallDistance + 10).toBeLessThan(rotundaCabDistance);
  expect(distance3(cameraPosition, cameraTarget)).toBeGreaterThan(35);
  expect(distance3(cameraPosition, cameraTarget)).toBeLessThan(100);
  const wallCabMidpoint = [
    (wall[0] + cab[0]) * 0.5,
    (wall[1] + cab[1]) * 0.5,
    (wall[2] + cab[2]) * 0.5,
  ];
  expect(distance3(cameraTarget, wallCabMidpoint)).toBeLessThan(25);

  await page.addStyleTag({
    content: ".rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}",
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await captureCanvas(page, "test-results/a1-measured-ground-contact.png");

  await page.evaluate(async () => {
    const select = document.querySelector('select[aria-label="Camera view"]');
    if (!(select instanceof HTMLSelectElement)) throw new Error("Camera view selector is missing");
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error("Native camera selector setter is unavailable");
    setter.call(select, "overhead");
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await page.waitForFunction(({ cameraAuthority, lockAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionOverheadCameraEndpointAuthority === cameraAuthority
      && data?.inspectionOverheadCameraEndpointLockAuthority === lockAuthority
      && Math.abs(Number(data?.inspectionOverheadCameraEndpointConvergenceErrorMeters)) <= 0.001
      && String(data?.inspectionOverheadCameraEndpointTarget || "").split(",").length === 3
      && String(data?.inspectionOverheadCameraEndpointFrameSize || "").split(",").length === 3;
  }, {
    cameraAuthority: CAMERA_ENDPOINT_AUTHORITY,
    lockAuthority: CAMERA_LOCK_AUTHORITY,
  }, { timeout: 30_000, polling: 100 });

  const overheadRuntime = await page.evaluate(() => ({
    ...document.querySelector("canvas.trainerCanvas").dataset,
  }));
  expect(overheadRuntime.inspectionOverheadCameraEndpointAuthority).toBe(CAMERA_ENDPOINT_AUTHORITY);
  expect(overheadRuntime.inspectionOverheadCameraEndpointLockAuthority).toBe(CAMERA_LOCK_AUTHORITY);
  expect(Math.abs(Number(overheadRuntime.inspectionOverheadCameraEndpointConvergenceErrorMeters))).toBeLessThanOrEqual(0.001);
  const overheadTarget = parseTriplet(
    overheadRuntime.inspectionOverheadCameraEndpointTarget,
    "A1 overhead camera target",
  );
  const overheadFrameSize = parseTriplet(
    overheadRuntime.inspectionOverheadCameraEndpointFrameSize,
    "A1 overhead complete frame size",
  );
  expect(Math.max(overheadFrameSize[0], overheadFrameSize[2])).toBeGreaterThanOrEqual(
    Math.max(aircraftBoundsSize[0], aircraftBoundsSize[2]),
  );
  expect(distance3(overheadTarget, cameraTarget)).toBeLessThan(25);
  await captureCanvas(page, "test-results/a1-measured-ground-contact-overhead.png");

  fs.writeFileSync(
    "test-results/a1-measured-ground-contact.json",
    `${JSON.stringify({
      jetwayGroundAuthority: runtime.terminal4UploadedJetwayBogieGroundContactAuthority,
      jetwayGroundClearanceMeters: Number(runtime.terminal4UploadedJetwayBogieGroundClearanceMeters),
      aircraftGroundAuthority: runtime.inspectionAircraftGroundingAuthority,
      aircraftGroundClearanceMeters: Number(runtime.inspectionAircraftGroundClearanceMeters),
      aircraftContactPointCount: Number(runtime.inspectionAircraftLandingGearContactPointCount),
      aircraftContactClusterCount: Number(runtime.inspectionAircraftLandingGearContactClusterCount),
      aircraftContactSpan: [
        Number(runtime.inspectionAircraftLandingGearContactSpanX),
        Number(runtime.inspectionAircraftLandingGearContactSpanZ),
      ],
      aircraftDoorVerticalErrorMeters: Number(runtime.inspectionAircraftDoorVerticalErrorMeters),
      jetwayVerticalFitAuthority: runtime.inspectionAircraftJetwayVerticalFitAuthority,
      cameraEndpointAuthority: runtime.inspectionCameraEndpointAuthority,
      cameraLockAuthority: runtime.inspectionCameraEndpointLockAuthority,
      cameraConvergenceErrorMeters: Number(runtime.inspectionCameraEndpointConvergenceErrorMeters),
      cameraPosition,
      cameraTarget,
      wall,
      rotunda,
      cab,
      aircraftBoundsMin,
      aircraftBoundsMax,
      aircraftBoundsSize,
      frameSize,
      overheadCameraEndpointAuthority: overheadRuntime.inspectionOverheadCameraEndpointAuthority,
      overheadCameraLockAuthority: overheadRuntime.inspectionOverheadCameraEndpointLockAuthority,
      overheadCameraConvergenceErrorMeters: Number(
        overheadRuntime.inspectionOverheadCameraEndpointConvergenceErrorMeters,
      ),
      overheadTarget,
      overheadFrameSize,
      rotundaWallDistance,
      rotundaCabDistance,
      evidenceAuthority: "exact-runtime-measured-ground-contact-and-current-head-render",
    }, null, 2)}\n`,
  );
});
