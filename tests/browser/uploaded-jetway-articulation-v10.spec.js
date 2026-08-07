import fs from "node:fs";
import { expect, test } from "@playwright/test";

const ARTICULATION_AUTHORITY = "user-supplied-airport-jetway-per-gate-telescoping-v11-a1-only";
const STATIC_RIGID_AUTHORITY = "57-static-exact-glb-rigid-source-hierarchy-v1";
const STATIC_SOURCE_PLACEMENT_AUTHORITY = "57-static-exact-bgl-source-placement-no-facade-relocation-v1";
const SOURCE_ONLY_CAB_AUTHORITY = "57-static-source-glb-cab-only-no-synthetic-cap-v1";
const AIRCRAFT_MODE_POSE_AUTHORITY = "a1-single-aircraft-pose-training-and-free-drive-v1";
const JETWAY_BOGIE_GROUND_AUTHORITY = "exact-authored-a1-lowest-geometry-ramp-contact-v2";

function verifySourceIntegrity() {
  const closureSource = fs.readFileSync("src/environment/staticJetwayPortalClosures.js", "utf8");
  expect(closureSource).toContain(SOURCE_ONLY_CAB_AUTHORITY);
  expect(closureSource).not.toContain("new THREE.BoxGeometry");
  expect(closureSource).not.toContain("new THREE.InstancedMesh");
  expect(closureSource).not.toContain("3.9, 3.5, 1.45");
  expect(closureSource).not.toContain("57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3");

  const articulationSource = fs.readFileSync("src/environment/uploadedAirportJetwayArticulationV10.js", "utf8");
  expect(articulationSource).toContain(ARTICULATION_AUTHORITY);
  expect(articulationSource).toContain(STATIC_RIGID_AUTHORITY);
  expect(articulationSource).toContain('if (placement?.gate !== "A1")');
  expect(articulationSource).toContain("rigidSourceHierarchy: true");

  const placementPass = fs.readFileSync("scripts/prepare-static-jetway-source-placement-integrity-v1.mjs", "utf8");
  expect(placementPass).toContain(STATIC_SOURCE_PLACEMENT_AUTHORITY);
  expect(placementPass).toContain("uploadedJetwayStaticFacadeRelocationApplied = false");

  const buildSource = fs.readFileSync("scripts/build-production-simulator-quality.mjs", "utf8");
  expect(buildSource).not.toContain('runNode("scripts/prepare-static-jetway-portal-closures-v1.mjs")');
  expect(buildSource).not.toContain('runNode("scripts/prepare-terminal4-static-jetway-parking-v15.mjs")');
  expect(buildSource).toContain('runNode("scripts/prepare-static-jetway-source-placement-integrity-v1.mjs")');
  expect(buildSource).toContain('runNode("scripts/prepare-a1-unified-aircraft-pose-v1.mjs")');
}

async function captureCanvas(page, path) {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!canvas) throw new Error("Three.js canvas is missing");
    const bounds = canvas.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  });
  const client = await page.context().newCDPSession(page);
  try {
    await client.send("Page.bringToFront");
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
      () => reject(new Error("Jetway evidence capture exceeded 75 seconds")),
      75_000,
    ));
    const { data } = await Promise.race([capture, timeout]);
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync(path, Buffer.from(data, "base64"));
    expect(fs.statSync(path).size).toBeGreaterThan(50_000);
  } finally {
    await client.detach();
  }
}

async function captureInspectionPreset(page, presetId, outputPath) {
  await page.evaluate((nextPreset) => {
    const select = document.querySelector('select[aria-label="Inspection location"]');
    if (!(select instanceof HTMLSelectElement)) throw new Error("Inspection location selector is missing");
    select.value = nextPreset;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, presetId);
  await page.waitForFunction((expectedPreset) => (
    document.querySelector("canvas.trainerCanvas")?.dataset?.inspectionPreset === expectedPreset
  ), presetId, { timeout: 30_000, polling: 100 });

  await page.waitForFunction(({ preset, authority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    if (data?.terminal4UploadedJetwayLoadState !== "ready") return false;
    if (data?.terminal4UploadedJetwayArticulationAuthority !== authority) return false;
    if (preset !== "a1Connection") return true;
    return data?.a1JetwayDeployment === "1.000"
      && data?.a1JetwayState === "attached-to-aircraft-door"
      && Number.isFinite(Number(data?.inspectionAircraftDoorVerticalErrorMeters))
      && Number(data?.inspectionAircraftDoorVerticalErrorMeters) <= 6
      && Number.isFinite(Number(data?.inspectionAircraftDoorSignedVerticalGapMeters))
      && Number.isFinite(Number(data?.inspectionAircraftJetwayRequestedVerticalFitMeters))
      && Math.abs(Number(data?.inspectionAircraftJetwayVerticalFitMeters)) <= 0.001
      && data?.inspectionAircraftJetwayAuthoredBogieGroundPreserved === "true"
      && Math.abs(Number(data?.inspectionAircraftGroundClearanceMeters)) <= 0.01;
  }, { preset: presetId, authority: ARTICULATION_AUTHORITY }, { timeout: 45_000, polling: 100 });

  await page.waitForTimeout(2_000);
  await captureCanvas(page, outputPath);
}

function physicalAircraftPose(runtime) {
  return {
    x: Number(runtime.aircraftModePoseLiveX),
    y: Number(runtime.aircraftModePoseLiveY),
    z: Number(runtime.aircraftModePoseLiveZ),
    yaw: Number(runtime.aircraftModePoseLiveYaw),
    error: Number(runtime.inspectionAircraftPoseErrorMeters),
  };
}

function expectFinitePose(pose) {
  expect([pose.x, pose.y, pose.z, pose.yaw, pose.error].every(Number.isFinite)).toBe(true);
  expect(pose.error).toBeLessThanOrEqual(0.01);
}

function expectSamePose(actual, expected) {
  expect(Math.abs(actual.x - expected.x)).toBeLessThanOrEqual(1e-6);
  expect(Math.abs(actual.y - expected.y)).toBeLessThanOrEqual(1e-6);
  expect(Math.abs(actual.z - expected.z)).toBeLessThanOrEqual(1e-6);
  expect(Math.abs(actual.yaw - expected.yaw)).toBeLessThanOrEqual(1e-6);
}

test("A1 uses one aircraft pose and only A1 articulates while all 57 static supplied jetways remain rigid", async ({ page }) => {
  test.setTimeout(780_000);
  verifySourceIntegrity();
  await page.setViewportSize({ width: 1440, height: 900 });
  page.on("console", (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => console.log(`[browser:pageerror] ${error.message}`));
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({ articulationAuthority, bogieGroundAuthority, poseAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return (
      data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieGroundAuthority
      && data?.terminal4UploadedJetwayArticulationAuthority === articulationAuthority
      && data?.terminal4UploadedJetwayA1PartOrderValid === "true"
      && data?.inspectionAircraftPoseStored === "true"
      && data?.inspectionAircraftPoseApplied === "true"
      && data?.aircraftModePoseAuthority === poseAuthority
      && Number.isFinite(Number(data?.aircraftModePoseLiveX))
      && Number.isFinite(Number(data?.aircraftModePoseLiveZ))
      && Number(data?.inspectionAircraftPoseErrorMeters) <= 0.01
    ) || data?.environmentSource === "load-error"
      || data?.terminal4UploadedJetwayLoadState === "load-error";
  }, {
    articulationAuthority: ARTICULATION_AUTHORITY,
    bogieGroundAuthority: JETWAY_BOGIE_GROUND_AUTHORITY,
    poseAuthority: AIRCRAFT_MODE_POSE_AUTHORITY,
  }, { timeout: 120_000, polling: 100 });

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
  expect(runtime.terminal4UploadedJetwayArticulationAuthority).toBe(ARTICULATION_AUTHORITY);
  expect(runtime.terminal4UploadedJetwayBogieGroundContactAuthority).toBe(JETWAY_BOGIE_GROUND_AUTHORITY);
  expect(runtime.aircraftModePoseAuthority).toBe(AIRCRAFT_MODE_POSE_AUTHORITY);

  const freeDrivePose = physicalAircraftPose(runtime);
  expectFinitePose(freeDrivePose);

  // This directly guards the live defect in the user's screenshots: switching
  // out of free-drive must not teleport the aircraft to a second A1 location.
  await page.getByRole("button", { name: "Return to training" }).click();
  await expect(page.getByRole("heading", { name: "Complete visual equipment check" })).toBeVisible();
  await page.waitForFunction((poseAuthority) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionMode === "training"
      && data?.aircraftModePoseAuthority === poseAuthority
      && data?.inspectionAircraftPoseApplied === "true"
      && Number(data?.inspectionAircraftPoseErrorMeters) <= 0.01;
  }, AIRCRAFT_MODE_POSE_AUTHORITY, { timeout: 30_000, polling: 100 });
  const trainingRuntime = await page.evaluate(() => ({ ...document.querySelector("canvas.trainerCanvas").dataset }));
  const trainingPose = physicalAircraftPose(trainingRuntime);
  expectFinitePose(trainingPose);
  expectSamePose(trainingPose, freeDrivePose);

  await page.getByRole("button", { name: "Free-drive inspection" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();
  await page.waitForFunction((poseAuthority) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionMode === "active"
      && data?.aircraftModePoseAuthority === poseAuthority
      && data?.inspectionAircraftPoseApplied === "true"
      && Number(data?.inspectionAircraftPoseErrorMeters) <= 0.01;
  }, AIRCRAFT_MODE_POSE_AUTHORITY, { timeout: 30_000, polling: 100 });
  const returnedRuntime = await page.evaluate(() => ({ ...document.querySelector("canvas.trainerCanvas").dataset }));
  const returnedPose = physicalAircraftPose(returnedRuntime);
  expectFinitePose(returnedPose);
  expectSamePose(returnedPose, freeDrivePose);

  const sourceReach = Number(returnedRuntime.terminal4UploadedJetwaySourceContactDistanceMeters);
  const target = Number(returnedRuntime.terminal4UploadedJetwayA1TargetDoorDistanceMeters);
  const extension = Number(returnedRuntime.terminal4UploadedJetwayA1AttachedExtensionMeters);
  const predictedGap = Number(returnedRuntime.terminal4UploadedJetwayA1PredictedDoorGapMeters);
  const predictedContact = Number(returnedRuntime.terminal4UploadedJetwayA1PredictedContactDistanceMeters);
  const actualContact = Number(returnedRuntime.terminal4UploadedJetwayA1ActualContactDistanceMeters);
  const actualGap = Number(returnedRuntime.terminal4UploadedJetwayA1ActualDoorGapMeters);
  const staticMaximumError = Number(returnedRuntime.terminal4UploadedJetwayStaticMaximumContactErrorMeters);
  const renderedAircraftCabError = Number(returnedRuntime.inspectionAircraftCabContactErrorMeters);
  const renderedAircraftVerticalError = Number(returnedRuntime.inspectionAircraftDoorVerticalErrorMeters);
  const renderedAircraftGroundClearance = Number(returnedRuntime.inspectionAircraftGroundClearanceMeters);
  const renderedDoorTargetX = Number(returnedRuntime.inspectionAircraftDoorTargetX);
  const renderedDoorTargetZ = Number(returnedRuntime.inspectionAircraftDoorTargetZ);
  const measuredCabX = Number(returnedRuntime.inspectionAircraftCabContactX);
  const measuredCabZ = Number(returnedRuntime.inspectionAircraftCabContactZ);
  const inspectionNoseGearX = Number(returnedRuntime.inspectionAircraftNoseGearX);
  const inspectionNoseGearZ = Number(returnedRuntime.inspectionAircraftNoseGearZ);
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
  expect(staticMaximumError).toBeLessThanOrEqual(0.001);
  expect(returnedRuntime.terminal4UploadedJetwayA1PartOrderValid).toBe("true");
  expect(Number.isFinite(renderedAircraftCabError)).toBe(true);
  expect(renderedAircraftCabError).toBeLessThanOrEqual(0.01);

  const articulationSignedDoorVerticalGapMeters = Number(returnedRuntime.inspectionAircraftDoorSignedVerticalGapMeters);
  const articulationRequestedJetwayVerticalFitMeters = Number(returnedRuntime.inspectionAircraftJetwayRequestedVerticalFitMeters);
  const articulationAppliedJetwayVerticalFitMeters = Number(returnedRuntime.inspectionAircraftJetwayVerticalFitMeters);
  expect(Number.isFinite(renderedAircraftVerticalError)).toBe(true);
  expect(Number.isFinite(articulationSignedDoorVerticalGapMeters)).toBe(true);
  expect(Number.isFinite(articulationRequestedJetwayVerticalFitMeters)).toBe(true);
  expect(Number.isFinite(articulationAppliedJetwayVerticalFitMeters)).toBe(true);
  expect(renderedAircraftVerticalError).toBeCloseTo(Math.abs(articulationSignedDoorVerticalGapMeters), 5);
  expect(renderedAircraftVerticalError).toBeLessThanOrEqual(6);
  expect(articulationRequestedJetwayVerticalFitMeters).toBeCloseTo(articulationSignedDoorVerticalGapMeters, 5);
  expect(articulationAppliedJetwayVerticalFitMeters).toBeCloseTo(0, 5);
  expect(returnedRuntime.inspectionAircraftJetwayAuthoredBogieGroundPreserved).toBe("true");
  expect(Math.abs(renderedAircraftGroundClearance)).toBeLessThanOrEqual(0.01);
  expect(returnedRuntime.inspectionAircraftJetwayVerticalFitAuthority).toBe("grounded-jetway-door-gap-reported-no-child-lift-v1");
  expect(Math.hypot(renderedDoorTargetX - measuredCabX, renderedDoorTargetZ - measuredCabZ)).toBeLessThanOrEqual(0.01);
  expect([inspectionNoseGearX, inspectionNoseGearZ].every(Number.isFinite)).toBe(true);

  const centers = JSON.parse(returnedRuntime.terminal4UploadedJetwayA1PartCentersMeters);
  expect(centers.Rotunda).toBeLessThan(centers.Tunnel_A);
  expect(centers.Tunnel_A).toBeLessThan(centers.Tunnel_B);
  expect(centers.Tunnel_B).toBeLessThan(centers.Tunnel_C);
  expect(centers.Tunnel_C).toBeLessThan(centers.Cab);

  await page.addStyleTag({ content: ".rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}" });
  await captureInspectionPreset(page, "a1Connection", "test-results/uploaded-jetway-a1-articulated-v11.png");
  await captureInspectionPreset(page, "a14", "test-results/uploaded-jetway-a-concourse-static-source-rigid-v11.png");
  await captureInspectionPreset(page, "b14", "test-results/uploaded-jetway-b-concourse-static-source-rigid-v11.png");
  await captureInspectionPreset(page, "b15", "test-results/uploaded-jetway-b15-static-source-rigid-v11.png");

  fs.writeFileSync("test-results/uploaded-jetway-a1-articulated-v11.json", `${JSON.stringify({
    authority: returnedRuntime.terminal4UploadedJetwayArticulationAuthority,
    staticRigidAuthority: STATIC_RIGID_AUTHORITY,
    staticSourcePlacementAuthority: STATIC_SOURCE_PLACEMENT_AUTHORITY,
    sourceOnlyCabAuthority: SOURCE_ONLY_CAB_AUTHORITY,
    aircraftModePoseAuthority: returnedRuntime.aircraftModePoseAuthority,
    freeDrivePose,
    trainingPose,
    returnedPose,
    bogieGroundAuthority: returnedRuntime.terminal4UploadedJetwayBogieGroundContactAuthority,
    sourceReach,
    target,
    extension,
    predictedGap,
    actualGap,
    predictedContact,
    actualContact,
    staticMaximumError,
    renderedAircraftCabError,
    renderedDoorTarget: [renderedDoorTargetX, renderedDoorTargetZ],
    measuredCab: [measuredCabX, measuredCabZ],
    inspectionNoseGear: [inspectionNoseGearX, inspectionNoseGearZ],
    verifiedModelCount: Number(returnedRuntime.terminal4UploadedJetwayVerifiedModelCount),
    staticArticulatedGateCount: Number(returnedRuntime.terminal4UploadedJetwayStaticArticulatedGateCount),
    centers,
    evidenceViews: ["a1Connection", "a14", "b14", "b15"],
  }, null, 2)}\n`);
});
