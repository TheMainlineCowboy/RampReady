import fs from "node:fs";
import { expect, test } from "@playwright/test";

const JETWAY_GROUND_AUTHORITY = "exact-authored-a1-lowest-geometry-ramp-contact-v1";
const AIRCRAFT_GROUND_AUTHORITY = "authored-crj-lowest-geometry-contact-clusters-v2";
const VERTICAL_FIT_AUTHORITY = "grounded-aircraft-door-progressive-tunnel-slope-v1";

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
  await page.waitForFunction(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionPreset === "a1Connection"
      && data?.a1JetwayDeployment === "1.000"
      && data?.a1JetwayState === "attached-to-aircraft-door";
  }, null, { timeout: 30_000, polling: 100 });

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

  await page.addStyleTag({
    content: ".rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}",
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await captureCanvas(page, "test-results/a1-measured-ground-contact.png");
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
      evidenceAuthority: "exact-runtime-measured-ground-contact-and-current-head-render",
    }, null, 2)}\n`,
  );
});
