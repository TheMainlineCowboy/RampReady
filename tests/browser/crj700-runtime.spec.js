import { expect, test } from "@playwright/test";

const EVIDENCE_VIEWPORT = { width: 1920, height: 1080 };
const MOBILE_VIEWPORT = { width: 690, height: 1536 };
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
  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Stand-up pushback/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("radio", { name: /Lektro 88/ })).toContainText("In preparation");
  await page.getByRole("button", { name: "Start training" }).click();
  await expect(page.locator("canvas")).toBeVisible();
  await expect.poll(() => modelResponse?.status() ?? 0, { timeout: 20_000 }).toBe(200);
  await page.waitForTimeout(3_000);

  const relevantErrors = runtimeErrors.filter((message) =>
    /CRJ700 asset load failed|Unexpected CRJ700 dimensions|GLTFLoader|crj700-mobile\.glb|WebGL.*shader|VALIDATE_STATUS/i.test(message),
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

async function orbitBy(page, dragMultiplier) {
  const startX = EVIDENCE_VIEWPORT.width / 2;
  const startY = EVIDENCE_VIEWPORT.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + dragMultiplier * ORBIT_DRAG_PX, startY, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(1_000);
}

test("loads the real CRJ700 asset and captures unobstructed side evidence", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize(EVIDENCE_VIEWPORT);
  await waitForRealAircraft(page);
  await prepareEvidenceFrame(page);
  await orbitBy(page, 1);
  await page.screenshot({ path: "test-results/crj700-left-side.png" });
  await orbitBy(page, -2);
  await page.screenshot({ path: "test-results/crj700-right-side.png" });
});

test("mobile controls preserve a clear simulator viewport", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize(MOBILE_VIEWPORT);
  await waitForRealAircraft(page);
  const hud = page.locator(".rr-hud");
  const hudBox = await hud.boundingBox();
  expect(hudBox).not.toBeNull();
  expect(hudBox.height).toBeLessThan(180);
  await expect(page.locator(".rr-checklist")).toBeHidden();
  await expect(page.locator(".rr-view-select")).toBeVisible();
  await expect(page.locator(".rr-hud-actions .rr-primary")).toBeVisible();
  await expect(page.locator(".rr-throttle")).toBeVisible();
  await expect(page.locator(".rr-steer")).toBeVisible();
  const canvasBox = await page.locator("canvas").boundingBox();
  expect(canvasBox).not.toBeNull();
  expect(canvasBox.height).toBeGreaterThan(1200);
  expect(hudBox.height / canvasBox.height).toBeLessThan(0.14);
  await page.screenshot({ path: "test-results/mobile-simulator-layout.png", fullPage: true });
});
