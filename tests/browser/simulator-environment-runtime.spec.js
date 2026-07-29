import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const POPULATION_ASSET_SUFFIXES = [
  "/models/kphx-source-objects/source-object-manifest.json",
  "/models/kphx-source-objects/backhoe/terminal4.gltf",
  "/models/kphx-source-objects/constrailer/terminal4.gltf",
  "/models/kphx-source-objects/phxprkgrg/terminal4.gltf",
  "/models/kphx-source-objects/phxtermlink/terminal4.gltf",
  "/models/kphx-source-objects/wncater/terminal4.gltf",
  "/models/kphx-source-objects/textures/BACKHOE.png",
  "/models/kphx-source-objects/textures/TRAILER.png",
  "/models/standup-tug.glb",
];

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

test("populates source-decoded Terminal 4 with simulator rendering, aircraft, ramp equipment and textured objects", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const runtimeErrors = [];
  const assetResponses = new Map();
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    const suffix = POPULATION_ASSET_SUFFIXES.find((candidate) => pathname.endsWith(candidate));
    if (suffix) assetResponses.set(suffix, response.status());
  });
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const canvas = await launchStandup(page);
  await expect.poll(
    async () => canvas.getAttribute("data-static-aircraft-count"),
    { timeout: 120_000, intervals: [500, 1_000, 2_000] },
  ).toBe("7");
  await expect.poll(
    async () => canvas.getAttribute("data-source-object-placement-count"),
    { timeout: 120_000, intervals: [500, 1_000, 2_000] },
  ).toBe("19");
  await expect.poll(
    async () => canvas.getAttribute("data-static-ramp-equipment-object-count"),
    { timeout: 120_000, intervals: [500, 1_000, 2_000] },
  ).toBe("31");

  const runtime = await canvas.evaluate((element) => ({ ...element.dataset }));
  expect(runtime.visualQuality).toBe("simulator-rendering-v1");
  expect(runtime.staticAircraftCount).toBe("7");
  expect(runtime.staticAircraftGates).toBe("A2,A3,A4,A5,A6,A7,A8");
  expect(runtime.staticAircraftDetailLevel).toBe("authored-crj700-static-gate-population-v1");
  expect(runtime.sourceObjectPlacementCount).toBe("19");
  expect(runtime.sourceObjectModelCount).toBe("5");
  expect(runtime.sourceObjectTextureCount).toBe("5");
  expect(Number(runtime.sourceObjectTexturedMaterialCount)).toBeGreaterThanOrEqual(3);
  expect(runtime.sourceObjectDetailLevel).toBe("source-authored-textured-airport-object-population-v2");
  expect(runtime.staticRampAuthoredTugCount).toBe("3");
  expect(runtime.staticRampSafetyConeCount).toBe("28");
  expect(runtime.staticRampEquipmentObjectCount).toBe("31");
  expect(runtime.staticRampEquipmentDetailLevel).toBe("authored-standup-ramp-equipment-and-cones-v1");
  expect(runtime.staticRampApronDetailLevel).toBe("a1-a8-source-derived-close-range-apron-v1");
  expect(runtime.staticRampApronTextureResolution).toBe("1024");
  expect(runtime.environmentSource).toBe("authored-phx-terminal4-textured-source-jetways");
  expect(runtime.groundSource).toBe("authored-kphx-v181-source-textured");
  expect(runtime.photoGroundSource).toBe("source-authored-phx-photo");

  await expect.poll(
    () => POPULATION_ASSET_SUFFIXES.filter((suffix) => {
      const status = assetResponses.get(suffix);
      return status === undefined || status < 200 || status >= 400;
    }),
    { timeout: 30_000, intervals: [500, 1_000] },
  ).toEqual([]);

  const relevantErrors = runtimeErrors.filter((message) =>
    /static aircraft load failed|source object load failed|static ramp equipment load failed|failed to load|Unexpected CRJ700 dimensions|No aircraft asset candidate|GLTFLoader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);
});
