import fs from "node:fs";
import { expect, test } from "@playwright/test";

const SUBVIEW_AUTHORITY = "source-measured-a1-apron-side-evidence-camera-v5-balanced-branches";
const CAMERA_AUTHORITY = "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2";
const LOCK_AUTHORITY = "exact-a1-evidence-camera-direct-lock-v1";
const VISUAL_AUTHORITY = "same-day-a1-continuous-source-measured-solid-closed-grounded-v2";
const CONTINUITY_AUTHORITY = "exact-authored-five-part-chain-no-isolated-node-rotation-v2";
const BOGIE_GROUND_AUTHORITY = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
const NO_LIFT_AUTHORITY = "grounded-jetway-door-gap-reported-no-child-lift-v1";
const FIXED_AIRCRAFT_AUTHORITY = "final-live-cab-mesh-visible-door-registration-v7";
const AIRCRAFT_MODE_POSE_AUTHORITY = "a1-single-aircraft-pose-training-and-free-drive-v1";
const SOURCE_HEADING_AUTHORITY = "source-a1-parking-heading-authored-door-registration-v2";
const SOURCE_A1_YAW = 0.00857;

function triplet(value, label) {
  const values = String(value || "").split(",").map(Number);
  expect(values, `${label} must contain three finite values`).toHaveLength(3);
  expect(values.every(Number.isFinite), `${label} must contain three finite values`).toBe(true);
  return values;
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function captureCanvas(page, outputPath) {
  const canvas = page.locator("canvas.trainerCanvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Three.js canvas has no visible bounds");
  const client = await page.context().newCDPSession(page);
  try {
    const { data } = await client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
      clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: box.height, scale: 1 },
    });
    const payload = Buffer.from(data, "base64");
    expect(payload.length).toBeGreaterThan(40_000);
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync(outputPath, payload);
  } finally {
    await client.detach();
  }
}

async function selectSubview(page, subview) {
  await page.evaluate(nextSubview => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Three.js canvas is missing");
    canvas.dataset.a1EvidenceSubview = nextSubview;
  }, subview);
  await page.waitForFunction(({ expectedSubview, authority, cameraAuthority, lockAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionCameraEndpointSubview === expectedSubview
      && data?.inspectionCameraEndpointSubviewAuthority === authority
      && data?.inspectionCameraEndpointAuthority === cameraAuthority
      && data?.inspectionCameraEndpointLockAuthority === lockAuthority
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;
  }, { expectedSubview: subview, authority: SUBVIEW_AUTHORITY, cameraAuthority: CAMERA_AUTHORITY, lockAuthority: LOCK_AUTHORITY }, { timeout: 30_000, polling: 100 });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test("A1 terminal joint and authored Tunnel-C bogie match the current source-measured geometry", async ({ page }) => {
  test.setTimeout(780_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({ visualAuthority, continuityAuthority, bogieAuthority, noLiftAuthority, aircraftAuthority, modeAuthority, headingAuthority, sourceYaw }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    const wallAuthority = String(data?.terminal4A1ConnectionAuthority || "");
    const wallDistance = Number(data?.terminal4A1JetwayWallDistance);
    const finalRotundaToWall = Number(data?.a1ExactRotundaToWallWorldMeters);
    const noseX = Number(data?.inspectionAircraftNoseGearX);
    const noseZ = Number(data?.inspectionAircraftNoseGearZ);
    const liveX = Number(data?.aircraftModePoseLiveX);
    const liveZ = Number(data?.aircraftModePoseLiveZ);
    return data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayCount === "58"
      && data?.inspectionAircraftPoseAuthority === aircraftAuthority
      && data?.inspectionAircraftFixedSourceGateAuthority === aircraftAuthority
      && data?.aircraftModePoseAuthority === modeAuthority
      && data?.inspectionAircraftHeadingAuthority === headingAuthority
      && data?.inspectionAircraftPoseStored === "true"
      && data?.inspectionAircraftPoseApplied === "true"
      && Number(data?.inspectionAircraftPoseErrorMeters) <= 0.01
      && [noseX, noseZ, liveX, liveZ].every(Number.isFinite)
      && Math.abs(liveX - noseX) <= 0.01
      && Math.abs(liveZ - noseZ) <= 0.01
      && Math.abs(Number(data?.aircraftModePoseLiveYaw) - sourceYaw) <= 0.0001
      && Number(data?.inspectionAircraftSourceGateDoorTargetErrorMeters) <= 0.01
      && Number(data?.inspectionAircraftCabContactErrorMeters) <= 0.01
      && wallDistance > 2.9 && wallDistance < 5.8
      && Number.isFinite(finalRotundaToWall)
      && Math.abs(finalRotundaToWall - wallDistance) <= 0.05
      && !/WALK|JETWAY|CONNECTOR|PORTAL/i.test(wallAuthority)
      && data?.terminal4UploadedJetwayA1VisualAcceptanceAuthority === visualAuthority
      && data?.terminal4UploadedJetwayA1AssemblyContinuityAuthority === continuityAuthority
      && data?.terminal4UploadedJetwayA1AssemblyPartCount === "5"
      && data?.terminal4UploadedJetwayA1IsolatedNodeRotationCount === "0"
      && data?.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed === "true"
      && data?.terminal4UploadedJetwayA1NoGeneratedGlassCorridor === "true"
      && data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieAuthority
      && Math.abs(Number(data?.terminal4UploadedJetwayBogieGroundClearanceMeters)) <= 0.015
      && Number(data?.terminal4UploadedJetwayBogieGroundContactPointCount) >= 4
      && Number(data?.terminal4UploadedJetwayBogieGroundContactClusterCount) >= 1
      && Number(data?.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters) >= 0.35
      && data?.inspectionAircraftJetwayVerticalFitAuthority === noLiftAuthority
      && Math.abs(Number(data?.inspectionAircraftJetwayVerticalFitMeters)) <= 0.001
      && data?.inspectionAircraftJetwayAuthoredBogieGroundPreserved === "true";
  }, {
    visualAuthority: VISUAL_AUTHORITY,
    continuityAuthority: CONTINUITY_AUTHORITY,
    bogieAuthority: BOGIE_GROUND_AUTHORITY,
    noLiftAuthority: NO_LIFT_AUTHORITY,
    aircraftAuthority: FIXED_AIRCRAFT_AUTHORITY,
    modeAuthority: AIRCRAFT_MODE_POSE_AUTHORITY,
    headingAuthority: SOURCE_HEADING_AUTHORITY,
    sourceYaw: SOURCE_A1_YAW,
  }, { timeout: 300_000, polling: 100 });

  await page.getByLabel("Inspection location").selectOption("a1Connection");
  await page.waitForFunction(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionPreset === "a1Connection"
      && data?.a1JetwayDeployment === "1.000"
      && data?.a1JetwayState === "attached-to-aircraft-door";
  }, null, { timeout: 30_000, polling: 100 });
  await page.addStyleTag({ content: ".rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}" });

  await selectSubview(page, "terminal-joint");
  const terminalRuntime = await page.evaluate(() => ({ ...document.querySelector("canvas.trainerCanvas").dataset }));
  expect(terminalRuntime.inspectionAircraftPoseAuthority).toBe(FIXED_AIRCRAFT_AUTHORITY);
  expect(terminalRuntime.inspectionAircraftFixedSourceGateAuthority).toBe(FIXED_AIRCRAFT_AUTHORITY);
  expect(terminalRuntime.aircraftModePoseAuthority).toBe(AIRCRAFT_MODE_POSE_AUTHORITY);
  expect(terminalRuntime.inspectionAircraftHeadingAuthority).toBe(SOURCE_HEADING_AUTHORITY);
  const terminalNoseX = Number(terminalRuntime.inspectionAircraftNoseGearX);
  const terminalNoseZ = Number(terminalRuntime.inspectionAircraftNoseGearZ);
  expect([terminalNoseX, terminalNoseZ].every(Number.isFinite)).toBe(true);
  expect(Number(terminalRuntime.aircraftModePoseLiveX)).toBeCloseTo(terminalNoseX, 5);
  expect(Number(terminalRuntime.aircraftModePoseLiveZ)).toBeCloseTo(terminalNoseZ, 5);
  expect(Number(terminalRuntime.aircraftModePoseLiveYaw)).toBeCloseTo(SOURCE_A1_YAW, 4);
  expect(Number(terminalRuntime.inspectionAircraftCabContactErrorMeters)).toBeLessThanOrEqual(0.01);
  expect(Number(terminalRuntime.inspectionAircraftSourceGateDoorTargetErrorMeters)).toBeLessThanOrEqual(0.01);
  expect(terminalRuntime.inspectionCameraEndpointSubviewAuthority).toBe(SUBVIEW_AUTHORITY);
  const wallDistance = Number(terminalRuntime.terminal4A1JetwayWallDistance);
  const finalRotundaToWall = Number(terminalRuntime.a1ExactRotundaToWallWorldMeters);
  expect(wallDistance).toBeGreaterThan(2.9);
  expect(wallDistance).toBeLessThan(5.8);
  expect(Number.isFinite(finalRotundaToWall)).toBe(true);
  expect(Math.abs(finalRotundaToWall - wallDistance)).toBeLessThanOrEqual(0.05);
  const wall = triplet(terminalRuntime.inspectionCameraEndpointWall, "terminal wall");
  const rotunda = triplet(terminalRuntime.inspectionCameraEndpointRotunda, "Rotunda");
  const target = triplet(terminalRuntime.inspectionCameraEndpointTarget, "terminal camera target");
  expect(distance3(wall, rotunda)).toBeGreaterThan(2.9);
  expect(distance3(wall, rotunda)).toBeLessThan(5.8);
  expect(Math.min(distance3(target, wall), distance3(target, rotunda))).toBeLessThan(3);
  await captureCanvas(page, "test-results/a1-terminal-joint-close.png");

  await selectSubview(page, "bogie-contact");
  const bogieRuntime = await page.evaluate(() => ({ ...document.querySelector("canvas.trainerCanvas").dataset }));
  expect(bogieRuntime.inspectionCameraEndpointSubviewAuthority).toBe(SUBVIEW_AUTHORITY);
  expect(bogieRuntime.terminal4UploadedJetwayBogieGroundContactAuthority).toBe(BOGIE_GROUND_AUTHORITY);
  expect(Math.abs(Number(bogieRuntime.terminal4UploadedJetwayBogieGroundClearanceMeters))).toBeLessThanOrEqual(0.015);
  expect(Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactPointCount)).toBeGreaterThanOrEqual(4);
  expect(Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactClusterCount)).toBeGreaterThanOrEqual(1);
  expect(Number(bogieRuntime.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters)).toBeGreaterThanOrEqual(0.35);
  expect(bogieRuntime.inspectionAircraftJetwayVerticalFitAuthority).toBe(NO_LIFT_AUTHORITY);
  expect(Number(bogieRuntime.inspectionAircraftJetwayVerticalFitMeters)).toBeCloseTo(0, 5);
  expect(bogieRuntime.inspectionAircraftJetwayAuthoredBogieGroundPreserved).toBe("true");
  const bogieCenter = triplet(bogieRuntime.inspectionCameraEndpointBogieContactCenter, "bogie contact center");
  const publishedCenter = [
    Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactCenterX),
    Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactCenterY),
    Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactCenterZ),
  ];
  expect(distance3(bogieCenter, publishedCenter)).toBeLessThanOrEqual(0.01);
  await captureCanvas(page, "test-results/a1-bogie-contact-close.png");

  fs.writeFileSync("test-results/a1-terminal-joint-bogie-subviews.json", `${JSON.stringify({
    subviewAuthority: SUBVIEW_AUTHORITY,
    visualAuthority: terminalRuntime.terminal4UploadedJetwayA1VisualAcceptanceAuthority,
    continuityAuthority: terminalRuntime.terminal4UploadedJetwayA1AssemblyContinuityAuthority,
    finalRotundaToWallDistanceMeters: finalRotundaToWall,
    bogieGroundClearanceMeters: Number(bogieRuntime.terminal4UploadedJetwayBogieGroundClearanceMeters),
    bogieContactPointCount: Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactPointCount),
    bogieContactClusterCount: Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactClusterCount),
    bogieHorizontalContactSpanMeters: Number(bogieRuntime.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters),
    authoredBogieGroundPreserved: bogieRuntime.inspectionAircraftJetwayAuthoredBogieGroundPreserved,
    evidenceViews: ["terminal-joint", "bogie-contact"],
  }, null, 2)}\n`);
});
