import fs from "node:fs";
import { expect, test } from "@playwright/test";

const CLOSURE_AUTHORITY = "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3";
const TARGET_AUTHORITY = "placement-bridgeEnd-shared-with-static-articulation-v1";
const EVIDENCE_AUTHORITY = "57-static-cab-endpoints-opaque-zero-open-area-no-authored-transform-v1";
const PRESETS = Object.freeze([
  ["a14", "test-results/terminal4-static-a14-cab-closure.png"],
  ["b14", "test-results/terminal4-static-b14-cab-closure.png"],
  ["b15", "test-results/terminal4-static-b15-cab-closure.png"],
]);

async function captureCanvas(page, path) {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Three.js canvas is missing");
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
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
          width: Math.max(1, Math.min(box.width, 1440 - Math.max(0, box.x))),
          height: Math.max(1, Math.min(box.height, 900 - Math.max(0, box.y))),
          scale: 1,
        },
      }),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error("Terminal 4 static Cab evidence capture exceeded 75 seconds")),
        75_000,
      )),
    ]);
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync(path, Buffer.from(data, "base64"));
    expect(fs.statSync(path).size).toBeGreaterThan(50_000);
  } finally {
    await client.detach();
  }
}

async function selectPreset(page, preset) {
  await page.evaluate((nextPreset) => {
    const select = document.querySelector('select[aria-label="Inspection location"]');
    if (!(select instanceof HTMLSelectElement)) throw new Error("Inspection location selector is missing");
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error("Native inspection selector setter is unavailable");
    setter.call(select, nextPreset);
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, preset);
  await page.waitForFunction((expected) => (
    document.querySelector("canvas.trainerCanvas")?.dataset.inspectionPreset === expected
  ), preset, { timeout: 30_000, polling: 100 });
  await page.waitForTimeout(2_000);
}

test("all 57 parked Terminal 4 jetways have opaque Cab closures at exact articulation targets", async ({ page }) => {
  test.setTimeout(780_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({ closureAuthority, targetAuthority, evidenceAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayStaticCabClosureAuthority === closureAuthority
      && data?.terminal4UploadedJetwayStaticCabTargetAuthority === targetAuthority
      && Number(data?.terminal4UploadedJetwayStaticBridgeEndFallbackCount) === 0
      && data?.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority === evidenceAuthority
      && Number(data?.terminal4UploadedJetwayStaticCabClosurePanelCount) === 57
      && Number(data?.terminal4UploadedJetwayStaticCabClosureWindowCount) === 57
      && Number(data?.terminal4UploadedJetwayStaticCabClosureSurroundPieceCount) === 228
      && Number(data?.terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount) === 0
      && Math.abs(Number(data?.terminal4UploadedJetwayStaticCabClosureDepthMeters) - 1.45) <= 1e-6
      && Math.abs(Number(data?.terminal4UploadedJetwayStaticApronFacingOpenAreaMeters)) <= 1e-9
      && Number(data?.terminal4UploadedJetwayStaticArticulatedGateCount) === 57
      && Number(data?.terminal4UploadedJetwayStaticMaximumContactErrorMeters) <= 0.05;
  }, {
    closureAuthority: CLOSURE_AUTHORITY,
    targetAuthority: TARGET_AUTHORITY,
    evidenceAuthority: EVIDENCE_AUTHORITY,
  }, { timeout: 300_000, polling: 100 });

  const runtime = await page.evaluate(() => ({
    ...document.querySelector("canvas.trainerCanvas").dataset,
  }));
  expect(runtime.terminal4UploadedJetwayStaticCabClosureAuthority).toBe(CLOSURE_AUTHORITY);
  expect(runtime.terminal4UploadedJetwayStaticCabTargetAuthority).toBe(TARGET_AUTHORITY);
  expect(Number(runtime.terminal4UploadedJetwayStaticBridgeEndFallbackCount)).toBe(0);
  expect(runtime.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority).toBe(EVIDENCE_AUTHORITY);
  expect(Number(runtime.terminal4UploadedJetwayStaticCabClosurePanelCount)).toBe(57);
  expect(Number(runtime.terminal4UploadedJetwayStaticCabClosureWindowCount)).toBe(57);
  expect(Number(runtime.terminal4UploadedJetwayStaticCabClosureSurroundPieceCount)).toBe(228);
  expect(Number(runtime.terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount)).toBe(0);
  expect(Number(runtime.terminal4UploadedJetwayStaticCabClosureDepthMeters)).toBeCloseTo(1.45, 6);
  expect(Math.abs(Number(runtime.terminal4UploadedJetwayStaticApronFacingOpenAreaMeters))).toBeLessThanOrEqual(1e-9);
  expect(Number(runtime.terminal4UploadedJetwayStaticArticulatedGateCount)).toBe(57);
  expect(Number(runtime.terminal4UploadedJetwayStaticMaximumContactErrorMeters)).toBeLessThanOrEqual(0.05);

  await page.addStyleTag({
    content: ".rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}",
  });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));

  for (const [preset, outputPath] of PRESETS) {
    await selectPreset(page, preset);
    await captureCanvas(page, outputPath);
  }

  fs.writeFileSync(
    "test-results/terminal4-static-cab-closure-evidence.json",
    `${JSON.stringify({
      closureAuthority: runtime.terminal4UploadedJetwayStaticCabClosureAuthority,
      targetAuthority: runtime.terminal4UploadedJetwayStaticCabTargetAuthority,
      bridgeEndFallbackCount: Number(runtime.terminal4UploadedJetwayStaticBridgeEndFallbackCount),
      evidenceAuthority: runtime.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority,
      panelCount: Number(runtime.terminal4UploadedJetwayStaticCabClosurePanelCount),
      windowCount: Number(runtime.terminal4UploadedJetwayStaticCabClosureWindowCount),
      surroundPieceCount: Number(runtime.terminal4UploadedJetwayStaticCabClosureSurroundPieceCount),
      authoredNodeTransformCount: Number(runtime.terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount),
      capDepthMeters: Number(runtime.terminal4UploadedJetwayStaticCabClosureDepthMeters),
      apronFacingOpenAreaMeters: Number(runtime.terminal4UploadedJetwayStaticApronFacingOpenAreaMeters),
      staticArticulatedGateCount: Number(runtime.terminal4UploadedJetwayStaticArticulatedGateCount),
      staticMaximumContactErrorMeters: Number(runtime.terminal4UploadedJetwayStaticMaximumContactErrorMeters),
      evidenceViews: PRESETS.map(([preset]) => preset),
    }, null, 2)}\n`,
  );
});
