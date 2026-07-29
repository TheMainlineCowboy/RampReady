import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const SOURCE_OBJECT_SUFFIXES = [
  "/models/kphx-source-objects/source-object-manifest.json",
  "/models/kphx-source-objects/backhoe/terminal4.gltf",
  "/models/kphx-source-objects/constrailer/terminal4.gltf",
  "/models/kphx-source-objects/phxprkgrg/terminal4.gltf",
  "/models/kphx-source-objects/phxtermlink/terminal4.gltf",
  "/models/kphx-source-objects/wncater/terminal4.gltf",
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

test("populates source-decoded Terminal 4 stands and authored airport objects", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const runtimeErrors = [];
  const assetResponses = [];
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (SOURCE_OBJECT_SUFFIXES.some((suffix) => pathname.endsWith(suffix))) assetResponses.push(response);
  });
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const canvas = await launchStandup(page);
  await expect.poll(
    async () => canvas.getAttribute("data-static-aircraft-count"),
    { timeout: 90_000, intervals: [500, 1_000, 2_000] },
  ).toBe("7");
  await expect.poll(
    async () => canvas.getAttribute("data-source-object-placement-count"),
    { timeout: 90_000, intervals: [500, 1_000, 2_000] },
  ).toBe("19");

  const runtime = await canvas.evaluate((element) => ({ ...element.dataset }));
  expect(runtime.staticAircraftCount).toBe("7");
  expect(runtime.staticAircraftGates).toBe("A2,A3,A4,A5,A6,A7,A8");
  expect(runtime.staticAircraftDetailLevel).toBe("authored-crj700-static-gate-population-v1");
  expect(runtime.sourceObjectPlacementCount).toBe("19");
  expect(runtime.sourceObjectModelCount).toBe("5");
  expect(runtime.sourceObjectDetailLevel).toBe("source-authored-airport-object-population-v1");
  expect(runtime.environmentSource).toBe("authored-phx-terminal4-textured-source-jetways");
  expect(runtime.groundSource).toBe("authored-kphx-v181-source-textured");
  expect(runtime.photoGroundSource).toBe("source-authored-phx-photo");

  for (const suffix of SOURCE_OBJECT_SUFFIXES) {
    await expect.poll(
      () => assetResponses.some((response) => new URL(response.url()).pathname.endsWith(suffix) && response.status() === 200),
      { timeout: 30_000 },
    ).toBe(true);
  }

  const relevantErrors = runtimeErrors.filter((message) =>
    /static aircraft load failed|source object load failed|failed to load|Unexpected CRJ700 dimensions|No aircraft asset candidate|GLTFLoader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);
});
