import fs from "node:fs";
import { expect, test } from "@playwright/test";

const VISUAL_AUTHORITY = "same-day-a1-continuous-compact-solid-closed-grounded-v1";
const BOGIE_GROUND_AUTHORITY = "exact-authored-a1-lowest-geometry-ramp-contact-v2";
const NO_LIFT_AUTHORITY = "grounded-jetway-door-gap-reported-no-child-lift-v1";
const POSE_AUTHORITY = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2";
const HEADING_AUTHORITY = "source-a1-parking-heading-authored-door-registration-v2";
const SOURCE_YAW = (0.491 * Math.PI) / 180;
const EVIDENCE_DIR = "retained-evidence";

function evaluateConditions(data) {
  const wallAuthority = String(data?.terminal4A1ConnectionAuthority || "");
  const centerToWallDistance = Number(data?.terminal4A1JetwayWallDistance);
  const visibleVestibuleLength = Number(data?.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters);
  const yaw = Number(data?.inspectionAircraftYaw);
  return {
    loadReady: data?.terminal4UploadedJetwayLoadState === "ready",
    poseStored: data?.inspectionAircraftPoseStored === "true",
    poseApplied: data?.inspectionAircraftPoseApplied === "true",
    poseAuthority: data?.inspectionAircraftPoseAuthority === POSE_AUTHORITY,
    poseError: Number(data?.inspectionAircraftPoseErrorMeters) <= 0.01,
    headingAuthority: data?.inspectionAircraftHeadingAuthority === HEADING_AUTHORITY,
    headingYawFinite: Number.isFinite(yaw),
    headingYawSource: Number.isFinite(yaw) && Math.abs(yaw - SOURCE_YAW) <= 0.001,
    sourceParkingHeading: Math.abs(Number(data?.inspectionAircraftSourceParkingHeadingDegrees) - 270.491) <= 0.01,
    sourceModelYaw: Math.abs(Number(data?.inspectionAircraftSourceModelYawDegrees) - 0.491) <= 0.01,
    wallDistanceLow: centerToWallDistance > 2.9,
    wallDistanceHigh: centerToWallDistance < 5.8,
    vestibuleExact: Math.abs(visibleVestibuleLength - 2.4) <= 0.05,
    wallAuthorityReal: !/WALK|JETWAY|CONNECTOR|PORTAL/i.test(wallAuthority),
    visualAuthority: data?.terminal4UploadedJetwayA1VisualAcceptanceAuthority === VISUAL_AUTHORITY,
    assemblyParts: data?.terminal4UploadedJetwayA1AssemblyPartCount === "5",
    isolatedRotations: data?.terminal4UploadedJetwayA1IsolatedNodeRotationCount === "0",
    rotundaClosed: data?.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed === "true",
    noGeneratedCorridor: data?.terminal4UploadedJetwayA1NoGeneratedGlassCorridor === "true",
    bogieAuthority: data?.terminal4UploadedJetwayBogieGroundContactAuthority === BOGIE_GROUND_AUTHORITY,
    bogieClearance: Math.abs(Number(data?.terminal4UploadedJetwayBogieGroundClearanceMeters)) <= 0.005,
    bogiePoints: Number(data?.terminal4UploadedJetwayBogieGroundContactPointCount) >= 8,
    bogieClusters: Number(data?.terminal4UploadedJetwayBogieGroundContactClusterCount) >= 2,
    bogieSpan: Number(data?.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters) >= 1.2,
    bogieCenterFinite: [
      data?.terminal4UploadedJetwayBogieGroundContactCenterX,
      data?.terminal4UploadedJetwayBogieGroundContactCenterY,
      data?.terminal4UploadedJetwayBogieGroundContactCenterZ,
    ].every((value) => Number.isFinite(Number(value))),
    noLiftAuthority: data?.inspectionAircraftJetwayVerticalFitAuthority === NO_LIFT_AUTHORITY,
    zeroAppliedLift: Math.abs(Number(data?.inspectionAircraftJetwayVerticalFitMeters)) <= 0.001,
    bogieGroundPreserved: data?.inspectionAircraftJetwayAuthoredBogieGroundPreserved === "true",
    signedGapFinite: Number.isFinite(Number(data?.inspectionAircraftDoorSignedVerticalGapMeters)),
    requestedFitFinite: Number.isFinite(Number(data?.inspectionAircraftJetwayRequestedVerticalFitMeters)),
  };
}

test("A1 close readiness is fully satisfied before visual capture", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.terminal4UploadedJetwayLoadState === "ready"
      || data?.terminal4UploadedJetwayLoadState === "load-error"
      || data?.environmentSource === "load-error";
  }, null, { timeout: 180_000, polling: 100 });
  await page.waitForTimeout(2_000);

  const snapshot = await page.evaluate(() => ({
    runtime: { ...document.querySelector("canvas.trainerCanvas")?.dataset },
    hud: document.querySelector(".rr-hud p")?.textContent || "",
  }));
  const conditions = evaluateConditions(snapshot.runtime);
  const failedConditions = Object.entries(conditions)
    .filter(([, passed]) => !passed)
    .map(([name]) => name);
  const diagnostic = {
    conditions,
    failedConditions,
    browserErrors,
    hud: snapshot.hud,
    runtime: snapshot.runtime,
  };
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
  fs.writeFileSync(
    `${EVIDENCE_DIR}/a1-close-readiness-diagnostic.json`,
    `${JSON.stringify(diagnostic, null, 2)}\n`,
  );

  if (failedConditions.length || browserErrors.length) {
    throw new Error(`A1 close readiness failed: ${JSON.stringify({ failedConditions, browserErrors, hud: snapshot.hud, runtime: snapshot.runtime }, null, 2)}`);
  }
});
