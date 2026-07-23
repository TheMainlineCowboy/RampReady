import { expect, test } from "@playwright/test";

test("shows equipment selection before the simulator and keeps mobile telemetry compact", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 412, height: 915 });
  await page.goto("/", { waitUntil: "networkidle" });

  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(page.locator("canvas.trainerCanvas")).toHaveCount(0);

  const launchButton = page.getByRole("button", { name: "Start training" });
  await expect(launchButton).toBeEnabled();
  await launchButton.click();

  const canvas = page.locator("canvas.trainerCanvas");
  const hud = page.locator(".rr-hud");
  const metrics = page.locator(".rr-metrics");
  const steer = page.locator(".rr-steer");

  await expect(canvas).toBeVisible();
  await expect(metrics).toBeVisible();

  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
    };
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      hud: rect(".rr-hud"),
      metrics: rect(".rr-metrics"),
      steer: rect(".rr-steer"),
      canvas: rect("canvas.trainerCanvas"),
    };
  });

  expect(layout.canvas?.width).toBeGreaterThanOrEqual(400);
  expect(layout.canvas?.height).toBeGreaterThanOrEqual(890);
  expect(layout.metrics?.height).toBeLessThanOrEqual(70);
  expect(layout.metrics?.top).toBeGreaterThan(layout.viewport.height * 0.65);
  expect(layout.metrics?.top).toBeGreaterThan(layout.hud?.bottom ?? 0);
  expect(layout.metrics?.bottom).toBeLessThanOrEqual((layout.steer?.top ?? layout.viewport.height) + 8);

  await page.screenshot({ path: "test-results/mobile-equipment-layout.png", fullPage: true });
});
