import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const VIEWPORT = { width: 1440, height: 900 };
const PRESETS = [
  { id: "a1", x: 0, z: 0, file: "inspection-a1-ramp.png", groundFile: "inspection-a1-operator-ground.png" },
  { id: "a14", x: 218.45, z: -86.52, file: "inspection-a-concourse-midpoint.png" },
  { id: "b14", x: 216.4, z: 150.35, file: "inspection-b-concourse-midpoint.png" },
  { id: "b15", x: -5.5, z: 539.2, file: "inspection-b15-ramp.png", groundFile: "inspection-b15-operator-ground.png" },
];

async function launchRuntime(page) {
  await page.setViewportSize(VIEWPORT);
  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  await page.getByRole("radio", { name: /Stand-up pushback/i }).click();
  await page.getByRole("button", { name: "Start training" }).click();
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toBeVisible();
  for (const [attribute, expected] of [
    ["data-environment-source", "authored-phx-terminal4-textured-source-jetways"],
    ["data-ground-source", "authored-kphx-v181-source-textured-nearfield"],
    ["data-photo-ground-source", "source-authored-phx-photo"],
  ]) {
    await expect.poll(
      () => canvas.getAttribute(attribute),
      { timeout: 120_000, intervals: [500, 1_000, 2_000] },
    ).toBe(expected);
  }
  return canvas;
}

async function captureScene(page, canvas, fileName) {
  const style = await page.addStyleTag({
    content: `
      .rr-hud, .rr-metrics, .rr-score-float, .rr-guidance, .rr-diagnostics,
      .rr-steer, .rr-throttle { display: none !important; }
      .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
    `,
  });
  await page.waitForTimeout(700);
  try {
    const bounds = await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    const image = await page.screenshot({
      type: "png",
      clip: {
        x: Math.max(0, Math.floor(bounds.x)),
        y: Math.max(0, Math.floor(bounds.y)),
        width: Math.floor(bounds.width),
        height: Math.floor(bounds.height),
      },
      animations: "disabled",
    });
    expect(image.byteLength).toBeGreaterThan(50_000);
    await writeFile(`test-results/${fileName}`, image);
  } finally {
    await style.evaluate((element) => element.remove());
    await page.waitForTimeout(250);
  }
}

async function numericAttribute(canvas, attribute) {
  const value = await canvas.getAttribute(attribute);
  return Number(value);
}

async function tugPosition(canvas) {
  const x = await numericAttribute(canvas, "data-inspection-tug-x");
  const z = await numericAttribute(canvas, "data-inspection-tug-z");
  return { x, z };
}

async function expectPresetPosition(canvas, preset) {
  await expect(canvas).toHaveAttribute("data-inspection-tug-x", preset.x.toFixed(3), { timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-inspection-tug-z", preset.z.toFixed(3), { timeout: 30_000 });
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

test("free-drive inspection covers the full Terminal 4 route from A1 through B15", async ({ page }) => {
  // Full source airport loading plus nine lossless WebGL evidence captures can
  // exceed ten minutes on the hosted software renderer. The prior 600 s limit
  // expired during screenshot cleanup even though the runtime remained healthy.
  test.setTimeout(900_000);
  const canvas = await launchRuntime(page);

  const toggle = page.locator("button.rr-inspection-toggle");
  await expect(toggle).toHaveText("Free-drive inspection");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveText("Return to training");
  await expect(canvas).toHaveAttribute(
    "data-inspection-route-authority",
    "source-gate-apron-presets-with-close-a1-connection-a1-a14-b14-b15-v3",
  );
  await expect(canvas).toHaveAttribute(
    "data-inspection-telemetry-authority",
    "synchronous-preset-placement-v2",
  );

  const location = page.getByLabel("Inspection location");
  const camera = page.getByLabel("Camera view");
  await expect(location).toBeVisible();
  await expect(camera).toBeVisible();

  for (const preset of PRESETS) {
    await location.selectOption(preset.id);
    await expect(canvas).toHaveAttribute("data-inspection-preset", preset.id);
    await expectPresetPosition(canvas, preset);
    await camera.selectOption("chase");
    await page.waitForTimeout(900);
    await captureScene(page, canvas, preset.file);

    // A tug-height operator view is mandatory at both ends of the inspection
    // route. Elevated chase shots alone can hide floating markings, coarse
    // pavement, detached portal seals and facade intersections.
    if (preset.groundFile) {
      await camera.selectOption("driver");
      await page.waitForTimeout(900);
      await captureScene(page, canvas, preset.groundFile);
      await camera.selectOption("chase");
      await page.waitForTimeout(350);
    }
  }

  await location.selectOption("b15");
  await expect(canvas).toHaveAttribute("data-inspection-preset", "b15");
  await expectPresetPosition(canvas, PRESETS.at(-1));
  const start = await tugPosition(canvas);
  expect(Number.isFinite(start.x) && Number.isFinite(start.z)).toBe(true);

  await page.keyboard.down("w");
  await page.waitForTimeout(1_200);
  await page.keyboard.up("w");
  const forward = await tugPosition(canvas);
  expect(Number.isFinite(forward.x) && Number.isFinite(forward.z)).toBe(true);
  expect(distance(forward, start)).toBeGreaterThan(0.25);

  await page.keyboard.down("s");
  await page.waitForTimeout(1_200);
  await page.keyboard.up("s");
  const reverse = await tugPosition(canvas);
  expect(Number.isFinite(reverse.x) && Number.isFinite(reverse.z)).toBe(true);
  expect(distance(reverse, forward)).toBeGreaterThan(0.15);

  await camera.selectOption("overhead");
  await page.waitForTimeout(1_000);
  await captureScene(page, canvas, "inspection-b15-overhead-after-drive.png");
});
