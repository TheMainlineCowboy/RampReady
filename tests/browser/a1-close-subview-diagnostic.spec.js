import fs from "node:fs";
import { expect, test } from "@playwright/test";

const SUBVIEW_AUTHORITY = "exact-a1-terminal-joint-and-bogie-contact-subviews-v2";
const CAMERA_AUTHORITY = "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2";
const LOCK_AUTHORITY = "exact-a1-evidence-camera-direct-lock-v1";

async function snapshot(page, label) {
  const result = await page.evaluate(() => ({
    runtime: { ...document.querySelector("canvas.trainerCanvas")?.dataset },
    hud: document.querySelector(".rr-hud p")?.textContent || "",
  }));
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(
    `test-results/a1-close-subview-${label}.json`,
    `${JSON.stringify(result, null, 2)}\n`,
  );
  return result;
}

async function requireSubview(page, subview) {
  await page.evaluate((nextSubview) => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Three.js canvas is missing");
    canvas.dataset.a1EvidenceSubview = nextSubview;
  }, subview);

  try {
    await page.waitForFunction(({ expectedSubview, subviewAuthority, cameraAuthority, lockAuthority }) => {
      const data = document.querySelector("canvas.trainerCanvas")?.dataset;
      return data?.inspectionCameraEndpointSubview === expectedSubview
        && data?.inspectionCameraEndpointSubviewAuthority === subviewAuthority
        && data?.inspectionCameraEndpointAuthority === cameraAuthority
        && data?.inspectionCameraEndpointLockAuthority === lockAuthority
        && Number.isFinite(Number(data?.inspectionCameraEndpointConvergenceErrorMeters))
        && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;
    }, {
      expectedSubview: subview,
      subviewAuthority: SUBVIEW_AUTHORITY,
      cameraAuthority: CAMERA_AUTHORITY,
      lockAuthority: LOCK_AUTHORITY,
    }, { timeout: 30_000, polling: 100 });
  } catch (error) {
    const failed = await snapshot(page, `${subview}-failed`);
    throw new Error(`${subview} camera transition failed: ${error.message}\n${JSON.stringify(failed, null, 2)}`);
  }
  return snapshot(page, subview);
}

test("A1 close subviews reach exact locked camera telemetry before screenshot capture", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(`console: ${message.text()}`);
  });

  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();
  await page.waitForFunction(() => (
    document.querySelector("canvas.trainerCanvas")?.dataset?.terminal4UploadedJetwayLoadState === "ready"
  ), null, { timeout: 150_000, polling: 100 });

  await page.getByLabel("Inspection location").selectOption("a1Connection");
  await page.waitForFunction(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionPreset === "a1Connection"
      && data?.a1JetwayDeployment === "1.000"
      && data?.a1JetwayState === "attached-to-aircraft-door";
  }, null, { timeout: 30_000, polling: 100 });

  const terminal = await requireSubview(page, "terminal-joint");
  expect(terminal.runtime.inspectionCameraEndpointJointCenter).toBeTruthy();
  expect(Number(terminal.runtime.inspectionCameraEndpointJointApronDistanceMeters)).toBeGreaterThanOrEqual(3.8);
  expect(Number(terminal.runtime.inspectionCameraEndpointJointSideDistanceMeters)).toBeGreaterThanOrEqual(9.4);

  const bogie = await requireSubview(page, "bogie-contact");
  expect(bogie.runtime.inspectionCameraEndpointBogieContactCenter).toBeTruthy();
  expect(bogie.runtime.inspectionCameraEndpointBogieAircraftCenter).toBeTruthy();
  expect(Number(bogie.runtime.inspectionCameraEndpointBogieAircraftOppositionCosine)).toBeLessThan(-0.65);

  await requireSubview(page, "full-assembly");
  fs.writeFileSync(
    "test-results/a1-close-subview-diagnostic.json",
    `${JSON.stringify({ terminal: terminal.runtime, bogie: bogie.runtime, browserErrors }, null, 2)}\n`,
  );
  expect(browserErrors).toEqual([]);
});
