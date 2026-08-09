import fs from "node:fs";
import { expect, test } from "@playwright/test";

const SUBVIEW_AUTHORITY = "source-measured-a1-terminal-joint-camera-v3";
const CAMERA_AUTHORITY = "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2";
const LOCK_AUTHORITY = "exact-a1-evidence-camera-direct-lock-v1";
const VISUAL_AUTHORITY = "same-day-a1-continuous-source-measured-solid-closed-grounded-v2";
const CONTINUITY_AUTHORITY = "exact-authored-five-part-chain-no-isolated-node-rotation-v2";
const BOGIE_GROUND_AUTHORITY = "exact-authored-a1-lowest-geometry-ramp-contact-v2";
const NO_LIFT_AUTHORITY = "grounded-jetway-door-gap-reported-no-child-lift-v1";
const FIXED_AIRCRAFT_AUTHORITY = "source-a1-gate-stop-world-offset-persisted-no-cab-follow-v3";
const AIRCRAFT_MODE_POSE_AUTHORITY = "a1-single-aircraft-pose-training-and-free-drive-v1";
const SOURCE_HEADING_AUTHORITY = "source-a1-parking-heading-authored-door-registration-v2";

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

test("A1 terminal joint and authored bogie match the same-day source-measured geometry", async ({ page }) => {
  test.setTimeout(780_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({ visualAuthority, continuityAuthority, bogieAuthority, noLiftAuthority, aircraftAuthority, modeAuthority, headingAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    const wallAuthority = String(data?.terminal4A1ConnectionAuthority || "");
    return data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayCount === "58"
      && data?.inspectionAircraftPoseAuthority === aircraftAuthority
      && data?.aircraftModePoseAuthority === modeAuthority
      && data?.inspectionAircraftHeadingAuthority === headingAuthority
      && data?.inspectionAircraftPoseStored === "true"
      && data?.inspectionAircraftPoseApplied === "true"
      && Number(data?.inspectionAircraftPoseErrorMeters) <= 0.01
      && Math.abs(Number(data?.aircraftModePoseLiveX)) <= 0.01
      && Math.abs(Number(data?.aircraftModePoseLiveZ) - 6.2) <= 0.01
      && Math.abs(Number(data?.aircraftModePoseLiveYaw) - 0.00857) <= 0.0001
      && Number(data?.terminal4A1JetwayWallDistance) > 2.9
      && Number(data?.terminal4A1JetwayWallDistance) < 5.8
      && Math.abs(Number(data?.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters) - 2.4) <= 0.05
      && !/WALK|JETWAY|CONNECTOR|PORTAL/i.test(wallAuthority)
      && data?.terminal4UploadedJetwayA1VisualAcceptanceAuthority === visualAuthority
      && data?.terminal4UploadedJetwayA1AssemblyContinuityAuthority === continuityAuthority
      && data?.terminal4UploadedJetwayA1AssemblyPartCount === "5"
      && data?.terminal4UploadedJetwayA1IsolatedNodeRotationCount === "0"
      && data?.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed === "true"
      && data?.terminal4UploadedJetwayA1NoGeneratedGlassCorridor === "true"
      && data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieAuthority
      && Math.abs(Number(data?.terminal4UploadedJetwayBogieGroundClearanceMeters)) <= 0.005
      && Number(data?.terminal4UploadedJetwayBogieGroundContactPointCount) >= 8
      && Number(data?.terminal4UploadedJetwayBogieGroundContactClusterCount) >= 2
      && Number(data?.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters) >= 1.2
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
  expect(terminalRuntime.aircraftModePoseAuthority).toBe(AIRCRAFT_MODE_POSE_AUTHORITY);
  expect(terminalRuntime.inspectionAircraftHeadingAuthority).toBe(SOURCE_HEADING_AUTHORITY);
  expect(Number(terminalRuntime.aircraftModePoseLiveX)).toBeCloseTo(0, 3);
  expect(Number(terminalRuntime.aircraftModePoseLiveZ)).toBeCloseTo(6.2, 3);
  expect(Number(terminalRuntime.aircraftModePoseLiveYaw)).toBeCloseTo(0.00857, 4);
  expect(terminalRuntime.inspectionCameraEndpointSubviewAuthority).toBe(SUBVIEW_AUTHORITY);
  expect(Number(terminalRuntime.terminal4A1JetwayWallDistance)).toBeGreaterThan(2.9);
  expect(Number(terminalRuntime.terminal4A1JetwayWallDistance)).toBeLessThan(5.8);
  expect(Math.abs(Number(terminalRuntime.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters) - 2.4)).toBeLessThanOrEqual(0.05);
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
  expect(Math.abs(Number(bogieRuntime.terminal4UploadedJetwayBogieGroundClearanceMeters))).toBeLessThanOrEqual(0.005);
  expect(Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactPointCount)).toBeGreaterThanOrEqual(8);
  expect(Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactClusterCount)).toBeGreaterThanOrEqual(2);
  expect(Number(bogieRuntime.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters)).toBeGreaterThanOrEqual(1.2);
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
    visibleVestibuleLengthMeters: Number(terminalRuntime.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters),
    bogieGroundClearanceMeters: Number(bogieRuntime.terminal4UploadedJetwayBogieGroundClearanceMeters),
    bogieContactPointCount: Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactPointCount),
    bogieContactClusterCount: Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactClusterCount),
    bogieHorizontalContactSpanMeters: Number(bogieRuntime.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters),
    authoredBogieGroundPreserved: bogieRuntime.inspectionAircraftJetwayAuthoredBogieGroundPreserved,
    evidenceViews: ["terminal-joint", "bogie-contact"],
  }, null, 2)}\n`);
});
