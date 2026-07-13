import { expect, test } from "@playwright/test";

test("loads the real CRJ700 asset without falling back", async ({ page }) => {
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

  await page.screenshot({ path: "test-results/crj700-runtime.png", fullPage: true });
});
