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

async function captureScene(page, fileName) {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!canvas) throw new Error("Three.js canvas is missing for airport evidence capture");
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  expect(box.width).toBeGreaterThan(64);
  expect(box.height).toBeGreaterThan(64);
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
          width: Math.min(box.width, VIEWPORT.width - Math.max(0, box.x)),
          height: Math.min(box.height, VIEWPORT.height - Math.max(0, box.y)),
          scale: 1,
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error("Airport compositor capture exceeded 45 seconds")), 45_000)),
    ]);
    const image = Buffer.from(data, "base64");
    expect(image.byteLength).toBeGreaterThan(50_000);
    await writeFile(`test-results/${fileName}`, image);
  } finally {
    await client.detach();
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
  // Hosted software WebGL can spend several minutes flushing seven full-size
  // compositor captures. Keep every required A1/A14/B14/B15 and tug-height
  // evidence frame, but allow the final forward/reverse motion gate to finish.
  test.setTimeout(900_000);
  const canvas = await launchRuntime(page);

  const toggle = page.locator("button.rr-inspection-toggle");
  await expect(toggle).toHaveText("Free-drive inspection");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveText("Return to training");
  await expect(canvas).toHaveAttribute(
    "data-inspection-route-authority",
    "source-gate-apron-presets-with-side-on-a1-connection-a1-a14-b14-b15-v4",
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
    await page.waitForTimeout(500);
    await captureScene(page, preset.file);

    if (preset.groundFile) {
      await camera.selectOption("driver");
      await page.waitForTimeout(500);
      await captureScene(page, preset.groundFile);
      await camera.selectOption("chase");
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
  await page.waitForTimeout(500);
  await captureScene(page, "inspection-b15-overhead-after-drive.png");
});
