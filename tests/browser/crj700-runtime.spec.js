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
const HIDDEN_CONTROLS_STYLE_ID = "rr-browser-evidence-hidden-controls";

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

  await page.waitForFunction(() => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    const data = canvas?.dataset;
    const deployment = Number(data?.a1JetwayDeployment);
    const actualGap = Number(data?.terminal4UploadedJetwayA1ActualDoorGapMeters);
    return Boolean(canvas)
      && data?.environmentSource === "authored-phx-terminal4-textured-source-jetways"
      && data?.groundSource === "authored-kphx-v181-source-textured-nearfield"
      && data?.photoGroundSource === "source-authored-phx-photo"
      && data?.tugSource === "authored-standup"
      && data?.operatorControls === "ready"
      && data?.aircraftSource !== "loading"
      && data?.steeringMode === "rear"
      && data?.operatorSide === "right"
      && data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayCount === "58"
      && data?.terminal4UploadedJetwayVerifiedModelCount === "58"
      && data?.terminal4UploadedJetwayArticulationAuthority === "user-supplied-airport-jetway-per-gate-telescoping-v11-a1-only"
      && data?.terminal4UploadedJetwayA1PartOrderValid === "true"
      && Number.isFinite(actualGap)
      && actualGap <= 0.05
      && Number.isFinite(deployment)
      && deployment >= 0.995;
  }, null, { timeout: 300_000, polling: 100 });

  const snapshot = await page.evaluate(() => ({
    runtime: { ...document.querySelector("canvas.trainerCanvas").dataset },
    title: document.querySelector(".rr-hud h1")?.textContent || "",
  }));

  expect(snapshot.runtime.environmentSource).toBe("authored-phx-terminal4-textured-source-jetways");
  expect(snapshot.runtime.groundSource).toBe("authored-kphx-v181-source-textured-nearfield");
  expect(snapshot.runtime.photoGroundSource).toBe("source-authored-phx-photo");
  expect(snapshot.runtime.tugSource).toBe("authored-standup");
  expect(snapshot.runtime.operatorControls).toBe("ready");
  expect(snapshot.runtime.aircraftSource).not.toBe("loading");
  expect(snapshot.runtime.steeringMode).toBe("rear");
  expect(snapshot.runtime.operatorSide).toBe("right");
  expect(snapshot.runtime.a1JetwayState).toBe("attached-to-aircraft-door");
  expect(snapshot.runtime.a1JetwayAnimationAuthority).toMatch(/v11$/);
  expect(snapshot.runtime.terminal4UploadedJetwayCount).toBe("58");
  expect(snapshot.runtime.terminal4UploadedJetwayVerifiedModelCount).toBe("58");
  expect(snapshot.runtime.terminal4UploadedJetwayA1PartOrderValid).toBe("true");
  expect(Number(snapshot.runtime.terminal4UploadedJetwayA1ActualDoorGapMeters)).toBeLessThanOrEqual(0.05);

  const requested = (suffix) => responses.some((response) => {
    const pathname = new URL(response.url()).pathname;
    return pathname.endsWith(suffix) && response.status() === 200;
  });
  expect(MODEL_SUFFIXES.some(requested)).toBe(true);
  expect(requested(STANDUP_SUFFIX)).toBe(true);
  for (const suffix of TERMINAL_SUFFIXES) expect(requested(suffix)).toBe(true);

  const relevantErrors = errors.filter((message) =>
    /CRJ700 asset load failed|Equipment model failed to load|PHX Terminal 4 failed to load|PHX airport ground failed to load|PHX source aerial failed to load|GLTFLoader|WebGL.*shader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);
  return { errors, snapshot };
}

async function sceneAction(page, action = {}) {
  return page.evaluate(async ({ action, styleId }) => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Three.js canvas is missing");

    const settleFrames = async (count) => {
      for (let index = 0; index < count; index += 1) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
      }
    };

    if (typeof action.hideControls === "boolean") {
      const existing = document.getElementById(styleId);
      if (action.hideControls && !existing) {
        const style = document.createElement("style");
        style.id = styleId;
        style.textContent = `
          .rr-hud, .rr-metrics, .rr-score-float, .rr-guidance, .rr-diagnostics,
          .rr-steer, .rr-throttle { display: none !important; }
          .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
        `;
        document.head.appendChild(style);
      } else if (!action.hideControls && existing) {
        existing.remove();
      }
    }

    if (action.camera) {
      const select = document.querySelector('select[aria-label="Camera view"]');
      if (!(select instanceof HTMLSelectElement)) throw new Error("Camera view selector is missing");
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      if (!setter) throw new Error("Native camera selector setter is unavailable");
      setter.call(select, action.camera);
      select.dispatchEvent(new Event("input", { bubbles: true }));
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }

    let beforeYaw = Number(canvas.dataset.cameraYaw);
    if (action.orbit) {
      const box = canvas.getBoundingClientRect();
      const x = box.left + box.width / 2;
      const y = box.top + box.height / 2;
      const held = {
        bubbles: true,
        cancelable: true,
        pointerId: 73,
        pointerType: "mouse",
        button: 0,
        buttons: 1,
      };
      canvas.dispatchEvent(new PointerEvent("pointerdown", { ...held, clientX: x, clientY: y }));
      window.dispatchEvent(new PointerEvent("pointermove", {
        ...held,
        clientX: x + action.orbit.deltaX,
        clientY: y + (action.orbit.deltaY || 0),
      }));
      window.dispatchEvent(new PointerEvent("pointerup", {
        ...held,
        clientX: x + action.orbit.deltaX,
        clientY: y + (action.orbit.deltaY || 0),
        buttons: 0,
      }));
    }

    await settleFrames(action.frames || 6);
    const afterYaw = Number(canvas.dataset.cameraYaw);

    const rect = (selector) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        top: box.top,
        right: box.right,
        bottom: box.bottom,
        left: box.left,
        width: box.width,
        height: box.height,
      };
    };
    const title = document.querySelector(".rr-hud h1");
    return {
      beforeYaw,
      afterYaw,
      runtime: { ...canvas.dataset },
      layout: action.readLayout ? {
        viewport: { width: innerWidth, height: innerHeight },
        canvas: rect("canvas.trainerCanvas"),
        hud: rect(".rr-hud"),
        metrics: rect(".rr-metrics"),
        throttle: rect(".rr-throttle"),
        steer: rect(".rr-steer"),
        slider: rect(".rr-power-slider"),
        menu: rect(".rr-session-menu"),
        inspectionToggle: rect(".rr-inspection-toggle"),
        title: title ? {
          text: title.textContent,
          clientWidth: title.clientWidth,
          scrollWidth: title.scrollWidth,
        } : null,
      } : null,
    };
  }, { action, styleId: HIDDEN_CONTROLS_STYLE_ID });
}

async function parkJetway(page) {
  return page.evaluate(async () => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Three.js canvas is missing");

    const cameraSelect = document.querySelector('select[aria-label="Camera view"]');
    if (!(cameraSelect instanceof HTMLSelectElement)) throw new Error("Camera view selector is missing");
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error("Native camera selector setter is unavailable");
    setter.call(cameraSelect, "chase");
    cameraSelect.dispatchEvent(new Event("input", { bubbles: true }));
    cameraSelect.dispatchEvent(new Event("change", { bubbles: true }));

    const ready = Array.from(document.querySelectorAll("button"))
      .find((button) => button.textContent?.trim() === "Ready");
    if (!(ready instanceof HTMLButtonElement)) throw new Error("Ready button is missing");
    ready.click();

    const deadline = performance.now() + 300_000;
    while (performance.now() < deadline) {
      const data = canvas.dataset;
      if (Number(data.a1JetwayDeployment) <= 0.005
        && data.a1JetwayState === "parked-clear-of-aircraft"
        && /parked-clear-of-aircraft|parked/.test(data.a1JetwayStateHistory || "")
        && data.terminal4A1RetractionAuthority === "aircraft-door-clearance-without-overtravel-v6"
        && data.terminal4A1RetractionClearanceMeters === "2.38") {
        return {
          runtime: { ...data },
          message: document.querySelector(".rr-hud p")?.textContent || "",
        };
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Jetway did not park within the browser deadline: ${JSON.stringify({ ...canvas.dataset })}`);
  });
}

async function captureViewport(client, viewport, fileName) {
  const { data } = await Promise.race([
    client.send("Page.captureScreenshot", {
      format: "png",
      fromSurface: true,
      captureBeyondViewport: false,
      clip: {
        x: 0,
        y: 0,
        width: viewport.width,
        height: viewport.height,
        scale: 1,
      },
    }),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error(`Chromium compositor capture timed out for ${fileName}`)),
      90_000,
    )),
  ]);
  const image = Buffer.from(data, "base64");
  expect(image.byteLength).toBeGreaterThan(viewport.width < 600 ? 30_000 : 50_000);
  await writeFile(`test-results/${fileName}`, image);
}

function insideViewport(name, box, viewport) {
  expect(box, `${name} must exist`).not.toBeNull();
  expect(box.left, `${name} left`).toBeGreaterThanOrEqual(-1);
  expect(box.top, `${name} top`).toBeGreaterThanOrEqual(-1);
  expect(box.right, `${name} right`).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.bottom, `${name} bottom`).toBeLessThanOrEqual(viewport.height + 1);
}

test("verifies CRJ, supplied A1 jetway, operator view and mobile layout in one airport load", async ({ page }) => {
  test.setTimeout(1_500_000);
  await page.setViewportSize(DESKTOP);
  const { errors, snapshot } = await launchRuntime(page);
  expect(snapshot.title).toBe("Complete visual equipment check");

  const client = await page.context().newCDPSession(page);
  try {
    await client.send("Page.bringToFront");

    await sceneAction(page, { hideControls: true, frames: 6 });
    await captureViewport(client, DESKTOP, "a1-jetway-attached.png");

    await sceneAction(page, { orbit: { deltaX: 220, deltaY: 0 }, frames: 6 });
    await captureViewport(client, DESKTOP, "crj700-left-side.png");

    await sceneAction(page, { camera: "driver", frames: 8 });
    await captureViewport(client, DESKTOP, "standup-operator-view.png");

    await page.setViewportSize(MOBILE);
    const mobile = await sceneAction(page, {
      hideControls: false,
      camera: "chase",
      orbit: { deltaX: 120, deltaY: -30 },
      readLayout: true,
      frames: 8,
    });
    const layout = mobile.layout;
    for (const name of ["hud", "metrics", "throttle", "steer", "slider", "menu", "inspectionToggle"]) {
      insideViewport(name, layout[name], layout.viewport);
    }
    expect(layout.canvas.width).toBeGreaterThanOrEqual(400);
    expect(layout.canvas.height).toBeGreaterThanOrEqual(890);
    expect(layout.slider.width).toBeGreaterThanOrEqual(120);
    expect(layout.title?.text).toBe("Complete visual equipment check");
    expect(layout.title?.scrollWidth).toBeLessThanOrEqual((layout.title?.clientWidth || 0) + 1);
    expect(Number.isFinite(mobile.beforeYaw) && Number.isFinite(mobile.afterYaw)).toBe(true);
    expect(Math.abs(mobile.afterYaw - mobile.beforeYaw)).toBeGreaterThan(0.2);
    await captureViewport(client, MOBILE, "mobile-simulator-layout.png");

    await page.setViewportSize(DESKTOP);
    const parked = await parkJetway(page);
    expect(Number(parked.runtime.a1JetwayDeployment)).toBeLessThanOrEqual(0.005);
    expect(parked.runtime.a1JetwayState).toBe("parked-clear-of-aircraft");
    expect(parked.runtime.a1JetwayStateHistory).toMatch(/parked-clear-of-aircraft|parked/);
    expect(parked.runtime.terminal4A1RetractionAuthority).toBe("aircraft-door-clearance-without-overtravel-v6");
    expect(parked.runtime.terminal4A1RetractionClearanceMeters).toBe("2.38");
    expect(parked.message).toMatch(/Jetway (parked clear|departure sequence active)/i);
    await sceneAction(page, { hideControls: true, frames: 6 });
    await captureViewport(client, DESKTOP, "a1-jetway-parked.png");
  } finally {
    await client.detach();
  }

  const relevantErrors = errors.filter((message) =>
    /CRJ700 asset load failed|Equipment model failed to load|PHX Terminal 4 failed to load|PHX airport ground failed to load|PHX source aerial failed to load|GLTFLoader|WebGL.*shader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);
});
