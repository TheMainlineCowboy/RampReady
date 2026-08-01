import fs from "node:fs";
import { expect, test } from "@playwright/test";

async function saveCanvasPng(canvas, path) {
  const dataUrl = await canvas.evaluate((element) => element.toDataURL("image/png"));
  const payload = dataUrl.split(",")[1];
  if (!payload) throw new Error("Canvas did not return PNG evidence");
  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(path, Buffer.from(payload, "base64"));
}

test("equipment selection exposes a direct tug inspection launch", async ({ page }) => {
  test.setTimeout(180_000);
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
  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toHaveAttribute("data-environment-source", /authored-phx-terminal4/, { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-facade-infill-count", "0", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-a1-jetway-wall-distance", /9\.(1|2)/, { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-source-closed-bay-material-count", /^[1-9]\d*$/, { timeout: 120_000 });
  await saveCanvasPng(canvas, "test-results/source-first-a1-attached.png");
});
