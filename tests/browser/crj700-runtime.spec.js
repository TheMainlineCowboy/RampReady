import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 412, height: 915 };
const MODEL_SUFFIXES = ["/models/crj700-user.glb", "/models/crj700-mobile.glb"];
const STANDUP_SUFFIX = "/models/standup-tug.glb";
const TERMINAL_SUFFIXES = [
  "/models/phx-terminal4/terminal4.gltf",
  "/models/phx-terminal4/terminal4.bin",
  "/models/phx-terminal4/texture-manifest.json",
];

async function launchRuntime(page) {
  const errors = [];
  const responses = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("response", (response) => responses.push(response));

  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  const standup = page.getByRole("radio", { name: /Stand-up pushback/i });
  await standup.click();
  await expect(standup).toHaveAttribute("aria-checked", "true");
  await page.getByRole("button", { name: "Start training" }).click();

  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toBeVisible();
  for (const [attribute, expected] of [
    ["data-environment-source", "authored-phx-terminal4-textured-source-jetways"],
    ["data-ground-source", "authored-kphx-v181-source-textured-nearfield"],
    ["data-photo-ground-source", "source-authored-phx-photo"],
    ["data-tug-source", "authored-standup"],
    ["data-operator-controls", "ready"],
  ]) {
    await expect.poll(
      () => canvas.getAttribute(attribute),
      { timeout: 90_000, intervals: [250, 500, 1_000] },
    ).toBe(expected);
  }
  await expect.poll(
    () => canvas.getAttribute("data-aircraft-source"),
    { timeout: 90_000, intervals: [250, 500, 1_000] },
  ).not.toBe("loading");
  await expect(canvas).toHaveAttribute("data-steering-mode", "rear");
  await expect(canvas).toHaveAttribute("data-operator-side", "right");

  const requested = (suffix) => responses.some((response) => {
    const pathname = new URL(response.url()).pathname;
    return pathname.endsWith(suffix) && response.status() === 200;
  });
  await expect.poll(() => MODEL_SUFFIXES.some(requested), { timeout: 30_000 }).toBe(true);
  await expect.poll(() => requested(STANDUP_SUFFIX), { timeout: 30_000 }).toBe(true);
  for (const suffix of TERMINAL_SUFFIXES) {
    await expect.poll(() => requested(suffix), { timeout: 30_000 }).toBe(true);
  }

  const relevantErrors = errors.filter((message) =>
    /CRJ700 asset load failed|Equipment model failed to load|PHX Terminal 4 failed to load|PHX airport ground failed to load|PHX source aerial failed to load|GLTFLoader|WebGL.*shader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);
  return canvas;
}

async function withHiddenControls(page, action) {
  const style = await page.addStyleTag({
    content: `
      .rr-hud, .rr-metrics, .rr-score-float, .rr-guidance, .rr-diagnostics,
      .rr-steer, .rr-throttle { display: none !important; }
      .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
    `,
  });
  await page.waitForTimeout(300);
  try {
    return await action();
  } finally {
    await style.evaluate((element) => element.remove());
    await page.waitForTimeout(150);
  }
}

async function capture(page, canvas, fileName) {
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const client = await page.context().newCDPSession(page);
  try {
    await client.send("Page.bringToFront");
    const { data } = await Promise.race([
      client.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
        clip: {
          x: Math.max(0, Math.floor(box.x)),
          y: Math.max(0, Math.floor(box.y)),
          width: Math.floor(box.width),
          height: Math.floor(box.height),
          scale: 1,
        },
      }),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error(`Chromium compositor capture timed out for ${fileName}`)),
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

async function orbit(page, deltaX, deltaY = 0) {
  await page.evaluate(({ deltaX, deltaY }) => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!canvas) throw new Error("Three.js canvas is missing");
    const box = canvas.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const held = { bubbles: true, cancelable: true, pointerId: 73, pointerType: "mouse", button: 0, buttons: 1 };
    canvas.dispatchEvent(new PointerEvent("pointerdown", { ...held, clientX: x, clientY: y }));
    window.dispatchEvent(new PointerEvent("pointermove", { ...held, clientX: x + deltaX, clientY: y + deltaY }));
    window.dispatchEvent(new PointerEvent("pointerup", { ...held, clientX: x + deltaX, clientY: y + deltaY, buttons: 0 }));
  }, { deltaX, deltaY });
  await page.waitForTimeout(450);
}

async function setCamera(page, value) {
  await page.locator(".rr-view-select").selectOption(value);
  await page.waitForTimeout(700);
}

function insideViewport(name, box, viewport) {
  expect(box, `${name} must exist`).not.toBeNull();
  expect(box.left, `${name} left`).toBeGreaterThanOrEqual(-1);
  expect(box.top, `${name} top`).toBeGreaterThanOrEqual(-1);
  expect(box.right, `${name} right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.bottom, `${name} bottom`).toBeLessThanOrEqual(viewport.height + 1);
}

test("verifies CRJ, supplied A1 jetway, operator view and mobile layout in one airport load", async ({ page }) => {
  test.setTimeout(1_080_000);
  await page.setViewportSize(DESKTOP);
  const canvas = await launchRuntime(page);

  await page.waitForFunction(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    const deployment = Number(data?.a1JetwayDeployment);
    const actualGap = Number(data?.terminal4UploadedJetwayA1ActualDoorGapMeters);
    return data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayCount === "58"
      && data?.terminal4UploadedJetwayVerifiedModelCount === "58"
      && data?.terminal4UploadedJetwayArticulationAuthority === "user-supplied-airport-jetway-per-gate-telescoping-v10"
      && data?.terminal4UploadedJetwayA1PartOrderValid === "true"
      && Number.isFinite(actualGap)
      && actualGap <= 0.05
      && Number.isFinite(deployment)
      && deployment >= 0.995;
  }, null, { timeout: 180_000, polling: 100 });
  const attachedRuntime = await page.evaluate(() => ({
    ...document.querySelector("canvas.trainerCanvas").dataset,
  }));
  expect(attachedRuntime.a1JetwayState).toBe("attached-to-aircraft-door");
  expect(attachedRuntime.a1JetwayAnimationAuthority).toMatch(/v11$/);
  expect(attachedRuntime.terminal4UploadedJetwayCount).toBe("58");
  expect(attachedRuntime.terminal4UploadedJetwayVerifiedModelCount).toBe("58");
  expect(attachedRuntime.terminal4UploadedJetwayA1PartOrderValid).toBe("true");
  expect(Number(attachedRuntime.terminal4UploadedJetwayA1ActualDoorGapMeters)).toBeLessThanOrEqual(0.05);
  await withHiddenControls(page, () => capture(page, canvas, "a1-jetway-attached.png"));

  await withHiddenControls(page, async () => {
    await orbit(page, 220);
    await capture(page, canvas, "crj700-left-side.png");
  });

  await setCamera(page, "driver");
  await withHiddenControls(page, () => capture(page, canvas, "standup-operator-view.png"));
  await setCamera(page, "chase");

  await page.setViewportSize(MOBILE);
  await page.waitForTimeout(500);
  const layout = await page.evaluate(() => {
    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
    };
    const title = document.querySelector(".rr-hud h1");
    return {
      viewport: { width: innerWidth, height: innerHeight },
      canvas: rect("canvas.trainerCanvas"),
      hud: rect(".rr-hud"), metrics: rect(".rr-metrics"), throttle: rect(".rr-throttle"),
      steer: rect(".rr-steer"), slider: rect(".rr-power-slider"), menu: rect(".rr-session-menu"),
      inspectionToggle: rect(".rr-inspection-toggle"),
      title: title ? { text: title.textContent, clientWidth: title.clientWidth, scrollWidth: title.scrollWidth } : null,
    };
  });
  for (const name of ["hud", "metrics", "throttle", "steer", "slider", "menu", "inspectionToggle"]) {
    insideViewport(name, layout[name], layout.viewport);
  }
  expect(layout.canvas.width).toBeGreaterThanOrEqual(400);
  expect(layout.canvas.height).toBeGreaterThanOrEqual(890);
  expect(layout.slider.width).toBeGreaterThanOrEqual(120);
  expect(layout.title?.text).toBe("Complete visual equipment check");
  expect(layout.title?.scrollWidth).toBeLessThanOrEqual((layout.title?.clientWidth || 0) + 1);
  const before = Number(await canvas.getAttribute("data-camera-yaw"));
  await orbit(page, 120, -30);
  const after = Number(await canvas.getAttribute("data-camera-yaw"));
  expect(Number.isFinite(before) && Number.isFinite(after)).toBe(true);
  expect(Math.abs(after - before)).toBeGreaterThan(0.2);
  await capture(page, canvas, "mobile-simulator-layout.png");

  await page.setViewportSize(DESKTOP);
  await page.waitForTimeout(500);
  await setCamera(page, "chase");
  const ready = page.getByRole("button", { name: "Ready" });
  await ready.click();
  await page.waitForFunction(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return Number(data?.a1JetwayDeployment) <= 0.005
      && data?.a1JetwayState === "parked-clear-of-aircraft"
      && /parked-clear-of-aircraft|parked/.test(data?.a1JetwayStateHistory || "")
      && data?.terminal4A1RetractionAuthority === "aircraft-door-clearance-without-overtravel-v6"
      && data?.terminal4A1RetractionClearanceMeters === "2.38";
  }, null, { timeout: 180_000, polling: 100 });
  const parkedRuntime = await page.evaluate(() => ({
    ...document.querySelector("canvas.trainerCanvas").dataset,
  }));
  expect(Number(parkedRuntime.a1JetwayDeployment)).toBeLessThanOrEqual(0.005);
  expect(parkedRuntime.a1JetwayState).toBe("parked-clear-of-aircraft");
  expect(parkedRuntime.a1JetwayStateHistory).toMatch(/parked-clear-of-aircraft|parked/);
  expect(parkedRuntime.terminal4A1RetractionAuthority).toBe("aircraft-door-clearance-without-overtravel-v6");
  expect(parkedRuntime.terminal4A1RetractionClearanceMeters).toBe("2.38");
  await expect(page.getByText(/Jetway parked clear/i)).toBeVisible();
  await withHiddenControls(page, () => capture(page, canvas, "a1-jetway-parked.png"));
});
