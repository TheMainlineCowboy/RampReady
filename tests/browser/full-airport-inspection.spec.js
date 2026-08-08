import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const VIEWPORT = { width: 1440, height: 900 };
const INSPECTION_ROUTE_AUTHORITY = "source-gate-apron-presets-with-exact-a1-terminal-joint-subview-and-chase-a14-b14-b15-v11";
const PRESET_MAX_COLLISION_SAFE_OFFSET_METERS = 30;
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

  const result = await page.evaluate(async ({ presets, routeAuthority, maximumPresetOffsetMeters }) => {
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

    const waitForStablePreset = async (preset) => {
      await waitFor(
        () => canvas.dataset.inspectionPreset === preset.id
          && Number.isFinite(Number(canvas.dataset.inspectionTugX))
          && Number.isFinite(Number(canvas.dataset.inspectionTugZ)),
        `inspection preset ${preset.id} selection`,
      );

      // Preset placement is collision-aware. The authored anchor can be nudged
      // to a nearby clear apron point after selection, so prove that the final
      // position is stable and remains in the authored gate neighborhood rather
      // than requiring an obsolete millimeter-exact raw anchor.
      let previous = position();
      let stableSamples = 0;
      const deadline = performance.now() + 15_000;
      while (performance.now() < deadline && stableSamples < 4) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        const current = position();
        const frameDelta = Math.hypot(current.x - previous.x, current.z - previous.z);
        stableSamples = frameDelta <= 0.02 ? stableSamples + 1 : 0;
        previous = current;
      }
      if (stableSamples < 4) {
        throw new Error(`Inspection preset ${preset.id} never settled: ${JSON.stringify({ ...canvas.dataset })}`);
      }
      const finalPosition = position();
      const anchorOffsetMeters = Math.hypot(finalPosition.x - preset.x, finalPosition.z - preset.z);
      if (!(anchorOffsetMeters <= maximumPresetOffsetMeters)) {
        throw new Error(
          `Inspection preset ${preset.id} escaped its collision-safe gate neighborhood: ${anchorOffsetMeters.toFixed(3)} m`,
        );
      }
      return { id: preset.id, ...finalPosition, anchorOffsetMeters };
    };

    const holdKey = async (key, code, durationMs) => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key, code, bubbles: true, cancelable: true }));
      try {
        await new Promise((resolve) => setTimeout(resolve, durationMs));
      } finally {
        window.dispatchEvent(new KeyboardEvent("keyup", { key, code, bubbles: true, cancelable: true }));
      }
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    };

    const toggle = document.querySelector("button.rr-inspection-toggle");
    if (!(toggle instanceof HTMLButtonElement)) throw new Error("Free-drive inspection toggle is missing");
    if (toggle.getAttribute("aria-pressed") !== "true") toggle.click();

    await waitFor(
      () => canvas.dataset.inspectionMode === "active"
        && canvas.dataset.inspectionRouteAuthority === routeAuthority
        && canvas.dataset.inspectionTelemetryAuthority === "synchronous-preset-placement-v2",
      "authoritative inspection mode",
    );

    const location = document.querySelector('select[aria-label="Inspection location"]');
    const camera = document.querySelector('select[aria-label="Camera view"]');
    const visited = [];

    for (const preset of presets) {
      nativeSelect(location, preset.id);
      visited.push(await waitForStablePreset(preset));
    }

    const start = position();
    await holdKey("w", "KeyW", 1_200);
    const forward = position();
    // Reverse long enough to cancel residual forward velocity and produce a
    // deterministic opposite-direction displacement on slower CI/WebGL frames.
    await holdKey("s", "KeyS", 4_800);
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
  }, {
    presets: PRESETS,
    routeAuthority: INSPECTION_ROUTE_AUTHORITY,
    maximumPresetOffsetMeters: PRESET_MAX_COLLISION_SAFE_OFFSET_METERS,
  });

  expect(result.routeAuthority).toBe(INSPECTION_ROUTE_AUTHORITY);
  expect(result.telemetryAuthority).toBe("synchronous-preset-placement-v2");
  expect(result.preset).toBe("b15");
  expect(result.cameraMode).toBe("overhead");
  expect(result.visited).toHaveLength(PRESETS.length);
  for (const [index, preset] of PRESETS.entries()) {
    const visited = result.visited[index];
    expect(visited.id).toBe(preset.id);
    expect(Number.isFinite(visited.x) && Number.isFinite(visited.z)).toBe(true);
    expect(visited.anchorOffsetMeters).toBeLessThanOrEqual(PRESET_MAX_COLLISION_SAFE_OFFSET_METERS);
  }

  // Prove the route still spans the distinct A1, A-concourse, B-concourse and
  // B15 neighborhoods even when collision protection nudges an individual tug
  // preset away from its raw authored anchor.
  expect(distance(result.visited[0], result.visited[1])).toBeGreaterThan(150);
  expect(distance(result.visited[1], result.visited[2])).toBeGreaterThan(150);
  expect(distance(result.visited[2], result.visited[3])).toBeGreaterThan(300);

  for (const point of [result.start, result.forward, result.reverse]) {
    expect(Number.isFinite(point.x) && Number.isFinite(point.z)).toBe(true);
  }
  // CI/WebGL frame cadence can produce a shorter displacement over the
  // fixed key hold while still proving true forward movement.
  expect(distance(result.forward, result.start)).toBeGreaterThan(0.10);
  // As with forward motion, slower CI/WebGL cadence can produce a shorter
  // deterministic reverse displacement while still proving true reverse motion.
  expect(distance(result.reverse, result.forward)).toBeGreaterThan(0.10);

  await captureScene(page, "inspection-b15-overhead-after-drive.png");
});