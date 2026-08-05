import fs from "node:fs";
import { expect, test } from "@playwright/test";

const DIRECT_A1_TERMINAL_AUTHORITY = "nearest-structural-terminal-facade-photo-verified-v1";
const DIRECT_A1_CAMERA_AUTHORITY = "oblique-measured-terminal-corner-a1-v8";
const AIRCRAFT_AUTHORITY = "terminal-relocated-a1-exact-cab-registration-v1";
const PHOTO_REGISTERED_NOSE_GEAR = Object.freeze({ x: 12.353412, z: -12.486888 });

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

test("source-first A1 evidence proves the exact terminal-to-aircraft chain and physical inspection mode", async ({ page }) => {
  test.setTimeout(780_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({ terminalAuthority, aircraftAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionMode === "active"
      && data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayCount === "58"
      && data?.terminal4UploadedJetwayConnectorCount === "58"
      && data?.terminal4UploadedJetwayVerifiedModelCount === "58"
      && data?.terminal4A1ConnectionAuthority === terminalAuthority
      && data?.inspectionAircraftPoseAuthority === aircraftAuthority
      && Number.isFinite(Number(data?.inspectionAircraftExactParentRelocationX))
      && Number.isFinite(Number(data?.inspectionAircraftExactParentRelocationZ))
      && data?.airportCollisionReady === "true";
  }, {
    terminalAuthority: DIRECT_A1_TERMINAL_AUTHORITY,
    aircraftAuthority: AIRCRAFT_AUTHORITY,
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
  expect(Number(runtime.terminal4A1JetwayWallDistance)).toBeGreaterThan(1.5);
  expect(Number(runtime.terminal4A1JetwayWallDistance)).toBeLessThan(4.1);
  expect(runtime.terminal4A1RetractionAuthority).toBe("aircraft-door-clearance-without-overtravel-v6");
  expect(runtime.terminal4A1RetractionClearanceMeters).toBe("2.38");

  const direction = runtime.terminal4A1ConnectionDirection.split(",").map(Number);
  expect(direction).toHaveLength(2);
  expect(Math.abs(Math.hypot(...direction) - 1)).toBeLessThanOrEqual(0.01);

  const totalX = Number(runtime.inspectionAircraftExactParentRelocationX);
  const totalZ = Number(runtime.inspectionAircraftExactParentRelocationZ);
  expect(Number.isFinite(totalX) && Number.isFinite(totalZ)).toBe(true);
  expect(Math.hypot(totalX, totalZ)).toBeGreaterThan(1);
  expect(Number(runtime.inspectionAircraftNoseGearX)).toBeCloseTo(
    PHOTO_REGISTERED_NOSE_GEAR.x + totalX,
    3,
  );
  expect(Number(runtime.inspectionAircraftNoseGearZ)).toBeCloseTo(
    PHOTO_REGISTERED_NOSE_GEAR.z + totalZ,
    3,
  );
  expect(runtime.inspectionAircraftPoseAuthority).toBe(AIRCRAFT_AUTHORITY);

  const inspectionLocation = page.getByLabel("Inspection location");
  await inspectionLocation.selectOption("a1Connection");
  await page.waitForFunction((authority) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionPreset === "a1Connection"
      && data?.inspectionCameraAuthority === authority;
  }, DIRECT_A1_CAMERA_AUTHORITY, { timeout: 30_000, polling: 100 });
  await page.addStyleTag({
    content: ".rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}",
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await captureCanvas(page, "test-results/source-first-a1-terminal-connection.png");

  fs.writeFileSync("test-results/source-first-a1-terminal-connection.json", `${JSON.stringify({
    terminalWallDistance: Number(runtime.terminal4A1JetwayWallDistance),
    terminalConnectionAuthority: runtime.terminal4A1ConnectionAuthority,
    terminalConnectionDirection: direction,
    inspectionCameraAuthority: DIRECT_A1_CAMERA_AUTHORITY,
    inspectionAircraftPoseAuthority: runtime.inspectionAircraftPoseAuthority,
    inspectionAircraftNoseGear: [
      Number(runtime.inspectionAircraftNoseGearX),
      Number(runtime.inspectionAircraftNoseGearZ),
    ],
    inspectionAircraftExactParentRelocation: [totalX, totalZ],
    inspectionAircraftWallRelocation: [
      Number(runtime.inspectionAircraftWallRelocationX),
      Number(runtime.inspectionAircraftWallRelocationZ),
    ],
    evidenceAuthority: "user-overhead-and-same-day-a1-ramp-photos",
  }, null, 2)}\n`);

  // Keep the physical free-drive proof, but do not spend another compositor
  // capture after the focused A1 evidence is safely written.
  await inspectionLocation.selectOption("b15");
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
