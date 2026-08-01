import { expect, test } from "@playwright/test";

test("equipment selection exposes a direct tug inspection launch", async ({ page }) => {
  await page.goto("/");
  const directInspection = page.getByRole("button", { name: "Drive tug / inspect airport" });
  await expect(directInspection).toBeVisible();
  await directInspection.click();
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toHaveAttribute("data-inspection-mode", "active", { timeout: 120000 });
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();
});

test("A1 uses the measured source walkway portal and no cloned facade modules", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toHaveAttribute("data-environment-source", /authored-phx-terminal4/, { timeout: 120000 });
  await expect(canvas).toHaveAttribute("data-terminal4-facade-infill-count", "0");
  await expect(canvas).toHaveAttribute("data-terminal4-a1-jetway-wall-distance", /9\.(1|2)/);
  await canvas.screenshot({ path: "test-results/source-first-a1-attached.png", animations: "disabled" });
});
