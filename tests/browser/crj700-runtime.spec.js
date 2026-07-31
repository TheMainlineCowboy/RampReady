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
  const image = await page.screenshot({
    type: "png",
    clip: {
      x: Math.max(0, Math.floor(box.x)),
      y: Math.max(0, Math.floor(box.y)),
      width: Math.floor(box.width),
      height: Math.floor(box.height),
    },
    animations: "disabled",
  });
  expect(image.byteLength).toBeGreaterThan(50_000);
  await writeFile(`test-results/${fileName}`, image);
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

function expectOrderedSequence(history, requiredStates) {
  let previousIndex = -1;
  for (const state of requiredStates) {
    const index = history.indexOf(state);
    expect(index, `A1 sequence must include ${state}`).toBeGreaterThan(previousIndex);
    previousIndex = index;
  }
}

test("verifies CRJ, A1 jetway, operator view and free-drive in one full-airport load", async ({ page }) => {
  test.setTimeout(900_000);
  await page.setViewportSize(DESKTOP);
  const canvas = await launchRuntime(page);

  await expect.poll(
    async () => Number(await canvas.getAttribute("data-a1-jetway-deployment")),
    { timeout: 20_000, intervals: [100, 250, 500] },
  ).toBeGreaterThanOrEqual(0.995);
  await expect(canvas).toHaveAttribute("data-a1-jetway-state", "attached");
  await expect(canvas).toHaveAttribute("data-a1-jetway-animation-authority", /v11$/);
  await withHiddenControls(page, () => capture(page, canvas, "a1-jetway-attached.png"));

  await withHiddenControls(page, async () => {
    await orbit(page, 220);
    await capture(page, canvas, "crj700-left-side.png");
    await orbit(page, -440);
    await capture(page, canvas, "crj700-right-side.png");
    await page.evaluate(() => document.querySelector("canvas.trainerCanvas")?.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 1800, bubbles: true, cancelable: true }),
    ));
    await page.waitForTimeout(500);
    await capture(page, canvas, "phx-terminal4-authored-textured.png");
  });

  await setCamera(page, "driver");
  await withHiddenControls(page, () => capture(page, canvas, "standup-operator-view.png"));
  await setCamera(page, "chase");

  const ready = page.getByRole("button", { name: "Ready" });
  await ready.click();
  await expect.poll(
    async () => Number(await canvas.getAttribute("data-a1-jetway-deployment")),
    { timeout: 30_000, intervals: [50, 75, 100, 250] },
  ).toBeLessThanOrEqual(0.005);
  await expect(canvas).toHaveAttribute("data-a1-jetway-state", "parked");
  await expect(page.getByText(/Jetway parked clear/i)).toBeVisible();
  const sequenceHistory = (await canvas.getAttribute("data-a1-jetway-state-history") || "")
    .split(",")
    .filter(Boolean);
  expectOrderedSequence(sequenceHistory, [
    "attached",
    "retracting",
    "hood-clear",
    "telescoping",
    "rotating-to-park",
    "parked",
  ]);
  await withHiddenControls(page, () => capture(page, canvas, "a1-jetway-parked.png"));

  const toggle = page.locator("button.rr-inspection-toggle");
  await expect(toggle).toHaveText("Free-drive inspection");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(toggle).toHaveText("Return to training");
  const start = await canvas.evaluate((element) => ({ x: Number(element.dataset.inspectionTugX), z: Number(element.dataset.inspectionTugZ) }));
  await page.keyboard.down("w");
  await page.waitForTimeout(1_200);
  await page.keyboard.up("w");
  const forward = await canvas.evaluate((element) => ({ x: Number(element.dataset.inspectionTugX), z: Number(element.dataset.inspectionTugZ) }));
  expect(Math.hypot(forward.x - start.x, forward.z - start.z)).toBeGreaterThan(0.25);
  await page.keyboard.down("s");
  await page.waitForTimeout(1_200);
  await page.keyboard.up("s");
  const reverse = await canvas.evaluate((element) => ({ x: Number(element.dataset.inspectionTugX), z: Number(element.dataset.inspectionTugZ) }));
  expect(Math.hypot(reverse.x - forward.x, reverse.z - forward.z)).toBeGreaterThan(0.15);
  await withHiddenControls(page, () => capture(page, canvas, "free-drive-inspection-active.png"));
});

test("mobile controls and full step title remain inside one simulator viewport", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize(MOBILE);
  const canvas = await launchRuntime(page);
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
});
