import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const GROUND_SUFFIXES = ["/models/kphx-ground/kphx-ground.gltf", "/models/kphx-ground/kphx-ground.bin"];
const PHOTO_SUFFIXES = [
  "/models/kphx-photo/photo-manifest.json",
  "/models/kphx-photo/phx-airport-photo.webp",
];
const TERMINAL_SUFFIXES = [
  "/models/phx-terminal4/terminal4.gltf",
  "/models/phx-terminal4/terminal4.bin",
  "/models/phx-terminal4/texture-manifest.json",
  "/models/phx-terminal4/textures/BGATE1.png",
  "/models/phx-terminal4/textures/PARKRAMPS.png",
  "/models/phx-terminal4/textures/PARKRAMP1.png",
  "/models/phx-terminal4/textures/RW.png",
];
const SOURCE_ASSETS = [...GROUND_SUFFIXES, ...PHOTO_SUFFIXES, ...TERMINAL_SUFFIXES];

async function launchStandup(page) {
  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  const standup = page.getByRole("radio", { name: /Stand-up pushback/i });
  await standup.click();
  const launch = page.getByRole("button", { name: "Start training" });
  await expect(launch).toBeEnabled();
  await launch.click();
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toBeVisible();
  return canvas;
}

async function captureViewport(page, fileName) {
  const canvasPresent = await page.evaluate(() => Boolean(document.querySelector("canvas.trainerCanvas")));
  expect(canvasPresent).toBe(true);
  const image = await page.screenshot({
    type: "png",
    fullPage: false,
    animations: "disabled",
  });
  expect(image.byteLength).toBeGreaterThan(50_000);
  await writeFile(`test-results/${fileName}`, image);
}

test("loads source-authored PHX scenery with detailed Terminal 4 jetways and simulator pavement", async ({ page }) => {
  test.setTimeout(360_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const assetResponses = [];
  const runtimeErrors = [];
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (SOURCE_ASSETS.some((suffix) => pathname.endsWith(suffix))) assetResponses.push(response);
  });
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const canvas = await launchStandup(page);
  await expect.poll(
    async () => canvas.getAttribute("data-environment-source"),
    { timeout: 90_000, intervals: [500, 1_000, 2_000] },
  ).toBe("authored-phx-terminal4-textured-source-jetways");
  await expect.poll(
    async () => canvas.getAttribute("data-static-ramp-equipment-object-count"),
    { timeout: 90_000, intervals: [500, 1_000, 2_000] },
  ).toBe("31");

  const runtime = await canvas.evaluate((element) => ({ ...element.dataset }));
  expect(runtime.environmentSource).toBe("authored-phx-terminal4-textured-source-jetways");
  expect(runtime.groundSource).toBe("authored-kphx-v181-source-textured");
  expect(runtime.photoGroundSource).toBe("source-authored-phx-photo");
  expect(runtime.kphxVersion).toBe("1.8.1");
  expect(runtime.kphxDetailLevel).toBe("terminal4-authored-textured-v4-source-ramp-exact-a1");
  expect(runtime.photoDetailLevel).toBe("full-airport-source-aerial-1.2m-v1");
  expect(runtime.photoTileCount).toBe("199");
  expect(runtime.photoWidth).toBe("6400");
  expect(runtime.photoHeight).toBe("2304");
  expect(runtime.photoBytes).toBe("2698886");
  expect(runtime.hiddenAdexSurfaceMaterials).toBe("1");
  expect(runtime.sourceJetwayCount).toBe("112");
  expect(runtime.terminal4JetwayCount).toBe("58");
  expect(runtime.terminal4ParkingCount).toBe("58");
  expect(runtime.terminal4TextureCount).toBe("17");
  expect(runtime.terminal4ExactTextureCount).toBe("13");
  expect(runtime.terminal4FallbackTextureCount).toBe("4");
  expect(runtime.terminal4TexturedMaterialCount).toBe("19");
  expect(runtime.terminal4Position).toBe("-101.593,0.035,70.901");
  expect(runtime.terminal4Placement).toBe(
    "decoded original KPHX_ADEX library-object placement relative to decoded original Gate A1",
  );
  expect(runtime.b15Anchors).toBe("ready");
  expect(runtime.b15CorridorMeters).toBe("515,542");
  expect(runtime.staticRampEquipmentObjectCount).toBe("31");
  expect(runtime.simulatorDetailSource).toBeUndefined();
  expect(runtime.a1RampTextureResolution).toBeUndefined();

  const nearestGeometryMeters = Number(runtime.terminal4A1NearestGeometryMeters);
  expect(nearestGeometryMeters).toBeGreaterThan(28);
  expect(nearestGeometryMeters).toBeLessThan(29.2);

  for (const suffix of SOURCE_ASSETS) {
    await expect.poll(
      () => assetResponses.some((response) => new URL(response.url()).pathname.endsWith(suffix) && response.status() === 200),
      { timeout: 30_000 },
    ).toBe(true);
  }

  const entries = await page.evaluate((suffixes) => suffixes.map((suffix) => {
    const entry = performance.getEntriesByType("resource")
      .find((resource) => new URL(resource.name).pathname.endsWith(suffix));
    return entry ? { suffix, decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize } : null;
  }), SOURCE_ASSETS);
  expect(entries.every(Boolean)).toBe(true);
  const bySuffix = Object.fromEntries(entries.map((entry) => [entry.suffix, entry]));
  const measuredSize = (suffix) => Math.max(bySuffix[suffix].decodedBodySize, bySuffix[suffix].transferSize);
  expect(measuredSize("/models/kphx-ground/kphx-ground.bin")).toBeGreaterThan(500_000);
  expect(measuredSize("/models/kphx-photo/phx-airport-photo.webp")).toBeGreaterThan(2_500_000);
  expect(measuredSize("/models/phx-terminal4/terminal4.bin")).toBeGreaterThan(1_000_000);
  expect(measuredSize("/models/phx-terminal4/textures/BGATE1.png")).toBeGreaterThan(10_000);
  expect(measuredSize("/models/phx-terminal4/textures/PARKRAMPS.png")).toBeGreaterThan(1_000);
  expect(measuredSize("/models/phx-terminal4/textures/PARKRAMP1.png")).toBeGreaterThan(1_000);
  expect(measuredSize("/models/phx-terminal4/textures/RW.png")).toBeGreaterThan(1_000);

  const relevantErrors = runtimeErrors.filter((message) =>
    /KPHX ground load failed|PHX airport ground failed to load|PHX source aerial load failed|source aerial failed to load|Terminal 4 visual load failed|material texture is missing|GLTFLoader|WebGL.*shader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);

  await page.addStyleTag({
    content: `
      .rr-hud, .rr-metrics, .rr-score-float, .rr-guidance, .rr-diagnostics,
      .rr-steer, .rr-throttle { display: none !important; }
      .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
    `,
  });
  await page.waitForTimeout(1_200);
  await captureViewport(page, "kphx-a1-source-textured-ramp-jetways-chase.png");

  await page.evaluate(() => {
    const element = document.querySelector("canvas.trainerCanvas");
    element?.dispatchEvent(new WheelEvent("wheel", { deltaY: 1350, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(1_000);
  await captureViewport(page, "kphx-a1-source-textured-ramp-jetways-overview.png");
});
