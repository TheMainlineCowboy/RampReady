import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const VIEWPORT = { width: 1440, height: 900 };
const PRESETS = [
  { id: "a1", x: 0, z: 0 },
  { id: "a14", x: 218.45, z: -86.52 },
  { id: "b14", x: 216.4, z: 150.35 },
  { id: "b15", x: -18.5, z: 539.2 },
];

async function launchRuntime(page) {
  await page.setViewportSize(VIEWPORT);
  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  await page.getByRole("radio", { name: /Stand-up pushback/i }).click();
  await page.getByRole("button", { name: "Start training" }).click();

  await page.waitForFunction(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.environmentSource === "authored-phx-terminal4-textured-source-jetways"
      && data?.groundSource === "authored-kphx-v181-source-textured-nearfield"
      && data?.photoGroundSource === "source-authored-phx-photo"
      && data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayCount === "58";
  }, null, { timeout: 300_000, polling: 100 });
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
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("Airport compositor capture exceeded 45 seconds")),
        45_000,
      )),
    ]);
    const image = Buffer.from(data, "base64");
    expect(image.byteLength).toBeGreaterThan(50_000);
    await writeFile(`test-results/${fileName}`, image);
  } finally {
    await client.detach();
  }
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

test("free-drive inspection covers the full Terminal 4 route from A1 through B15", async ({ page }) => {
  test.setTimeout(900_000);
  await launchRuntime(page);

  const result = await page.evaluate(async (presets) => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Three.js canvas is missing");

    const waitFor = async (predicate, label, timeoutMs = 120_000) => {
      const deadline = performance.now() + timeoutMs;
      while (performance.now() < deadline) {
        if (predicate()) return;
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      throw new Error(`Timed out waiting for ${label}: ${JSON.stringify({ ...canvas.dataset })}`);
    };

    const nativeSelect = (select, value) => {
      if (!(select instanceof HTMLSelectElement)) throw new Error(`Missing selector for ${value}`);
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      if (!setter) throw new Error("Native select setter is unavailable");
      setter.call(select, value);
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    };

    const position = () => ({
      x: Number(canvas.dataset.inspectionTugX),
      z: Number(canvas.dataset.inspectionTugZ),
    });

    const holdKey = async (key, code, durationMs) => {
      window.dispatchEvent(new KeyboardEvent("keydown", {
        key,
        code,
        bubbles: true,
        cancelable: true,
      }));
      try {
        await new Promise((resolve) => setTimeout(resolve, durationMs));
      } finally {
        window.dispatchEvent(new KeyboardEvent("keyup", {
          key,
          code,
          bubbles: true,
          cancelable: true,
        }));
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    };

    const toggle = document.querySelector("button.rr-inspection-toggle");
    if (!(toggle instanceof HTMLButtonElement)) throw new Error("Free-drive inspection toggle is missing");
    if (toggle.getAttribute("aria-pressed") !== "true") toggle.click();

    await waitFor(
      () => canvas.dataset.inspectionMode === "active"
        && canvas.dataset.inspectionRouteAuthority === "source-gate-apron-presets-with-wide-diagonal-a1-connection-near-wall-b15-a1-a14-b14-b15-v7"
        && canvas.dataset.inspectionTelemetryAuthority === "synchronous-preset-placement-v2",
      "authoritative inspection mode",
    );

    const location = document.querySelector('select[aria-label="Inspection location"]');
    const camera = document.querySelector('select[aria-label="Camera view"]');
    const visited = [];

    for (const preset of presets) {
      nativeSelect(location, preset.id);
      await waitFor(
        () => canvas.dataset.inspectionPreset === preset.id
          && canvas.dataset.inspectionTugX === preset.x.toFixed(3)
          && canvas.dataset.inspectionTugZ === preset.z.toFixed(3),
        `inspection preset ${preset.id}`,
      );
      visited.push({ id: preset.id, ...position() });
    }

    const start = position();
    await holdKey("w", "KeyW", 1_200);
    const forward = position();
    await holdKey("s", "KeyS", 1_200);
    const reverse = position();

    nativeSelect(camera, "overhead");
    await waitFor(() => camera.value === "overhead", "overhead camera", 30_000);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    return {
      routeAuthority: canvas.dataset.inspectionRouteAuthority,
      telemetryAuthority: canvas.dataset.inspectionTelemetryAuthority,
      preset: canvas.dataset.inspectionPreset,
      visited,
      start,
      forward,
      reverse,
      cameraMode: camera.value,
    };
  }, PRESETS);

  expect(result.routeAuthority).toBe(
    "source-gate-apron-presets-with-wide-diagonal-a1-connection-near-wall-b15-a1-a14-b14-b15-v7",
  );
  expect(result.telemetryAuthority).toBe("synchronous-preset-placement-v2");
  expect(result.preset).toBe("b15");
  expect(result.cameraMode).toBe("overhead");
  expect(result.visited).toHaveLength(PRESETS.length);
  for (const [index, preset] of PRESETS.entries()) {
    expect(result.visited[index].id).toBe(preset.id);
    expect(result.visited[index].x).toBeCloseTo(preset.x, 3);
    expect(result.visited[index].z).toBeCloseTo(preset.z, 3);
  }
  for (const point of [result.start, result.forward, result.reverse]) {
    expect(Number.isFinite(point.x) && Number.isFinite(point.z)).toBe(true);
  }
  expect(distance(result.forward, result.start)).toBeGreaterThan(0.25);
  expect(distance(result.reverse, result.forward)).toBeGreaterThan(0.15);

  await captureScene(page, "inspection-b15-overhead-after-drive.png");
});
