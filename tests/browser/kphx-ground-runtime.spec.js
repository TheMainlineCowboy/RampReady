import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const SOURCE_ASSETS = [
  "/models/kphx-ground/kphx-ground.gltf",
  "/models/kphx-ground/kphx-ground.bin",
  "/models/kphx-photo/photo-manifest.json",
  "/models/phx-terminal4/terminal4.gltf",
  "/models/phx-terminal4/terminal4.bin",
  "/models/phx-terminal4/texture-manifest.json",
  "/models/phx-terminal4/textures/BGATE1.png",
  "/models/phx-terminal4/textures/PARKRAMPS.png",
  "/models/phx-terminal4/textures/PARKRAMP1.png",
  "/models/phx-terminal4/textures/PHX_TERM400_0.png",
  "/models/phx-terminal4/textures/PHX_TERM400_1.png",
  "/models/phx-terminal4/textures/RW.png",
  "/models/airport-jetway/geometry.part0",
  "/models/airport-jetway/geometry.part1",
  "/models/airport-jetway/geometry.part2",
  "/models/airport-jetway/geometry.part3",
  "/models/airport-jetway/geometry.part4",
];

async function launchStandup(page) {
  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  await page.getByRole("radio", { name: /Stand-up pushback/i }).click();
  await page.getByRole("button", { name: "Start training" }).click();
  const canvas = page.locator("canvas.trainerCanvas");
  await expect(canvas).toBeVisible();
  return canvas;
}

async function captureCanvas(page, canvas, fileName) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
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
          x: Math.max(0, box.x),
          y: Math.max(0, box.y),
          width: Math.max(1, box.width),
          height: Math.max(1, box.height),
          scale: 1,
        },
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error(`Capture timed out: ${fileName}`)), 45_000)),
    ]);
    const image = Buffer.from(data, "base64");
    expect(image.byteLength).toBeGreaterThan(50_000);
    await writeFile(`test-results/${fileName}`, image);
  } finally {
    await client.detach();
  }
}

async function orbit(page, deltaX, deltaY = 0, wheel = 0) {
  await page.evaluate(({ deltaX, deltaY, wheel }) => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!canvas) throw new Error("Three.js canvas is missing");
    if (wheel) canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: wheel, bubbles: true, cancelable: true }));
    const box = canvas.getBoundingClientRect();
    const x = box.left + box.width / 2;
    const y = box.top + box.height / 2;
    const held = { bubbles: true, cancelable: true, pointerId: 81, pointerType: "mouse", button: 0, buttons: 1 };
    canvas.dispatchEvent(new PointerEvent("pointerdown", { ...held, clientX: x, clientY: y }));
    window.dispatchEvent(new PointerEvent("pointermove", { ...held, clientX: x + deltaX, clientY: y + deltaY }));
    window.dispatchEvent(new PointerEvent("pointerup", { ...held, clientX: x + deltaX, clientY: y + deltaY, buttons: 0 }));
  }, { deltaX, deltaY, wheel });
  await page.waitForTimeout(900);
}

async function hideControls(page) {
  await page.addStyleTag({
    content: `
      .rr-hud, .rr-metrics, .rr-score-float, .rr-guidance, .rr-diagnostics,
      .rr-steer, .rr-throttle { display: none !important; }
      .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
    `,
  });
  await page.waitForTimeout(800);
}

test("renders supplied Terminal 4 and all 58 source-placed supplied jetways without generated fill", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const responses = [];
  const runtimeErrors = [];
  page.on("response", (response) => responses.push(response));
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  const canvas = await launchStandup(page);
  for (const [attribute, expected] of [
    ["data-environment-source", "authored-phx-terminal4-textured-source-jetways"],
    ["data-ground-source", "authored-kphx-v181-source-textured-nearfield"],
    ["data-photo-ground-source", "source-authored-phx-photo"],
    ["data-terminal4-jetway-source-geometry-mode", "user-supplied-airport-jetway-source-geometry-v1"],
    ["data-terminal4-jetway-source-scale-authority", "supplied-model-native-scale-no-runtime-rescaling"],
    ["data-terminal4-jetway-texture-authority", "supplied-material-slots-no-projected-terminal-atlas"],
    ["data-terminal4-exact-jetway-texture-active", "false"],
    ["data-terminal4-facade-infill-count", "0"],
    ["data-terminal4-lower-facade-fit-count", "0"],
    ["data-terminal4-open-service-bay-count", "0"],
    ["data-terminal4-terminal-connected-jetway-count", "58"],
    ["data-terminal4-jetway-initial-state", "source-authored-deployed-state"],
    ["data-terminal4-jetway-pre-push-sequence", "retract-supplied-telescoping-nodes"],
    ["data-a1-jetway-animation-authority", "supplied-node-telescope-axis-only"],
    ["data-steering-mode", "rear"],
    ["data-ground-marking-contact-mode", "pavement-coincident-decals"],
  ]) {
    await expect.poll(
      () => canvas.getAttribute(attribute),
      { timeout: 120_000, intervals: [250, 500, 1_000] },
    ).toBe(expected);
  }

  const runtime = await canvas.evaluate((element) => ({ ...element.dataset }));
  expect(runtime.kphxVersion).toBe("1.8.1");
  expect(runtime.terminal4JetwayCount).toBe("58");
  expect(runtime.terminal4ParkingCount).toBe("58");
  expect(runtime.terminal4TextureCount).toBe("17");
  expect(runtime.terminal4ExactTextureCount).toBe("17");
  expect(runtime.terminal4FallbackTextureCount).toBe("0");
  expect(runtime.terminal4A1JetwayWallDistance).toBe("missing");
  expect(runtime.terminal4RequiresOriginalJetwayMesh).toBe("false");
  expect(runtime.b15Anchors).toBe("ready");
  expect(runtime.photoRuntimeTileCount).toBe("21");
  expect(runtime.photoTileCount).toBe("199");

  for (const suffix of SOURCE_ASSETS) {
    await expect.poll(
      () => responses.some((response) => new URL(response.url()).pathname.endsWith(suffix) && response.status() === 200),
      { timeout: 30_000, intervals: [250, 500] },
    ).toBe(true);
  }
  const forbiddenRequests = responses
    .map((response) => new URL(response.url()).pathname)
    .filter((pathname) => /M1DGJETWAY(?:_LM)?\.png$/i.test(pathname));
  expect(forbiddenRequests).toEqual([]);

  const relevantErrors = runtimeErrors.filter((message) =>
    /PHX Terminal 4 failed to load|PHX airport ground failed to load|PHX source aerial failed to load|Supplied airport jetway fleet failed|GLTFLoader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);

  await hideControls(page);
  await orbit(page, 180, -25, 1200);
  await captureCanvas(page, canvas, "kphx-a1-supplied-jetway-chase.png");

  await page.locator("button.rr-inspection-toggle").click();
  const location = page.getByLabel("Inspection location");
  await location.selectOption("b15");
  await expect(canvas).toHaveAttribute("data-inspection-preset", "b15");
  await page.locator("select.rr-view-select").selectOption("chase");
  await orbit(page, -160, -20, 800);
  await captureCanvas(page, canvas, "kphx-b15-supplied-jetway-chase.png");

  await page.locator("select.rr-view-select").selectOption("overhead");
  await page.waitForTimeout(900);
  await captureCanvas(page, canvas, "kphx-b15-supplied-jetway-overhead.png");
});
