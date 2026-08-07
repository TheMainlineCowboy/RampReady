import fs from "node:fs";
import { expect, test } from "@playwright/test";

const SUBVIEW_AUTHORITY = "exact-a1-terminal-joint-and-bogie-contact-subviews-v2";
const CAMERA_AUTHORITY = "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2";
const LOCK_AUTHORITY = "exact-a1-evidence-camera-direct-lock-v1";
const VISUAL_AUTHORITY = "same-day-a1-continuous-compact-solid-closed-grounded-v1";
const BOGIE_GROUND_AUTHORITY = "exact-authored-a1-lowest-geometry-ramp-contact-v2";
const NO_LIFT_AUTHORITY = "grounded-jetway-door-gap-reported-no-child-lift-v1";

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
        () => reject(new Error("A1 close evidence capture exceeded 75 seconds")),
        75_000,
      )),
    ]);
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync(path, Buffer.from(data, "base64"));
    expect(fs.statSync(path).size).toBeGreaterThan(40_000);
  } finally {
    await client.detach();
  }
}

function parseTriplet(value, label) {
  const values = String(value || "").split(",").map(Number);
  expect(values, `${label} must contain three values`).toHaveLength(3);
  expect(values.every(Number.isFinite), `${label} must be finite`).toBe(true);
  return values;
}

function distance3(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function selectSubview(page, subview) {
  await page.evaluate((nextSubview) => {
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
  }, {
    expectedSubview: subview,
    authority: SUBVIEW_AUTHORITY,
    cameraAuthority: CAMERA_AUTHORITY,
    lockAuthority: LOCK_AUTHORITY,
  }, { timeout: 30_000, polling: 100 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

test("A1 close evidence shows the exact 2.4 m terminal vestibule and zero-lift grounded bogie", async ({ page }) => {
  test.setTimeout(780_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({ visualAuthority, bogieAuthority, noLiftAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    const wallAuthority = String(data?.terminal4A1ConnectionAuthority || "");
    const centerToWallDistance = Number(data?.terminal4A1JetwayWallDistance);
    const visibleVestibuleLength = Number(data?.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters);
    return data?.terminal4UploadedJetwayLoadState === "ready"
      && centerToWallDistance > 2.9
      && centerToWallDistance < 5.8
      && Math.abs(visibleVestibuleLength - 2.4) <= 0.05
      && !/WALK|JETWAY|CONNECTOR|PORTAL/i.test(wallAuthority)
      && data?.terminal4UploadedJetwayA1VisualAcceptanceAuthority === visualAuthority
      && data?.terminal4UploadedJetwayA1AssemblyPartCount === "5"
      && data?.terminal4UploadedJetwayA1IsolatedNodeRotationCount === "0"
      && data?.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed === "true"
      && data?.terminal4UploadedJetwayA1NoGeneratedGlassCorridor === "true"
      && data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieAuthority
      && Math.abs(Number(data?.terminal4UploadedJetwayBogieGroundClearanceMeters)) <= 0.005
      && Number(data?.terminal4UploadedJetwayBogieGroundContactPointCount) >= 8
      && Number(data?.terminal4UploadedJetwayBogieGroundContactClusterCount) >= 2
      && Number(data?.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters) >= 1.2
      && [
        data?.terminal4UploadedJetwayBogieGroundContactCenterX,
        data?.terminal4UploadedJetwayBogieGroundContactCenterY,
        data?.terminal4UploadedJetwayBogieGroundContactCenterZ,
      ].every((value) => Number.isFinite(Number(value)))
      && data?.inspectionAircraftJetwayVerticalFitAuthority === noLiftAuthority
      && Math.abs(Number(data?.inspectionAircraftJetwayVerticalFitMeters)) <= 0.001
      && data?.inspectionAircraftJetwayAuthoredBogieGroundPreserved === "true"
      && Number.isFinite(Number(data?.inspectionAircraftDoorSignedVerticalGapMeters))
      && Number.isFinite(Number(data?.inspectionAircraftJetwayRequestedVerticalFitMeters));
  }, {
    visualAuthority: VISUAL_AUTHORITY,
    bogieAuthority: BOGIE_GROUND_AUTHORITY,
    noLiftAuthority: NO_LIFT_AUTHORITY,
  }, { timeout: 300_000, polling: 100 });

  await page.getByLabel("Inspection location").selectOption("a1Connection");
  await page.waitForFunction(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionPreset === "a1Connection"
      && data?.a1JetwayDeployment === "1.000"
      && data?.a1JetwayState === "attached-to-aircraft-door";
  }, null, { timeout: 30_000, polling: 100 });

  await page.addStyleTag({
    content: ".rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}",
  });

  await selectSubview(page, "terminal-joint");
  const terminalRuntime = await page.evaluate(() => ({
    ...document.querySelector("canvas.trainerCanvas").dataset,
  }));
  expect(terminalRuntime.inspectionCameraEndpointSubviewAuthority).toBe(SUBVIEW_AUTHORITY);
  expect(terminalRuntime.inspectionCameraEndpointSubview).toBe("terminal-joint");
  expect(Number(terminalRuntime.a1ExactRotundaToWallWorldMeters)).toBeGreaterThan(2.9);
  expect(Number(terminalRuntime.a1ExactRotundaToWallWorldMeters)).toBeLessThan(5.8);
  expect(Number(terminalRuntime.terminal4A1JetwayWallDistance)).toBeGreaterThan(2.9);
  expect(Number(terminalRuntime.terminal4A1JetwayWallDistance)).toBeLessThan(5.8);
  expect(Math.abs(Number(terminalRuntime.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters) - 2.4)).toBeLessThanOrEqual(0.05);
  expect(terminalRuntime.terminal4A1ConnectionAuthority).not.toMatch(/WALK|JETWAY|CONNECTOR|PORTAL/i);

  const terminalCameraPosition = parseTriplet(
    terminalRuntime.inspectionCameraEndpointPosition,
    "terminal-joint camera position",
  );
  const terminalCameraTarget = parseTriplet(
    terminalRuntime.inspectionCameraEndpointTarget,
    "terminal-joint camera target",
  );
  const terminalJointCenter = parseTriplet(
    terminalRuntime.inspectionCameraEndpointJointCenter,
    "terminal-joint exact midpoint",
  );
  const terminalWall = parseTriplet(
    terminalRuntime.inspectionCameraEndpointWall,
    "terminal-joint wall",
  );
  const terminalRotunda = parseTriplet(
    terminalRuntime.inspectionCameraEndpointRotunda,
    "terminal-joint Rotunda",
  );
  const terminalCab = parseTriplet(
    terminalRuntime.inspectionCameraEndpointCab,
    "terminal-joint Cab",
  );
  expect(distance3(terminalCameraTarget, terminalJointCenter)).toBeLessThanOrEqual(0.25);
  expect(distance3(terminalCameraPosition, terminalCameraTarget)).toBeGreaterThan(9);
  expect(distance3(terminalCameraPosition, terminalCameraTarget)).toBeLessThan(15);
  expect(Number(terminalRuntime.inspectionCameraEndpointJointApronDistanceMeters)).toBeGreaterThanOrEqual(3.8);
  expect(Number(terminalRuntime.inspectionCameraEndpointJointSideDistanceMeters)).toBeGreaterThanOrEqual(9.4);
  expect(distance3(terminalWall, terminalRotunda)).toBeCloseTo(
    Number(terminalRuntime.inspectionCameraEndpointJointSpanMeters),
    3,
  );
  expect(distance3(terminalCameraTarget, terminalWall)).toBeLessThan(3);
  expect(distance3(terminalCameraTarget, terminalRotunda)).toBeLessThan(3);
  const wallToCabX = terminalCab[0] - terminalWall[0];
  const wallToCabZ = terminalCab[2] - terminalWall[2];
  const wallToCabLength = Math.hypot(wallToCabX, wallToCabZ);
  const cameraFromJointX = terminalCameraPosition[0] - terminalJointCenter[0];
  const cameraFromJointZ = terminalCameraPosition[2] - terminalJointCenter[2];
  const cameraApronProjection = (
    cameraFromJointX * wallToCabX + cameraFromJointZ * wallToCabZ
  ) / wallToCabLength;
  expect(cameraApronProjection).toBeGreaterThan(3.2);
  await captureCanvas(page, "test-results/a1-terminal-joint-close.png");

  await selectSubview(page, "bogie-contact");
  const bogieRuntime = await page.evaluate(() => ({
    ...document.querySelector("canvas.trainerCanvas").dataset,
  }));
  expect(bogieRuntime.inspectionCameraEndpointSubviewAuthority).toBe(SUBVIEW_AUTHORITY);
  expect(bogieRuntime.inspectionCameraEndpointSubview).toBe("bogie-contact");
  expect(bogieRuntime.terminal4UploadedJetwayBogieGroundContactAuthority).toBe(BOGIE_GROUND_AUTHORITY);
  expect(Math.abs(Number(bogieRuntime.terminal4UploadedJetwayBogieGroundClearanceMeters))).toBeLessThanOrEqual(0.005);
  expect(Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactPointCount)).toBeGreaterThanOrEqual(8);
  expect(Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactClusterCount)).toBeGreaterThanOrEqual(2);
  expect(Number(bogieRuntime.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters)).toBeGreaterThanOrEqual(1.2);
  expect(bogieRuntime.inspectionAircraftJetwayVerticalFitAuthority).toBe(NO_LIFT_AUTHORITY);
  expect(Number(bogieRuntime.inspectionAircraftJetwayVerticalFitMeters)).toBeCloseTo(0, 5);
  expect(bogieRuntime.inspectionAircraftJetwayAuthoredBogieGroundPreserved).toBe("true");
  const signedDoorGap = Number(bogieRuntime.inspectionAircraftDoorSignedVerticalGapMeters);
  const requestedDoorFit = Number(bogieRuntime.inspectionAircraftJetwayRequestedVerticalFitMeters);
  expect(Number.isFinite(signedDoorGap)).toBe(true);
  expect(requestedDoorFit).toBeCloseTo(signedDoorGap, 5);

  const bogieCameraPosition = parseTriplet(
    bogieRuntime.inspectionCameraEndpointPosition,
    "bogie camera position",
  );
  const bogieCameraTarget = parseTriplet(
    bogieRuntime.inspectionCameraEndpointTarget,
    "bogie camera target",
  );
  const bogieContactCenter = parseTriplet(
    bogieRuntime.inspectionCameraEndpointBogieContactCenter,
    "bogie exact contact center",
  );
  const bogieAircraftCenter = parseTriplet(
    bogieRuntime.inspectionCameraEndpointBogieAircraftCenter,
    "bogie aircraft center",
  );
  const publishedBogieContactCenter = [
    Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactCenterX),
    Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactCenterY),
    Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactCenterZ),
  ];
  expect(publishedBogieContactCenter.every(Number.isFinite)).toBe(true);
  expect(distance3(bogieContactCenter, publishedBogieContactCenter)).toBeLessThanOrEqual(0.01);
  expect(Math.hypot(
    bogieCameraTarget[0] - bogieContactCenter[0],
    bogieCameraTarget[2] - bogieContactCenter[2],
  )).toBeLessThanOrEqual(0.05);
  expect(bogieCameraTarget[1] - bogieContactCenter[1]).toBeGreaterThan(0.5);
  expect(bogieCameraTarget[1] - bogieContactCenter[1]).toBeLessThan(1);
  expect(distance3(bogieCameraPosition, bogieCameraTarget)).toBeGreaterThan(6);
  expect(distance3(bogieCameraPosition, bogieCameraTarget)).toBeLessThan(9);
  expect(Number(bogieRuntime.inspectionCameraEndpointBogieAircraftOppositionCosine)).toBeLessThan(-0.65);
  const cameraFromBogie = [
    bogieCameraPosition[0] - bogieContactCenter[0],
    bogieCameraPosition[2] - bogieContactCenter[2],
  ];
  const aircraftFromBogie = [
    bogieAircraftCenter[0] - bogieContactCenter[0],
    bogieAircraftCenter[2] - bogieContactCenter[2],
  ];
  expect(cameraFromBogie[0] * aircraftFromBogie[0] + cameraFromBogie[1] * aircraftFromBogie[1]).toBeLessThan(0);
  await captureCanvas(page, "test-results/a1-bogie-contact-close.png");

  await selectSubview(page, "full-assembly");
  fs.writeFileSync(
    "test-results/a1-terminal-joint-bogie-subviews.json",
    `${JSON.stringify({
      subviewAuthority: SUBVIEW_AUTHORITY,
      cameraAuthority: terminalRuntime.inspectionCameraEndpointAuthority,
      lockAuthority: terminalRuntime.inspectionCameraEndpointLockAuthority,
      visualAuthority: terminalRuntime.terminal4UploadedJetwayA1VisualAcceptanceAuthority,
      terminalSubview: terminalRuntime.inspectionCameraEndpointSubview,
      bogieSubview: bogieRuntime.inspectionCameraEndpointSubview,
      terminalConnectionAuthority: terminalRuntime.terminal4A1ConnectionAuthority,
      rotundaCenterToWallMeters: Number(terminalRuntime.terminal4A1JetwayWallDistance),
      exactRotundaCenterToWallMeters: Number(terminalRuntime.a1ExactRotundaToWallWorldMeters),
      visibleVestibuleLengthMeters: Number(
        terminalRuntime.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters,
      ),
      terminalCameraPosition,
      terminalCameraTarget,
      terminalJointCenter,
      terminalJointApronDistanceMeters: Number(
        terminalRuntime.inspectionCameraEndpointJointApronDistanceMeters,
      ),
      terminalJointSideDistanceMeters: Number(
        terminalRuntime.inspectionCameraEndpointJointSideDistanceMeters,
      ),
      bogieGroundAuthority: bogieRuntime.terminal4UploadedJetwayBogieGroundContactAuthority,
      bogieGroundClearanceMeters: Number(
        bogieRuntime.terminal4UploadedJetwayBogieGroundClearanceMeters,
      ),
      bogieContactPointCount: Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactPointCount),
      bogieContactClusterCount: Number(bogieRuntime.terminal4UploadedJetwayBogieGroundContactClusterCount),
      bogieHorizontalContactSpanMeters: Number(
        bogieRuntime.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters,
      ),
      bogieContactCenter,
      bogieAircraftCenter,
      bogieCameraPosition,
      bogieCameraTarget,
      bogieAircraftOppositionCosine: Number(
        bogieRuntime.inspectionCameraEndpointBogieAircraftOppositionCosine,
      ),
      noLiftAuthority: bogieRuntime.inspectionAircraftJetwayVerticalFitAuthority,
      requestedDoorFitMeters: requestedDoorFit,
      appliedDoorFitMeters: Number(bogieRuntime.inspectionAircraftJetwayVerticalFitMeters),
      signedDoorGapMeters: signedDoorGap,
      authoredBogieGroundPreserved: bogieRuntime.inspectionAircraftJetwayAuthoredBogieGroundPreserved,
      evidenceViews: ["terminal-joint", "bogie-contact"],
    }, null, 2)}\n`,
  );
});
