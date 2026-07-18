import { expect, test } from "@playwright/test";

const EVIDENCE_VIEWPORT = { width: 1920, height: 1080 };
const ORBIT_DRAG_PX = 262;

async function waitForRealAircraft(page) {
  const runtimeErrors = [];
  let modelResponse = null;

  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("response", (response) => {
    if (response.url().includes("/models/crj700-mobile.glb")) modelResponse = response;
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.locator("canvas")).toBeVisible();
  await expect.poll(() => modelResponse?.status() ?? 0, { timeout: 20_000 }).toBe(200);

  // Give GLTFLoader time to parse, validate dimensions, add the real mesh, and hide the fallback body.
  await page.waitForTimeout(3_000);

  const relevantErrors = runtimeErrors.filter((message) =>
    /CRJ700 asset load failed|Unexpected CRJ700 dimensions|GLTFLoader|crj700-mobile\.glb/i.test(message),
  );
  expect(relevantErrors).toEqual([]);

  const assetEntry = await page.evaluate(() => {
    const entry = performance.getEntriesByType("resource")
      .find((resource) => resource.name.includes("/models/crj700-mobile.glb"));
    return entry ? { name: entry.name, decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize } : null;
  });
  expect(assetEntry).not.toBeNull();
  expect(Math.max(assetEntry.decodedBodySize, assetEntry.transferSize)).toBeGreaterThan(10_000);
}

async function prepareEvidenceFrame(page) {
  await page.addStyleTag({
    content: `
      .rr-hud,
      .rr-metrics,
      .rr-score-float,
      .rr-guidance,
      .rr-diagnostics,
      .rr-steer,
      .rr-throttle { display: none !important; }
      .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
    `,
  });
  await page.waitForTimeout(500);
}

async function orbitToSide(page, direction) {
  const canvas = page.locator("canvas");
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();

  const startX = bounds.x + bounds.width / 2;
  const startY = bounds.y + bounds.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + direction * ORBIT_DRAG_PX, startY, { steps: 24 });
  await page.mouse.up();
  await page.waitForTimeout(1_500);
}

test("loads the real CRJ700 asset and captures unobstructed side evidence", async ({ page }) => {
  await page.setViewportSize(EVIDENCE_VIEWPORT);
  await waitForRealAircraft(page);
  await prepareEvidenceFrame(page);

  await orbitToSide(page, 1);
  await page.locator("canvas").screenshot({ path: "test-results/crj700-left-side.png" });

  await page.reload({ waitUntil: "networkidle" });
  await page.waitForTimeout(3_000);
  await prepareEvidenceFrame(page);
  await orbitToSide(page, -1);
  await page.locator("canvas").screenshot({ path: "test-results/crj700-right-side.png" });
});
