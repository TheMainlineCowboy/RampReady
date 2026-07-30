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
  await expect.poll(
    () => canvas.getAttribute("data-environment-source"),
    { timeout: 40_000, intervals: [250, 500, 1_000] },
  ).toBe("authored-phx-terminal4-textured-source-jetways");
  await expect.poll(
    () => canvas.getAttribute("data-ground-source"),
    { timeout: 40_000, intervals: [250, 500, 1_000] },
  ).toBe("authored-kphx-v181-source-textured-nearfield");
  await expect.poll(
    () => canvas.getAttribute("data-photo-ground-source"),
    { timeout: 40_000, intervals: [250, 500, 1_000] },
  ).toBe("source-authored-phx-photo");
  await expect.poll(
    () => canvas.getAttribute("data-tug-source"),
    { timeout: 40_000, intervals: [250, 500, 1_000] },
  ).toBe("authored-standup");
  await expect.poll(
    () => canvas.getAttribute("data-operator-controls"),
    { timeout: 40_000, intervals: [250, 500, 1_000] },
  ).toBe("ready");
  await expect.poll(
    () => canvas.getAttribute("data-aircraft-source"),
    { timeout: 40_000, intervals: [250, 500, 1_000] },
  ).not.toBe("loading");
  await expect(canvas).toHaveAttribute("data-steering-mode", "rear");
  await expect(canvas).toHaveAttribute("data-operator-side", "right");

  const requested = (suffix) => responses.some((response) => {
    const pathname = new URL(response.url()).pathname;
    return pathname.endsWith(suffix) && response.status() === 200;
  });
  await expect.poll(
    () => MODEL_SUFFIXES.some(requested),
    { timeout: 30_000 },
  ).toBe(true);
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

async function hideControls(page) {
  await page.addStyleTag({
    content: `
      .rr-hud, .rr-metrics, .rr-score-float, .rr-guidance, .rr-diagnostics,
      .rr-steer, .rr-throttle { display: none !important; }
      .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
    `,
  });
  await page.waitForTimeout(300);
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

function insideViewport(name, box, viewport) {
  expect(box, `${name} must exist`).not.toBeNull();
  expect(box.left, `${name} left`).toBeGreaterThanOrEqual(-1);
  expect(box.top, `${name} top`).toBeGreaterThanOrEqual(-1);
  expect(box.right, `${name} right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.bottom, `${name} bottom`).toBeLessThanOrEqual(viewport.height + 1);
}

test("loads the real CRJ700 and authored PHX runtime", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize(DESKTOP);
  const canvas = await launchRuntime(page);
  await hideControls(page);
  await orbit(page, 220);
  await capture(page, canvas, "crj700-left-side.png");
  await orbit(page, -440);
  await capture(page, canvas, "crj700-right-side.png");
});

test("authored textured PHX Terminal 4 renders in chase view", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize(DESKTOP);
  const canvas = await launchRuntime(page);
  await page.evaluate(() => {
    document.querySelector("canvas.trainerCanvas")?.dispatchEvent(
      new WheelEvent("wheel", { deltaY: 1800, bubbles: true, cancelable: true }),
    );
  });
  await hideControls(page);
  await capture(page, canvas, "phx-terminal4-authored-textured.png");
});

test("stand-up operator view contains the dedicated controls", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize(DESKTOP);
  const canvas = await launchRuntime(page);
  const view = page.locator(".rr-view-select");
  await view.selectOption("driver");
  await expect(view).toHaveValue("driver");
  await page.waitForTimeout(900);
  await hideControls(page);
  await capture(page, canvas, "standup-operator-view.png");
});

test("A1 jetway starts attached and parks before tug approach", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize(DESKTOP);
  const canvas = await launchRuntime(page);

  await expect.poll(
    async () => Number(await canvas.getAttribute("data-a1-jetway-deployment")),
    { timeout: 20_000, intervals: [100, 250, 500] },
  ).toBeGreaterThanOrEqual(0.995);
  await expect(canvas).toHaveAttribute("data-a1-jetway-state", "attached");
  await expect.poll(
    () => canvas.getAttribute("data-a1-jetway-animation-authority"),
    { timeout: 20_000 },
  ).toContain("independent-source-scale");
  await capture(page, canvas, "a1-jetway-attached.png");

  const ready = page.getByRole("button", { name: "Ready" });
  await expect(ready).toBeVisible();
  await ready.click();
  await expect(page.getByText(/Jetway departure sequence active/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Complete visual equipment check" })).toBeVisible();

  const observedStates = new Set(["attached"]);
  await expect.poll(
    async () => {
      const state = await canvas.getAttribute("data-a1-jetway-state");
      if (state) observedStates.add(state);
      return Number(await canvas.getAttribute("data-a1-jetway-deployment"));
    },
    { timeout: 20_000, intervals: [50, 75, 100] },
  ).toBeLessThanOrEqual(0.005);
  await expect(canvas).toHaveAttribute("data-a1-jetway-state", "parked");
  await expect(page.getByText(/Jetway parked clear/i)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Align the capture head with the nose gear" })).toBeVisible();
  expect([...observedStates].some((state) => ["hood-clear", "telescoping", "rotating-to-park", "retracting"].includes(state))).toBe(true);
  await capture(page, canvas, "a1-jetway-parked.png");
});

test("free-drive inspection toggle moves the tug forward and reverse without procedure gates", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize(DESKTOP);
  const canvas = await launchRuntime(page);
  const toggle = page.getByRole("button", { name: "Free-drive inspection" });
  await expect(toggle).toBeVisible();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".rr-shell")).toHaveAttribute("data-inspection-mode", "active");
  await expect(canvas).toHaveAttribute("data-inspection-mode", "active");
  await expect.poll(
    async () => Number(await canvas.getAttribute("data-a1-jetway-deployment")),
    { timeout: 10_000 },
  ).toBeLessThanOrEqual(0.005);
  await expect(canvas).toHaveAttribute("data-a1-jetway-state", "parked");

  const start = await canvas.evaluate((element) => ({
    x: Number(element.dataset.inspectionTugX),
    z: Number(element.dataset.inspectionTugZ),
  }));
  await page.keyboard.down("w");
  await page.waitForTimeout(1_200);
  await page.keyboard.up("w");
  const forward = await canvas.evaluate((element) => ({
    x: Number(element.dataset.inspectionTugX),
    z: Number(element.dataset.inspectionTugZ),
    speed: Number(element.dataset.inspectionSpeed),
  }));
  expect(Math.hypot(forward.x - start.x, forward.z - start.z)).toBeGreaterThan(0.25);
  expect(forward.speed).toBeGreaterThanOrEqual(0);

  await page.keyboard.down("s");
  await page.waitForTimeout(1_200);
  await page.keyboard.up("s");
  const reverse = await canvas.evaluate((element) => ({
    x: Number(element.dataset.inspectionTugX),
    z: Number(element.dataset.inspectionTugZ),
  }));
  expect(Math.hypot(reverse.x - forward.x, reverse.z - forward.z)).toBeGreaterThan(0.15);
  await capture(page, canvas, "free-drive-inspection-active.png");
});

test("mobile controls remain inside the simulator viewport", async ({ page }) => {
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
    return {
      viewport: { width: innerWidth, height: innerHeight },
      canvas: rect("canvas.trainerCanvas"),
      hud: rect(".rr-hud"), metrics: rect(".rr-metrics"), throttle: rect(".rr-throttle"),
      steer: rect(".rr-steer"), slider: rect(".rr-power-slider"), menu: rect(".rr-session-menu"),
      inspectionToggle: rect(".rr-inspection-toggle"),
    };
  });
  for (const name of ["hud", "metrics", "throttle", "steer", "slider", "menu", "inspectionToggle"]) {
    insideViewport(name, layout[name], layout.viewport);
  }
  expect(layout.canvas.width).toBeGreaterThanOrEqual(400);
  expect(layout.canvas.height).toBeGreaterThanOrEqual(890);
  expect(layout.slider.width).toBeGreaterThanOrEqual(120);
  const before = Number(await canvas.getAttribute("data-camera-yaw"));
  await orbit(page, 120, -30);
  const after = Number(await canvas.getAttribute("data-camera-yaw"));
  expect(Number.isFinite(before) && Number.isFinite(after)).toBe(true);
  expect(Math.abs(after - before)).toBeGreaterThan(0.2);
  await capture(page, canvas, "mobile-simulator-layout.png");
});
