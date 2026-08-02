import fs from "node:fs";
import { expect, test } from "@playwright/test";

async function saveCompositedCanvasPng(page, path) {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!canvas) throw new Error("Three.js canvas is missing for A1 evidence capture");
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (box.width < 64 || box.height < 64) throw new Error("Canvas has no usable compositor bounds");
  const client = await page.context().newCDPSession(page);
  try {
    await client.send("Page.bringToFront");
    const { data } = await Promise.race([
      client.send("Page.captureScreenshot", {
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
      }),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("Chromium compositor capture exceeded 45 seconds")),
        45_000,
      )),
    ]);
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync(path, Buffer.from(data, "base64"));
    const bytes = fs.statSync(path).size;
    if (bytes < 30_000) throw new Error(`Composited A1 evidence is suspiciously small: ${bytes} bytes`);
  } finally {
    await client.detach();
  }
}

test("direct tug inspection proves the visible A1 terminal connection over source-aerial pavement", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const directInspection = page.getByRole("button", { name: "Drive tug / inspect airport" });
  await expect(directInspection).toBeVisible();
  await directInspection.click();

  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toHaveAttribute("data-inspection-mode", "active", { timeout: 120_000 });
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();
  const hudHeight = await page.evaluate(() => document.querySelector(".rr-hud")?.getBoundingClientRect().height ?? Number.POSITIVE_INFINITY);
  expect(hudHeight).toBeLessThan(110);

  await expect(canvas).toHaveAttribute("data-environment-source", /authored-phx-terminal4/, { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-load-state", "ready", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-count", "58", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-connector-count", "58", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-uploaded-jetway-verified-model-count", "58", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute(
    "data-terminal4-uploaded-jetway-ready-authority",
    "uploaded-airport-jetway-fleet-complete-58-gates-v7-instanced-jetways-and-connectors-source-textured",
    { timeout: 120_000 },
  );
  await expect(canvas).toHaveAttribute("data-photo-ground-source", "source-authored-phx-photo", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute(
    "data-ground-pavement-authority",
    "full-source-aerial-primary-with-subtle-package-surface-detail-v41",
    { timeout: 120_000 },
  );
  await expect(canvas).toHaveAttribute("data-ground-source-aerial-priority", "true", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-ground-nearfield-detail-opacity", "0.18", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-render-quality-authority", "srgb-aces-apron-daylight-dynamic-shadows-v3");
  await expect(canvas).toHaveAttribute("data-shadow-mode", "dynamic-high-fidelity");
  await expect(canvas).toHaveAttribute("data-terminal4-facade-infill-count", "0", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-a1-jetway-wall-distance", /9\.(1|2)/, { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-a1-portal-seal-authority", "exact-T4_WALK-source-shell-overlap-and-framed-portal-v37", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-a1-portal-seal-overlap-meters", "0.8", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-a1-portal-seal-exact-texture", "true", { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-source-closed-bay-material-count", /^[1-9]\d*$/, { timeout: 120_000 });
  await expect(canvas).toHaveAttribute("data-terminal4-source-facade-variant-material-count", /^[4-9]\d*$/, { timeout: 120_000 });

  const variation = await page.evaluate(() => {
    const element = document.querySelector("canvas.trainerCanvas");
    if (!element) throw new Error("Three.js canvas disappeared before facade evidence capture");
    return {
      open: Number(element.dataset.terminal4SourceFacadeOpenCellCount || 0),
      closed: Number(element.dataset.terminal4SourceFacadeClosedCellCount || 0),
      variants: Number(element.dataset.terminal4SourceFacadeVariantMaterialCount || 0),
    };
  });
  expect(variation.open).toBeGreaterThan(0);
  expect(variation.closed).toBeGreaterThan(variation.open * 3);
  expect(variation.variants).toBeGreaterThanOrEqual(4);

  const inspectionLocation = page.getByLabel("Inspection location");
  await expect(inspectionLocation).toHaveValue("a1");
  await inspectionLocation.selectOption("a1Connection");
  await expect(canvas).toHaveAttribute("data-inspection-preset", "a1Connection");
  await expect(canvas).toHaveAttribute("data-inspection-preset-label", "A1 terminal connection");
  await expect(canvas).toHaveAttribute("data-inspection-camera-authority", "wide-diagonal-a1-terminal-joint-v6-clear-tug");
  await page.waitForTimeout(1800);

  await saveCompositedCanvasPng(page, "test-results/source-first-a1-terminal-connection.png");
});
