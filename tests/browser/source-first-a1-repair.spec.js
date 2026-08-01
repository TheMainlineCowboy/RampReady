import fs from "node:fs";
import { expect, test } from "@playwright/test";

async function saveCompositedCanvasPng(page, canvas, path) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const box = await canvas.boundingBox();
  if (!box || box.width < 64 || box.height < 64) throw new Error("Canvas has no usable compositor bounds");
  const client = await page.context().newCDPSession(page);
  const capture = client.send("Page.captureScreenshot", {
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
  });
  const timeout = new Promise((_, reject) => setTimeout(
    () => reject(new Error("Chromium compositor capture exceeded 30 seconds")),
    30_000,
  ));
  const { data } = await Promise.race([capture, timeout]);
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(path, Buffer.from(data, "base64"));
  await client.detach();
  const bytes = fs.statSync(path).size;
  if (bytes < 30_000) throw new Error(`Composited A1 evidence is suspiciously small: ${bytes} bytes`);
}

test("equipment selection exposes a direct tug inspection launch", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const directInspection = page.getByRole("button", { name: "Drive tug / inspect airport" });
  await expect(directInspection).toBeVisible();
  await directInspection.click();
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toHaveAttribute("data-inspection-mode", "active", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();
});

test("A1 uses the source walkway and package-native closed facade", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toHaveAttribute("data-environment-source", /authored-phx-terminal4/, { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-facade-infill-count", "0", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-a1-jetway-wall-distance", /9\.(1|2)/, { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-source-closed-bay-material-count", /^[1-9]\d*$/, { timeout: 120_000 });
  await saveCompositedCanvasPng(page, canvas, "test-results/source-first-a1-attached.png");
});
