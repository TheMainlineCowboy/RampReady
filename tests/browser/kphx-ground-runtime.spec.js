import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const GROUND_SUFFIXES = ["/models/kphx-ground/kphx-ground.gltf", "/models/kphx-ground/kphx-ground.bin"];
const PHOTO_SUFFIXES = ["/models/kphx-photo/photo-manifest.json"];
const TERMINAL_SUFFIXES = [
  "/models/phx-terminal4/terminal4.gltf",
  "/models/phx-terminal4/terminal4.bin",
  "/models/phx-terminal4/texture-manifest.json",
  "/models/phx-terminal4/textures/BGATE1.png",
  "/models/phx-terminal4/textures/PARKRAMPS.png",
  "/models/phx-terminal4/textures/PARKRAMP1.png",
  "/models/phx-terminal4/textures/PHX_TERM400_0.png",
  "/models/phx-terminal4/textures/PHX_TERM400_1.png",
  "/models/phx-terminal4/textures/RW.png",
  "/models/phx-terminal4/textures/M1DGJETWAY.png",
  "/models/phx-terminal4/textures/M1DGJETWAY_LM.png",
];
const SOURCE_ASSETS = [...GROUND_SUFFIXES, ...PHOTO_SUFFIXES, ...TERMINAL_SUFFIXES];

async function launchStandup(page) {
  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  await page.getByRole("radio", { name: /Stand-up pushback/i }).click();
  const launch = page.getByRole("button", { name: "Start training" });
  await expect(launch).toBeEnabled();
  await launch.click();
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toBeVisible();
  return canvas;
}

async function getCanvasBounds(canvas) {
  return canvas.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  });
}

async function captureCompositedPng(page, clip, minimumBytes) {
  const client = await page.context().newCDPSession(page);
  try {
    const capture = client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
      clip: {
        x: Math.max(0, clip.x),
        y: Math.max(0, clip.y),
        width: Math.max(1, Math.min(clip.width, 1440 - Math.max(0, clip.x))),
        height: Math.max(1, Math.min(clip.height, 900 - Math.max(0, clip.y))),
        scale: 1,
      },
    });
    const timeout = new Promise((_, reject) => setTimeout(
      () => reject(new Error("Chromium compositor capture exceeded 30 seconds")),
      30_000,
    ));
    const { data } = await Promise.race([capture, timeout]);
    const image = Buffer.from(data, "base64");
    expect(image.byteLength).toBeGreaterThan(minimumBytes);
    return image;
  } finally {
    await client.detach();
  }
}

async function captureCanvas(page, canvas, fileName) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const bounds = await getCanvasBounds(canvas);
  expect(bounds.width).toBeGreaterThan(64);
  expect(bounds.height).toBeGreaterThan(64);
  const image = await captureCompositedPng(page, bounds, 50_000);
  await writeFile(`test-results/${fileName}`, image);
}

async function captureCanvasRegion(page, canvas, fileName, region) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const bounds = await getCanvasBounds(canvas);
  expect(bounds.width).toBeGreaterThan(64);
  expect(bounds.height).toBeGreaterThan(64);
  const image = await captureCompositedPng(page, {
    x: bounds.x + bounds.width * region.left,
    y: bounds.y + bounds.height * region.top,
    width: bounds.width * region.width,
    height: bounds.height * region.height,
  }, 20_000);
  await writeFile(`test-results/${fileName}`, image);
}

async function frameA1Chase(page, canvas) {
  await page.evaluate(() => {
    const liveCanvas = document.querySelector("canvas.trainerCanvas");
    if (!liveCanvas) throw new Error("Three.js canvas is missing for PHX evidence framing");
    liveCanvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 1600, bubbles: true, cancelable: true }));
    const box = liveCanvas.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const held = { bubbles: true, cancelable: true, pointerId: 81, pointerType: "mouse", button: 0, buttons: 1 };
    liveCanvas.dispatchEvent(new PointerEvent("pointerdown", { ...held, clientX: x, clientY: y }));
    window.dispatchEvent(new PointerEvent("pointermove", { ...held, clientX: x + 180, clientY: y - 25 }));
    window.dispatchEvent(new PointerEvent("pointerup", { ...held, clientX: x + 180, clientY: y - 25, buttons: 0 }));
  });
  await page.waitForTimeout(1_000);
  await page.addStyleTag({
    content: `
      .rr-hud, .rr-metrics, .rr-score-float, .rr-guidance, .rr-diagnostics,
      .rr-steer, .rr-throttle { display: none !important; }
      .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
    `,
  });
  await page.waitForTimeout(1_200);
  await expect(canvas).toBeVisible();
}

test("loads source-correct PHX scenery with the complete uploaded Terminal 4 jetway fleet and pavement-coincident markings", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const assetResponses = [];
  const tileResponses = new Map();
  const runtimeErrors = [];
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (SOURCE_ASSETS.some((suffix) => pathname.endsWith(suffix))) assetResponses.push(response);
    if (pathname.includes("/models/kphx-photo/tiles/")) tileResponses.set(pathname, response);
  });
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const canvas = await launchStandup(page);
  await expect.poll(
    async () => canvas.getAttribute("data-environment-source"),
    { timeout: 120_000, intervals: [500, 1_000, 2_000] },
  ).toBe("authored-phx-terminal4-textured-source-jetways");
  await expect.poll(
    async () => canvas.getAttribute("data-terminal4-uploaded-jetway-load-state"),
    { timeout: 120_000, intervals: [500, 1_000] },
  ).toBe("ready");
  await expect.poll(
    async () => canvas.getAttribute("data-terminal4-a1-jetway-wall-distance"),
    { timeout: 30_000, intervals: [500, 1_000] },
  ).not.toBe("loading");
  await expect.poll(
    async () => canvas.getAttribute("data-terminal4-a1-legacy-block-removed-triangles"),
    { timeout: 30_000, intervals: [500, 1_000] },
  ).toBe("36");

  const runtime = await canvas.evaluate((element) => ({ ...element.dataset }));
  expect(runtime.environmentSource).toBe("authored-phx-terminal4-textured-source-jetways");
  expect(runtime.groundSource).toBe("authored-kphx-v181-source-textured-nearfield");
  expect(runtime.photoGroundSource).toBe("source-authored-phx-photo");
  expect(runtime.kphxVersion).toBe("1.8.1");
  expect(runtime.kphxDetailLevel).toBe("terminal4-authored-pavement-v5-source-ramp-stand-markings");
  expect(runtime.photoDetailLevel).toBe("full-airport-source-aerial-tiled-1.2m-v2");
  expect(runtime.photoTextureMode).toBe("tiled-native-source-resolution-v2");
  expect(runtime.photoRuntimeTileCount).toBe("21");
  expect(runtime.photoMaxTextureDimension).toBe("1024");
  expect(runtime.photoTileCount).toBe("199");
  expect(runtime.photoWidth).toBe("6400");
  expect(runtime.photoHeight).toBe("2304");
  expect(runtime.photoBytes).toBe("2698886");
  expect(runtime.hiddenAdexSurfaceMaterials).toBe("1");
  expect(runtime.sourceJetwayCount).toBe("112");
  expect(runtime.terminal4JetwayCount).toBe("58");
  expect(runtime.terminal4ParkingCount).toBe("58");
  expect(runtime.terminal4TextureCount).toBe("17");
  expect(runtime.terminal4ExactTextureCount).toBe("17");
  expect(runtime.terminal4A1LegacyBlockRemovedTriangles).toBe("36");
  expect(runtime.terminal4A1LegacyBlockAuthority).toBe("surgical-exact-three-box-36-triangle-authored-removal-v3");
  expect(runtime.terminal4FallbackTextureCount).toBe("0");
  expect(runtime.terminal4TexturedMaterialCount).toBe("22");
  expect(runtime.terminal4Position).toBe("-101.593,0.035,70.901");
  expect(runtime.terminal4Placement).toBe(
    "decoded original KPHX_ADEX library-object placement relative to decoded original Gate A1",
  );
  expect(runtime.groundMarkingContactMode).toBe("pavement-coincident-decals");
  expect(runtime.b15Anchors).toBe("ready");
  expect(runtime.b15CorridorMeters).toBe("515,542");
  expect(runtime.terminal4UploadedJetwayLoadState).toBe("ready");
  expect(runtime.terminal4UploadedJetwayCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayConnectorCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayVerifiedModelCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayReadyAuthority).toBe("uploaded-airport-jetway-fleet-complete-58-gates-v4-source-textured");

  const nearestGeometryMeters = Number(runtime.terminal4A1NearestGeometryMeters);
  expect(nearestGeometryMeters).toBeGreaterThan(29.9);
  expect(nearestGeometryMeters).toBeLessThan(30.6);
  const a1WallDistance = Number(runtime.terminal4A1JetwayWallDistance);
  expect(a1WallDistance).toBeGreaterThan(9.1);
  expect(a1WallDistance).toBeLessThan(9.2);
  expect(Number(runtime.terminal4TerminalConnectedJetwayCount)).toBeGreaterThan(0);
  expect(Number(runtime.terminal4SourceCutoutMaterialCount)).toBeGreaterThan(0);
  expect(Number(runtime.terminal4FacadeInfillCount)).toBe(0);
  expect(Number(runtime.terminal4OpenServiceBayCount)).toBe(0);
  expect(Number(runtime.terminal4LowerFacadeFitCount)).toBeGreaterThan(0);
  expect(runtime.terminal4ExactJetwayTextureActive).toBe("true");
  expect(runtime.terminal4JetwayTextureAuthority).toContain("M1DGJETWAY exact recovered");
  expect(runtime.terminal4JetwayDetailLevel).toBe("fsx-air-jetway01-exact-textured-source-scale-articulated-v5");
  expect(runtime.terminal4JetwaySourceScaleAuthority).toBe(
    "airport-authored-AIR_Jetway01-scale-preserved-no-aircraft-specific-shrink",
  );
  expect(runtime.terminal4JetwaySourceGeometryMode).toBe("user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v2-source-textured");
  expect(runtime.terminal4RequiresOriginalJetwayMesh).toBe("false");
  expect(runtime.terminal4JetwayInitialState).toBe("attached-to-aircraft-door");
  expect(runtime.terminal4JetwayPrePushSequence).toBe("retract-bellows-clear-door-telescope-in-rotate-to-park");

  for (const suffix of SOURCE_ASSETS) {
    await expect.poll(
      () => assetResponses.some((response) => new URL(response.url()).pathname.endsWith(suffix) && response.status() === 200),
      { timeout: 30_000 },
    ).toBe(true);
  }
  await expect.poll(() => tileResponses.size, { timeout: 30_000 }).toBe(21);
  expect([...tileResponses.values()].every((response) => response.status() === 200)).toBe(true);

  const entries = await page.evaluate((suffixes) => suffixes.map((suffix) => {
    const entry = performance.getEntriesByType("resource")
      .find((resource) => new URL(resource.name).pathname.endsWith(suffix));
    return entry ? { suffix, decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize } : null;
  }), SOURCE_ASSETS);
  expect(entries.every(Boolean)).toBe(true);
  const bySuffix = Object.fromEntries(entries.map((entry) => [entry.suffix, entry]));
  const measuredSize = (suffix) => Math.max(bySuffix[suffix].decodedBodySize, bySuffix[suffix].transferSize);
  expect(measuredSize("/models/kphx-ground/kphx-ground.bin")).toBeGreaterThan(500_000);
  expect(measuredSize("/models/phx-terminal4/terminal4.bin")).toBeGreaterThan(1_000_000);
  expect(measuredSize("/models/phx-terminal4/textures/BGATE1.png")).toBeGreaterThan(10_000);
  expect(measuredSize("/models/phx-terminal4/textures/PHX_TERM400_0.png")).toBeGreaterThan(10_000);
  expect(measuredSize("/models/phx-terminal4/textures/PHX_TERM400_1.png")).toBeGreaterThan(10_000);

  const relevantErrors = runtimeErrors.filter((message) =>
    /KPHX ground load failed|PHX airport ground failed to load|PHX source aerial failed to load|source aerial failed to load|Terminal 4 visual load failed|material texture is missing|GLTFLoader|WebGL.*shader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);

  await frameA1Chase(page, canvas);
  await captureCanvas(page, canvas, "kphx-a1-uploaded-jetway-chase.png");
  await captureCanvasRegion(page, canvas, "kphx-a1-terminal-connection-close.png", {
    left: 0,
    top: 0.13,
    width: 0.5,
    height: 0.72,
  });

  await page.evaluate(() => {
    const select = document.querySelector("select.rr-view-select");
    if (!select) throw new Error("Camera view selector is missing");
    select.value = "overhead";
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForTimeout(1_200);
  await captureCanvas(page, canvas, "kphx-a1-uploaded-jetway-overhead.png");
});
