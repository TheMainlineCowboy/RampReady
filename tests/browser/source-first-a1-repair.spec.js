import fs from "node:fs";
import { expect, test } from "@playwright/test";

const UPLOADED_JETWAY_ATTRIBUTES = Object.freeze([
  "data-terminal4-uploaded-jetway-load-state",
  "data-terminal4-uploaded-jetway-count",
  "data-terminal4-uploaded-jetway-connector-count",
  "data-terminal4-uploaded-jetway-verified-model-count",
]);

const DIRECT_A1_TERMINAL_AUTHORITY = "nearest-structural-terminal-facade-photo-verified-v1";
const DIRECT_A1_CAMERA_AUTHORITY = "side-on-direct-terminal-wall-a1-v7";

async function saveCompositedCanvasPng(page, path) {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!canvas) throw new Error("Three.js canvas is missing for evidence capture");
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (box.width < 64 || box.height < 64) throw new Error("Canvas has no usable compositor bounds");
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
          width: Math.min(box.width, 1440 - Math.max(0, box.x)),
          height: Math.min(box.height, 900 - Math.max(0, box.y)),
          scale: 1,
        },
      }),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("Chromium compositor capture exceeded 45 seconds")),
        45_000,
      )),
    ]);
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync(path, Buffer.from(data, "base64"));
    const bytes = fs.statSync(path).size;
    if (bytes < 30_000) throw new Error(`Composited evidence is suspiciously small: ${bytes} bytes`);
  } finally {
    await client.detach();
  }
}

async function readCanvasRuntime(page) {
  return page.evaluate(() => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!canvas) throw new Error("Three.js canvas disappeared");
    return { ...canvas.dataset };
  });
}

async function numericCanvasAttribute(page, name) {
  return Number(await page.evaluate((attribute) => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    return canvas?.getAttribute(attribute) ?? "NaN";
  }, name));
}

test("direct tug inspection proves the visible A1 terminal connection, realistic retraction and physical airport collision protection", async ({ page }) => {
  test.setTimeout(660_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const directInspection = page.getByRole("button", { name: "Drive tug / inspect airport" });
  await expect(directInspection).toBeVisible();
  await directInspection.click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({ attributeNames, expectedAuthority }) => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    const data = canvas?.dataset;
    const uploaded = attributeNames.map((name) => canvas?.getAttribute(name));
    return data?.inspectionMode === "active"
      && data?.environmentSource?.includes("authored-phx-terminal4")
      && uploaded[0] === "ready"
      && uploaded[1] === "58"
      && uploaded[2] === "58"
      && uploaded[3] === "58"
      && data?.terminal4A1ConnectionAuthority === expectedAuthority
      && data?.photoGroundSource === "source-authored-phx-photo"
      && data?.airportCollisionReady === "true"
      && data?.airportCollisionTargetCount === "2";
  }, {
    attributeNames: UPLOADED_JETWAY_ATTRIBUTES,
    expectedAuthority: DIRECT_A1_TERMINAL_AUTHORITY,
  }, { timeout: 180_000, polling: 250 });

  const hudHeight = await page.evaluate(() => document.querySelector(".rr-hud")?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY);
  expect(hudHeight).toBeLessThan(110);

  const runtime = await readCanvasRuntime(page);
  expect(runtime.inspectionMode).toBe("active");
  expect(runtime.environmentSource).toContain("authored-phx-terminal4");
  expect(runtime.terminal4UploadedJetwayLoadState).toBe("ready");
  expect(runtime.terminal4UploadedJetwayCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayConnectorCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayVerifiedModelCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayReadyAuthority).toBe(
    "exact-uploaded-airport-jetway-complete-58-gates-v1",
  );
  expect(runtime.photoGroundSource).toBe("source-authored-phx-photo");
  expect(runtime.groundPavementAuthority).toBe("full-source-aerial-primary-with-subtle-package-surface-detail-v41");
  expect(runtime.groundSourceAerialPriority).toBe("true");
  expect(runtime.groundNearfieldDetailOpacity).toBe("0.18");
  expect(runtime.renderQualityAuthority).toBe("srgb-aces-apron-daylight-dynamic-shadows-v3");
  expect(runtime.shadowMode).toBe("dynamic-high-fidelity");
  expect(runtime.terminal4FacadeInfillCount).toBe("0");

  const terminalWallDistance = Number(runtime.terminal4A1JetwayWallDistance);
  expect(terminalWallDistance).toBeGreaterThan(0.4);
  expect(terminalWallDistance).toBeLessThan(12);
  expect(runtime.terminal4A1ConnectionAuthority).toBe(DIRECT_A1_TERMINAL_AUTHORITY);
  expect(runtime.terminal4A1ConnectionAuthority).not.toMatch(/WALK/i);
  const terminalDirection = runtime.terminal4A1ConnectionDirection.split(",").map(Number);
  expect(terminalDirection).toHaveLength(2);
  expect(Math.abs(Math.hypot(...terminalDirection) - 1)).toBeLessThanOrEqual(0.01);

  expect(Number(runtime.terminal4SourceClosedBayMaterialCount)).toBeGreaterThan(0);
  expect(Number(runtime.terminal4SourceFacadeVariantMaterialCount)).toBeGreaterThanOrEqual(4);
  expect(runtime.airportCollisionAuthority).toBe("terminal-jetway-aircraft-raycast-envelope-v45");
  expect(runtime.airportCollisionReady).toBe("true");
  expect(runtime.airportCollisionTargetCount).toBe("2");
  expect(runtime.airportCollisionAircraftEnvelope).toBe("nose-center-tail-wing-sweep-v2");
  expect(runtime.terminal4A1RetractionAuthority).toBe("aircraft-door-clearance-without-overtravel-v6");
  expect(runtime.terminal4A1RetractionClearanceMeters).toBe("2.38");

  const openCells = Number(runtime.terminal4SourceFacadeOpenCellCount || 0);
  const closedCells = Number(runtime.terminal4SourceFacadeClosedCellCount || 0);
  expect(openCells).toBeGreaterThan(0);
  expect(closedCells).toBeGreaterThan(openCells * 3);

  const inspectionLocation = page.getByLabel("Inspection location");
  await expect(inspectionLocation).toHaveValue("a1");
  await inspectionLocation.selectOption("a1Connection");
  await page.waitForFunction((cameraAuthority) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionPreset === "a1Connection"
      && data?.inspectionPresetLabel === "A1 terminal connection"
      && data?.inspectionCameraAuthority === cameraAuthority;
  }, DIRECT_A1_CAMERA_AUTHORITY, { timeout: 30_000, polling: 100 });
  await page.addStyleTag({
    content: ".rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}",
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await page.waitForTimeout(1_000);
  await saveCompositedCanvasPng(page, "test-results/source-first-a1-terminal-connection.png");

  fs.writeFileSync("test-results/source-first-a1-terminal-connection.json", `${JSON.stringify({
    terminalWallDistance,
    terminalConnectionAuthority: runtime.terminal4A1ConnectionAuthority,
    terminalConnectionDirection: terminalDirection,
    inspectionCameraAuthority: DIRECT_A1_CAMERA_AUTHORITY,
    evidenceAuthority: "user-overhead-and-same-day-a1-ramp-photos",
  }, null, 2)}\n`);

  await page.evaluate(() => {
    const select = document.querySelector('select[aria-label="Inspection location"]');
    if (!(select instanceof HTMLSelectElement)) throw new Error("Inspection location selector is missing");
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error("Native inspection selector setter is unavailable");
    setter.call(select, "b15");
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
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
    await page.waitForFunction((initialCount) => {
      const canvas = document.querySelector("canvas.trainerCanvas");
      return Number(canvas?.getAttribute("data-airport-collision-count") ?? "0") > initialCount;
    }, startCount, { timeout: 120_000, polling: 100 });
  } finally {
    await page.keyboard.up("w");
  }
  await page.waitForTimeout(1_000);

  const stoppedX = await numericCanvasAttribute(page, "data-inspection-tug-x");
  const stoppedState = await page.evaluate(() => document.querySelector("canvas.trainerCanvas")?.dataset.airportCollisionState);
  expect(stoppedX).toBeLessThan(startX - 5);
  expect(stoppedX).toBeGreaterThan(-27.35);
  expect(["blocked", "clear"]).toContain(stoppedState);
  await saveCompositedCanvasPng(page, "test-results/source-first-b15-physical-collision-stop.png");
});
