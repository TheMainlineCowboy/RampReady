import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const GROUND_SUFFIXES = ["/models/kphx-ground/kphx-ground.gltf", "/models/kphx-ground/kphx-ground.bin"];
const TERMINAL_SUFFIXES = [
  "/models/phx-terminal4/terminal4.gltf",
  "/models/phx-terminal4/terminal4.bin",
  "/models/phx-terminal4/texture-manifest.json",
  "/models/phx-terminal4/textures/BGATE1.png",
];

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

async function expectRuntimeValue(canvas, attribute, expected) {
  await expect.poll(
    async () => canvas.getAttribute(attribute),
    { timeout: 30_000, intervals: [250, 500, 1_000] },
  ).toBe(expected);
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
  expect(image.byteLength).toBeGreaterThan(20_000);
  await writeFile(`test-results/${fileName}`, image);
}

test("loads the source-authored textured PHX Terminal 4 at the exact decoded Gate A1 placement", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const assetResponses = [];
  const runtimeErrors = [];
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if ([...GROUND_SUFFIXES, ...TERMINAL_SUFFIXES].some((suffix) => pathname.endsWith(suffix))) assetResponses.push(response);
  });
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const canvas = await launchStandup(page);
  await expectRuntimeValue(canvas, "data-environment-source", "authored-phx-terminal4-textured");
  await expectRuntimeValue(canvas, "data-ground-source", "authored-kphx-v181");
  await expectRuntimeValue(canvas, "data-kphx-version", "1.8.1");
  await expectRuntimeValue(canvas, "data-kphx-detail-level", "terminal4-authored-textured-v2-exact-a1");
  await expectRuntimeValue(canvas, "data-source-jetway-count", "112");
  await expectRuntimeValue(canvas, "data-terminal4-jetway-count", "58");
  await expectRuntimeValue(canvas, "data-terminal4-parking-count", "58");
  await expectRuntimeValue(canvas, "data-terminal4-texture-count", "17");
  await expectRuntimeValue(canvas, "data-terminal4-exact-texture-count", "13");
  await expectRuntimeValue(canvas, "data-terminal4-fallback-texture-count", "4");
  await expectRuntimeValue(canvas, "data-terminal4-textured-material-count", "19");
  await expectRuntimeValue(canvas, "data-terminal4-position", "-101.593,0.035,70.901");
  await expectRuntimeValue(
    canvas,
    "data-terminal4-placement",
    "decoded original KPHX_ADEX library-object placement relative to decoded original Gate A1",
  );
  await expectRuntimeValue(canvas, "data-b15-anchors", "ready");
  await expectRuntimeValue(canvas, "data-b15-corridor-meters", "515,542");

  const nearestGeometryMeters = Number(await canvas.getAttribute("data-terminal4-a1-nearest-geometry-meters"));
  expect(nearestGeometryMeters).toBeGreaterThan(28);
  expect(nearestGeometryMeters).toBeLessThan(29.2);

  for (const suffix of [...GROUND_SUFFIXES, ...TERMINAL_SUFFIXES]) {
    await expect.poll(
      () => assetResponses.some((response) => new URL(response.url()).pathname.endsWith(suffix) && response.status() === 200),
      { timeout: 20_000 },
    ).toBe(true);
  }

  const entries = await page.evaluate((suffixes) => suffixes.map((suffix) => {
    const entry = performance.getEntriesByType("resource")
      .find((resource) => new URL(resource.name).pathname.endsWith(suffix));
    return entry ? { suffix, decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize } : null;
  }), [...GROUND_SUFFIXES, ...TERMINAL_SUFFIXES]);
  expect(entries.every(Boolean)).toBe(true);
  expect(Math.max(entries[1].decodedBodySize, entries[1].transferSize)).toBeGreaterThan(500_000);
  expect(Math.max(entries[3].decodedBodySize, entries[3].transferSize)).toBeGreaterThan(1_000_000);
  expect(Math.max(entries[5].decodedBodySize, entries[5].transferSize)).toBeGreaterThan(10_000);

  const relevantErrors = runtimeErrors.filter((message) =>
    /KPHX ground load failed|PHX airport ground failed to load|Terminal 4 visual load failed|material texture is missing|GLTFLoader|WebGL.*shader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);

  await page.addStyleTag({
    content: `
      .rr-hud, .rr-metrics, .rr-score-float, .rr-guidance, .rr-diagnostics,
      .rr-steer, .rr-throttle { display: none !important; }
      .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
    `,
  });
  await page.waitForTimeout(500);
  await captureCanvas(page, canvas, "kphx-a1-exact-chase.png");

  await page.evaluate(() => {
    const element = document.querySelector("canvas.trainerCanvas");
    element?.dispatchEvent(new WheelEvent("wheel", { deltaY: 1350, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(900);
  await captureCanvas(page, canvas, "kphx-a1-exact-overview.png");
});
