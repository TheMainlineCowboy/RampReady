import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";

async function launchStandup(page) {
  await page.goto(TARGET_URL, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  await page.getByRole("radio", { name: /Stand-up pushback/i }).click();
  const launch = page.getByRole("button", { name: "Start training" });
  await expect(launch).toBeEnabled();
  await launch.click();
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toBeVisible();
  return canvas;
}

async function frameA1Chase(page, canvas) {
  await page.evaluate(() => {
    const liveCanvas = document.querySelector("canvas.trainerCanvas");
    if (!liveCanvas) throw new Error("Three.js canvas is missing for PHX evidence framing");
    liveCanvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 1600, bubbles: true, cancelable: true }));
    const box = liveCanvas.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const held = { bubbles: true, cancelable: true, pointerId: 81, pointerType: "mouse", button: 0, buttons: 1 };
    liveCanvas.dispatchEvent(new PointerEvent("pointerdown", { ...held, clientX: x, clientY: y }));
    window.dispatchEvent(new PointerEvent("pointermove", { ...held, clientX: x + 180, clientY: y - 25 }));
    window.dispatchEvent(new PointerEvent("pointerup", { ...held, clientX: x + 180, clientY: y - 25, buttons: 0 }));
  });
  await page.waitForTimeout(1_000);
  await page.addStyleTag({
    content: `
      .rr-hud, .rr-metrics, .rr-score-float, .rr-guidance, .rr-diagnostics,
      .rr-steer, .rr-throttle { display: none !important; }
      .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
    `,
  });
  await page.waitForTimeout(1_200);
  await expect(canvas).toBeVisible();
}

async function captureCanvas(page, canvas, fileName) {
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
}

test("isolates the pre-server PHX source aerial tile layer in the A1 chase view", async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  const runtimeErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const canvas = await launchStandup(page);
  await expect.poll(
    async () => canvas.getAttribute("data-environment-source"),
    { timeout: 90_000, intervals: [500, 1_000, 2_000] },
  ).toBe("authored-phx-terminal4-textured-source-jetways");
  await expect.poll(
    async () => canvas.getAttribute("data-photo-ground-source"),
    { timeout: 90_000, intervals: [500, 1_000, 2_000] },
  ).toBe("source-authored-phx-photo");

  const relevantErrors = runtimeErrors.filter((message) =>
    /KPHX ground load failed|PHX airport ground failed to load|PHX source aerial load failed|source aerial failed to load|WebGL.*shader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);

  await frameA1Chase(page, canvas);
  await captureCanvas(page, canvas, "kphx-ground-diagnostic-source-aerial-hidden-pre-server.png");
});