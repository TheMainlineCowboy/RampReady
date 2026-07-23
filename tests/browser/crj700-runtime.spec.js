import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const EVIDENCE_VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 412, height: 915 };
const ORBIT_DRAG_PX = 220;
const MODEL_SUFFIXES = ["/models/crj700-user.glb", "/models/crj700-mobile.glb"];

async function waitForRealAircraft(page) {
  const runtimeErrors = [];
  const modelResponses = [];

  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (MODEL_SUFFIXES.some((suffix) => pathname.endsWith(suffix))) modelResponses.push(response);
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();

  const lektro = page.getByRole("radio", { name: /Lektro 88/i });
  const standup = page.getByRole("radio", { name: /Stand-up pushback/i });
  const launch = page.getByRole("button", { name: "Start training" });

  await expect(lektro).toHaveAttribute("aria-checked", "true");
  await expect(lektro).toContainText("Prototype ready");
  await expect(standup).toContainText("Asset not loaded");
  await expect(launch).toBeEnabled();

  await standup.click();
  await expect(standup).toHaveAttribute("aria-checked", "true");
  await expect(launch).toBeDisabled();

  await lektro.click();
  await expect(lektro).toHaveAttribute("aria-checked", "true");
  await expect(launch).toBeEnabled();
  await launch.click();

  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toBeVisible();
  await expect.poll(
    async () => canvas.getAttribute("data-aircraft-source"),
    { timeout: 30_000, intervals: [250, 500, 1_000] },
  ).not.toBe("loading");
  await expect.poll(
    () => modelResponses.some((response) => response.status() === 200),
    { timeout: 20_000 },
  ).toBe(true);
  await page.waitForTimeout(1_200);

  const relevantErrors = runtimeErrors.filter((message) =>
    /CRJ700 asset load failed|Unexpected CRJ700 dimensions|GLTFLoader|crj700-(?:user|mobile)\.glb|WebGL.*shader|VALIDATE_STATUS/i.test(message),
  );
  expect(relevantErrors).toEqual([]);

  const assetEntry = await page.evaluate((suffixes) => {
    const entry = performance.getEntriesByType("resource")
      .find((resource) => suffixes.some((suffix) => new URL(resource.name).pathname.endsWith(suffix)));
    return entry ? { name: entry.name, decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize } : null;
  }, MODEL_SUFFIXES);
  expect(assetEntry).not.toBeNull();
  expect(Math.max(assetEntry.decodedBodySize, assetEntry.transferSize)).toBeGreaterThan(10_000);

  return canvas;
}

async function prepareEvidenceFrame(page) {
  await page.addStyleTag({
    content: `
      .rr-hud,
      .rr-metrics,
      .rr-score-float,
      .rr-guidance,
      .rr-diagnostics,
      .rr-steer,
      .rr-throttle { display: none !important; }
      .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
    `,
  });
  await page.waitForTimeout(250);
}

async function orbitBy(page, dragX, dragY = 0) {
  await page.evaluate(({ dx, dy }) => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!canvas) throw new Error("Three.js canvas is missing");
    const box = canvas.getBoundingClientRect();
    const startX = box.left + box.width / 2;
    const startY = box.top + box.height / 2;
    const held = { bubbles: true, cancelable: true, pointerId: 73, pointerType: "mouse", button: 0, buttons: 1 };
    canvas.dispatchEvent(new PointerEvent("pointerdown", { ...held, clientX: startX, clientY: startY }));
    window.dispatchEvent(new PointerEvent("pointermove", { ...held, clientX: startX + dx, clientY: startY + dy }));
    window.dispatchEvent(new PointerEvent("pointerup", { ...held, clientX: startX + dx, clientY: startY + dy, buttons: 0 }));
  }, { dx: dragX, dy: dragY });
  await page.waitForTimeout(350);
}

async function writeCanvasEvidence(page, canvas, path) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const dataUrl = await canvas.evaluate((element) => element.toDataURL("image/png"));
  const marker = "base64,";
  const markerIndex = dataUrl.indexOf(marker);
  if (markerIndex < 0) throw new Error("Canvas evidence did not return a PNG data URL");
  const payload = Buffer.from(dataUrl.slice(markerIndex + marker.length), "base64");
  expect(payload.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  expect(payload.byteLength).toBeGreaterThan(5_000);
  const width = payload.readUInt32BE(16);
  const height = payload.readUInt32BE(20);
  expect(width).toBeGreaterThanOrEqual(400);
  expect(height).toBeGreaterThanOrEqual(800);
  await writeFile(path, payload);
}

function expectInsideViewport(name, box, viewport) {
  expect(box, `${name} must exist`).not.toBeNull();
  expect(box.left, `${name} left edge`).toBeGreaterThanOrEqual(-1);
  expect(box.top, `${name} top edge`).toBeGreaterThanOrEqual(-1);
  expect(box.right, `${name} right edge`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.bottom, `${name} bottom edge`).toBeLessThanOrEqual(viewport.height + 1);
}

test("loads the real CRJ700 asset and captures unobstructed side evidence", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize(EVIDENCE_VIEWPORT);
  const canvas = await waitForRealAircraft(page);
  await prepareEvidenceFrame(page);
  await orbitBy(page, ORBIT_DRAG_PX);
  await writeCanvasEvidence(page, canvas, "test-results/crj700-left-side.png");
  await orbitBy(page, -ORBIT_DRAG_PX * 2);
  await writeCanvasEvidence(page, canvas, "test-results/crj700-right-side.png");
});

test("mobile controls preserve a clear simulator viewport", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize(MOBILE_VIEWPORT);
  const canvas = await waitForRealAircraft(page);

  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      canvas: rect("canvas.trainerCanvas"),
      hud: rect(".rr-hud"),
      metrics: rect(".rr-metrics"),
      throttle: rect(".rr-throttle"),
      steer: rect(".rr-steer"),
      slider: rect(".rr-power-slider"),
      menu: rect(".rr-session-menu"),
    };
  });

  for (const name of ["hud", "metrics", "throttle", "steer", "slider", "menu"]) {
    expectInsideViewport(name, layout[name], layout.viewport);
  }
  expect(layout.canvas).not.toBeNull();
  expect(layout.canvas.width).toBeGreaterThanOrEqual(400);
  expect(layout.canvas.height).toBeGreaterThanOrEqual(890);
  expect(layout.hud.height).toBeLessThan(210);
  expect(layout.metrics.height).toBeLessThanOrEqual(58);
  expect(layout.metrics.bottom).toBeLessThanOrEqual(layout.throttle.top + 2);
  expect(layout.slider.width).toBeGreaterThanOrEqual(120);
  expect(layout.slider.height).toBeGreaterThanOrEqual(40);

  const slider = page.locator(".rr-power-slider");
  await slider.evaluate((element) => {
    element.value = "55";
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(slider).toHaveValue("55");

  const beforeYaw = Number(await canvas.getAttribute("data-camera-yaw"));
  await orbitBy(page, 120, -30);
  const afterYaw = Number(await canvas.getAttribute("data-camera-yaw"));
  expect(Number.isFinite(beforeYaw)).toBe(true);
  expect(Number.isFinite(afterYaw)).toBe(true);
  expect(Math.abs(afterYaw - beforeYaw)).toBeGreaterThan(0.2);

  await writeCanvasEvidence(page, canvas, "test-results/mobile-simulator-layout.png");
});
