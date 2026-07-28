import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const GROUND_SUFFIXES = ["/models/kphx-ground/kphx-ground.gltf", "/models/kphx-ground/kphx-ground.bin"];

async function launchStandup(page) {
  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  const standup = page.getByRole("radio", { name: /Stand-up pushback/i });
  await standup.click();
  const launch = page.getByRole("button", { name: "Start training" });
  await expect(launch).toBeEnabled();
  await launch.click();
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toBeVisible();
  return canvas;
}

test("loads the authored airport-wide KPHX ADEX ground", async ({ page }) => {
  test.setTimeout(90_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const groundResponses = [];
  const runtimeErrors = [];
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (GROUND_SUFFIXES.some((suffix) => pathname.endsWith(suffix))) groundResponses.push(response);
  });
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const canvas = await launchStandup(page);
  await expect.poll(
    async () => canvas.getAttribute("data-ground-source"),
    { timeout: 30_000, intervals: [250, 500, 1_000] },
  ).toBe("authored-kphx-adex-ground");

  for (const suffix of GROUND_SUFFIXES) {
    await expect.poll(
      () => groundResponses.some((response) => new URL(response.url()).pathname.endsWith(suffix) && response.status() === 200),
      { timeout: 20_000 },
    ).toBe(true);
  }

  const entries = await page.evaluate((suffixes) => suffixes.map((suffix) => {
    const entry = performance.getEntriesByType("resource")
      .find((resource) => new URL(resource.name).pathname.endsWith(suffix));
    return entry ? { suffix, decodedBodySize: entry.decodedBodySize, transferSize: entry.transferSize } : null;
  }), GROUND_SUFFIXES);
  expect(entries.every(Boolean)).toBe(true);
  expect(Math.max(entries[0].decodedBodySize, entries[0].transferSize)).toBeGreaterThan(1_000);
  expect(Math.max(entries[1].decodedBodySize, entries[1].transferSize)).toBeGreaterThan(500_000);

  const relevantErrors = runtimeErrors.filter((message) =>
    /KPHX ground load failed|PHX airport ground failed to load|GLTFLoader|WebGL.*shader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);

  await page.addStyleTag({
    content: `
      .rr-hud, .rr-metrics, .rr-score-float, .rr-guidance, .rr-diagnostics,
      .rr-steer, .rr-throttle { display: none !important; }
      .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
    `,
  });
  await page.evaluate(() => {
    const element = document.querySelector("canvas.trainerCanvas");
    element?.dispatchEvent(new WheelEvent("wheel", { deltaY: 1800, bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(700);
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
  expect(image.byteLength).toBeGreaterThan(5_000);
  await writeFile("test-results/kphx-ground-authored.png", image);
});
