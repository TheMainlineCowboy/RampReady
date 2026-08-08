import fs from "node:fs";
import { expect, test } from "@playwright/test";

const MODE_POSE_AUTHORITY = "a1-single-aircraft-pose-training-and-free-drive-v1";
const MAXIMUM_POSE_DELTA = 1e-5;
const MAXIMUM_DOOR_GAP_METERS = 0.05;

async function waitForMode(page, mode) {
  await page.waitForFunction(({ expectedMode, authority, maximumDoorGap }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    const values = [
      Number(data?.aircraftModePoseLiveX),
      Number(data?.aircraftModePoseLiveY),
      Number(data?.aircraftModePoseLiveZ),
      Number(data?.aircraftModePoseLiveYaw),
      Number(data?.terminal4UploadedJetwayA1ActualDoorGapMeters),
    ];
    return data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayVerifiedModelCount === "58"
      && data?.inspectionMode === expectedMode
      && data?.aircraftModePoseAuthority === authority
      && values.every(Number.isFinite)
      && Math.abs(values[4]) <= maximumDoorGap;
  }, {
    expectedMode: mode,
    authority: MODE_POSE_AUTHORITY,
    maximumDoorGap: MAXIMUM_DOOR_GAP_METERS,
  }, { timeout: 300_000, polling: 100 });
}

async function readPose(page) {
  return page.evaluate(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    if (!data) throw new Error("RampReady trainer canvas dataset is missing");
    return {
      mode: data.inspectionMode,
      authority: data.aircraftModePoseAuthority,
      x: Number(data.aircraftModePoseLiveX),
      y: Number(data.aircraftModePoseLiveY),
      z: Number(data.aircraftModePoseLiveZ),
      yaw: Number(data.aircraftModePoseLiveYaw),
      noseGearX: Number(data.inspectionAircraftNoseGearX),
      noseGearZ: Number(data.inspectionAircraftNoseGearZ),
      doorGapMeters: Number(data.terminal4UploadedJetwayA1ActualDoorGapMeters),
      jetwayState: data.a1JetwayState,
      jetwayDeployment: Number(data.a1JetwayDeployment),
    };
  });
}

function expectSamePose(reference, actual, label) {
  for (const key of ["x", "y", "z", "yaw"]) {
    expect(Number.isFinite(reference[key]), `${label} reference ${key}`).toBe(true);
    expect(Number.isFinite(actual[key]), `${label} actual ${key}`).toBe(true);
    expect(Math.abs(actual[key] - reference[key]), `${label} ${key} changed`).toBeLessThanOrEqual(MAXIMUM_POSE_DELTA);
  }
  expect(actual.authority, `${label} pose authority`).toBe(MODE_POSE_AUTHORITY);
  expect(Math.abs(actual.doorGapMeters), `${label} A1 door gap`).toBeLessThanOrEqual(MAXIMUM_DOOR_GAP_METERS);
}

test("A1 aircraft stays physically fixed when switching free-drive and training", async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();
  await waitForMode(page, "active");
  const freeDriveBefore = await readPose(page);
  expect(freeDriveBefore.jetwayDeployment).toBeGreaterThanOrEqual(0.995);
  expect(freeDriveBefore.jetwayState).toBe("attached-to-aircraft-door");

  await page.getByRole("button", { name: "Return to training" }).click();
  await waitForMode(page, "training");
  const training = await readPose(page);
  expectSamePose(freeDriveBefore, training, "free-drive -> training");

  await page.getByRole("button", { name: "Free-drive inspection" }).click();
  await waitForMode(page, "active");
  const freeDriveAfter = await readPose(page);
  expectSamePose(freeDriveBefore, freeDriveAfter, "training -> free-drive");

  if ([freeDriveBefore.noseGearX, freeDriveBefore.noseGearZ, training.noseGearX, training.noseGearZ, freeDriveAfter.noseGearX, freeDriveAfter.noseGearZ].every(Number.isFinite)) {
    expect(Math.abs(training.noseGearX - freeDriveBefore.noseGearX)).toBeLessThanOrEqual(MAXIMUM_POSE_DELTA);
    expect(Math.abs(training.noseGearZ - freeDriveBefore.noseGearZ)).toBeLessThanOrEqual(MAXIMUM_POSE_DELTA);
    expect(Math.abs(freeDriveAfter.noseGearX - freeDriveBefore.noseGearX)).toBeLessThanOrEqual(MAXIMUM_POSE_DELTA);
    expect(Math.abs(freeDriveAfter.noseGearZ - freeDriveBefore.noseGearZ)).toBeLessThanOrEqual(MAXIMUM_POSE_DELTA);
  }

  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(
    "test-results/a1-mode-pose-regression.json",
    `${JSON.stringify({
      maximumPoseDelta: MAXIMUM_POSE_DELTA,
      maximumDoorGapMeters: MAXIMUM_DOOR_GAP_METERS,
      freeDriveBefore,
      training,
      freeDriveAfter,
    }, null, 2)}\n`,
  );
});
