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

async function captureCanvas(page, canvas, fileName) {
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  const image = await page.screenshot({
    type: "png",
    clip: {
      x: Math.max(0, Math.floor(bounds.x)),
      y: Math.max(0, Math.floor(bounds.y)),
      width: Math.floor(bounds.width),
      height: Math.floor(bounds.height),
    },
    animations: "disabled",
  });
  expect(image.byteLength).toBeGreaterThan(50_000);
  await writeFile(`test-results/${fileName}`, image);
}

const EXPECTED_DATASET = Object.freeze({
  environmentSource: "authored-phx-terminal4-textured",
  groundSource: "authored-kphx-v181",
  photoGroundSource: "source-authored-phx-photo",
  kphxVersion: "1.8.1",
  kphxDetailLevel: "terminal4-authored-textured-v2-exact-a1",
  photoDetailLevel: "full-airport-source-aerial-1.2m-v1",
  photoTileCount: "199",
  photoWidth: "6400",
  photoHeight: "2304",
  photoBytes: "2698886",
  hiddenAdexSurfaceMaterials: "4",
  sourceJetwayCount: "112",
  terminal4JetwayCount: "58",
  terminal4ParkingCount: "58",
  terminal4TextureCount: "17",
  terminal4ExactTextureCount: "13",
  terminal4FallbackTextureCount: "4",
  terminal4TexturedMaterialCount: "19",
  terminal4Position: "-101.593,0.035,70.901",
  terminal4Placement: "decoded original KPHX_ADEX library-object placement relative to decoded original Gate A1",
  b15Anchors: "ready",
  b15CorridorMeters: "515,542",
});

test("loads only source-authored PHX airport scenery at exact Gate A1", async ({ page }) => {
  test.setTimeout(120_000);
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
  await expect.poll(async () => page.evaluate((expected) => {
    const element = document.querySelector("canvas.trainerCanvas");
    if (!element) return { ready: false, values: {} };
    const values = Object.fromEntries(Object.keys(expected).map((key) => [key, element.dataset[key] ?? null]));
    return {
      ready: Object.entries(expected).every(([key, value]) => values[key] === value),
      values,
    };
  }, EXPECTED_DATASET), { timeout: 55_000, intervals: [250, 500, 1_000] }).toMatchObject({ ready: true });

  const generatedDetailState = await canvas.evaluate((element) => ({
    simulatorDetailSource: element.dataset.simulatorDetailSource ?? null,
    simulatorDetailLevel: element.dataset.simulatorDetailLevel ?? null,
    fineDetailMeshes: element.dataset.a1FineDetailMeshes ?? null,
  }));
  expect(generatedDetailState).toEqual({ simulatorDetailSource: null, simulatorDetailLevel: null, fineDetailMeshes: null });

  const nearestGeometryMeters = Number(await canvas.getAttribute("data-terminal4-a1-nearest-geometry-meters"));
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
  await captureCanvas(page, canvas, "kphx-a1-source-authored-chase.png");

  await page.evaluate(() => {
    const element = document.querySelector("canvas.trainerCanvas");
    element?.dispatchEvent(new WheelEvent("wheel", { deltaY: 1350, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(1_000);
  await captureCanvas(page, canvas, "kphx-a1-source-authored-overview.png");
});
