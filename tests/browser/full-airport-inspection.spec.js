import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const VIEWPORT = { width: 1440, height: 900 };
const PRESETS = [
  { id: "a1", x: 0, z: 0, file: "inspection-a1-ramp.png" },
  { id: "a14", x: 218.45, z: -86.52, file: "inspection-a-concourse-midpoint.png" },
  { id: "b14", x: 216.4, z: 150.35, file: "inspection-b-concourse-midpoint.png" },
  { id: "b15", x: 10.6, z: 534.7, file: "inspection-b15-ramp.png" },
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

async function tugPosition(canvas) {
  return canvas.evaluate((element) => ({
    x: Number(element.dataset.inspectionTugX),
    z: Number(element.dataset.inspectionTugZ),
  }));
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

test("free-drive inspection covers the full Terminal 4 route from A1 through B15", async ({ page }) => {
  test.setTimeout(600_000);
  const canvas = await launchRuntime(page);

  const toggle = page.locator("button.rr-inspection-toggle");
  await expect(toggle).toHaveText("Free-drive inspection");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveText("Return to training");
  await expect(canvas).toHaveAttribute(
    "data-inspection-route-authority",
    "source-gate-apron-presets-a1-a14-b14-b15-v1",
  );

  const location = page.getByLabel("Inspection location");
  await expect(location).toBeVisible();

  for (const preset of PRESETS) {
    await location.selectOption(preset.id);
    await expect(canvas).toHaveAttribute("data-inspection-preset", preset.id);
    await expect.poll(async () => {
      const position = await tugPosition(canvas);
      return Number.isFinite(position.x) && Number.isFinite(position.z);
    }, { timeout: 15_000 }).toBe(true);
    const position = await tugPosition(canvas);
    expect(Math.abs(position.x - preset.x), `${preset.id} X placement`).toBeLessThan(0.08);
    expect(Math.abs(position.z - preset.z), `${preset.id} Z placement`).toBeLessThan(0.08);
    await page.waitForTimeout(900);
    await captureScene(page, canvas, preset.file);
  }

  await location.selectOption("b15");
  await expect(canvas).toHaveAttribute("data-inspection-preset", "b15");
  const start = await tugPosition(canvas);
  await page.keyboard.down("w");
  await page.waitForTimeout(1_200);
  await page.keyboard.up("w");
  const forward = await tugPosition(canvas);
  expect(distance(forward, start)).toBeGreaterThan(0.25);

  await page.keyboard.down("s");
  await page.waitForTimeout(1_200);
  await page.keyboard.up("s");
  const reverse = await tugPosition(canvas);
  expect(distance(reverse, forward)).toBeGreaterThan(0.15);

  await page.getByLabel("Camera view").selectOption("overhead");
  await page.waitForTimeout(1_000);
  await captureScene(page, canvas, "inspection-b15-overhead-after-drive.png");
});
