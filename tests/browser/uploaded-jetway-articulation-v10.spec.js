import fs from "node:fs";
import { expect, test } from "@playwright/test";

const STATIC_CAB_CLOSURE_AUTHORITY = "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3";
const STATIC_CAB_CLOSURE_EVIDENCE_AUTHORITY = "57-static-cab-endpoints-opaque-zero-open-area-no-authored-transform-v1";

async function captureCanvas(page, path) {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!canvas) throw new Error("Three.js canvas is missing");
    const bounds = canvas.getBoundingClientRect();
    return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
  });
  const client = await page.context().newCDPSession(page);
  try {
    await client.send("Page.bringToFront");
    const capture = client.send("Page.captureScreenshot", {
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
    });
    const timeout = new Promise((_, reject) => setTimeout(
      () => reject(new Error("Jetway evidence capture exceeded 75 seconds")),
      75_000,
    ));
    const { data } = await Promise.race([capture, timeout]);
    fs.mkdirSync("test-results", { recursive: true });
    fs.writeFileSync(path, Buffer.from(data, "base64"));
    expect(fs.statSync(path).size).toBeGreaterThan(50_000);
  } finally {
    await client.detach();
  }
}

async function captureInspectionPreset(page, presetId, outputPath) {
  await page.evaluate((nextPreset) => {
    const select = document.querySelector('select[aria-label="Inspection location"]');
    if (!(select instanceof HTMLSelectElement)) throw new Error("Inspection location selector is missing");
    select.value = nextPreset;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }, presetId);
  await page.waitForFunction((expectedPreset) => (
    document.querySelector("canvas.trainerCanvas")?.dataset?.inspectionPreset === expectedPreset
  ), presetId, { timeout: 30_000, polling: 100 });
  if (presetId === "a1Connection") {
    await page.waitForFunction(() => {
      const data = document.querySelector("canvas.trainerCanvas")?.dataset;
      return data?.a1JetwayDeployment === "1.000"
        && data?.a1JetwayState === "attached-to-aircraft-door"
        && Number(data?.inspectionAircraftDoorVerticalErrorMeters) <= 0.01
        && Math.abs(Number(data?.inspectionAircraftGroundClearanceMeters)) <= 0.01;
    }, null, { timeout: 30_000, polling: 100 });
  } else {
    await page.waitForFunction(({ closureAuthority, evidenceAuthority }) => {
      const data = document.querySelector("canvas.trainerCanvas")?.dataset;
      return data?.terminal4UploadedJetwayStaticCabClosureAuthority === closureAuthority
        && data?.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority === evidenceAuthority
        && Number(data?.terminal4UploadedJetwayStaticCabClosurePanelCount) === 57
        && Number(data?.terminal4UploadedJetwayStaticCabClosureWindowCount) === 57
        && Number(data?.terminal4UploadedJetwayStaticCabClosureSurroundPieceCount) === 228
        && Number(data?.terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount) === 0
        && Math.abs(Number(data?.terminal4UploadedJetwayStaticCabClosureDepthMeters) - 1.45) <= 1e-6
        && Math.abs(Number(data?.terminal4UploadedJetwayStaticApronFacingOpenAreaMeters)) <= 1e-9;
    }, {
      closureAuthority: STATIC_CAB_CLOSURE_AUTHORITY,
      evidenceAuthority: STATIC_CAB_CLOSURE_EVIDENCE_AUTHORITY,
    }, { timeout: 30_000, polling: 100 });
  }
  await page.waitForTimeout(2_000);
  await captureCanvas(page, outputPath);
}

test("the exact supplied A1 jetway telescopes to the aircraft door and all 57 static Cab portals are opaque", async ({ page }) => {
  test.setTimeout(780_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  page.on("console", (message) => console.log(`[browser:${message.type()}] ${message.text()}`));
  page.on("pageerror", (error) => console.log(`[browser:pageerror] ${error.message}`));
  await page.goto("/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({ closureAuthority, evidenceAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return (
      data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayArticulationAuthority === "user-supplied-airport-jetway-per-gate-telescoping-v10"
      && data?.terminal4UploadedJetwayA1PartOrderValid === "true"
      && data?.inspectionAircraftPoseStored === "true"
      && data?.inspectionAircraftPoseApplied === "true"
      && data?.terminal4UploadedJetwayStaticCabClosureAuthority === closureAuthority
      && data?.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority === evidenceAuthority
      && Number(data?.terminal4UploadedJetwayStaticCabClosurePanelCount) === 57
      && Number(data?.terminal4UploadedJetwayStaticCabClosureWindowCount) === 57
      && Number(data?.terminal4UploadedJetwayStaticCabClosureSurroundPieceCount) === 228
      && Number(data?.terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount) === 0
      && Math.abs(Number(data?.terminal4UploadedJetwayStaticCabClosureDepthMeters) - 1.45) <= 1e-6
      && Math.abs(Number(data?.terminal4UploadedJetwayStaticApronFacingOpenAreaMeters)) <= 1e-9
    ) || data?.environmentSource === "load-error"
      || data?.terminal4UploadedJetwayLoadState === "load-error";
  }, {
    closureAuthority: STATIC_CAB_CLOSURE_AUTHORITY,
    evidenceAuthority: STATIC_CAB_CLOSURE_EVIDENCE_AUTHORITY,
  }, { timeout: 90_000, polling: 100 });

  const readiness = await page.evaluate(() => ({
    runtime: { ...document.querySelector("canvas.trainerCanvas").dataset },
    hud: document.querySelector(".rr-hud p")?.textContent || "",
  }));
  if (readiness.runtime.environmentSource === "load-error"
    || readiness.runtime.terminal4UploadedJetwayLoadState === "load-error") {
    throw new Error(`Terminal 4 rejected the supplied jetway runtime: ${readiness.hud}`);
  }
  const runtime = readiness.runtime;
  expect(runtime.terminal4UploadedJetwayCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayVerifiedModelCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayStaticArticulatedGateCount).toBe("57");
  expect(runtime.terminal4UploadedJetwayArticulationAuthority).toBe(
    "user-supplied-airport-jetway-per-gate-telescoping-v10",
  );
  expect(runtime.terminal4UploadedJetwayStaticCabClosureAuthority).toBe(STATIC_CAB_CLOSURE_AUTHORITY);
  expect(runtime.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority).toBe(
    STATIC_CAB_CLOSURE_EVIDENCE_AUTHORITY,
  );
  expect(Number(runtime.terminal4UploadedJetwayStaticCabClosurePanelCount)).toBe(57);
  expect(Number(runtime.terminal4UploadedJetwayStaticCabClosureWindowCount)).toBe(57);
  expect(Number(runtime.terminal4UploadedJetwayStaticCabClosureSurroundPieceCount)).toBe(228);
  expect(Number(runtime.terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount)).toBe(0);
  expect(Number(runtime.terminal4UploadedJetwayStaticCabClosureDepthMeters)).toBeCloseTo(1.45, 6);
  expect(Math.abs(Number(runtime.terminal4UploadedJetwayStaticApronFacingOpenAreaMeters))).toBeLessThanOrEqual(1e-9);
  expect(runtime.inspectionAircraftPoseStored).toBe("true");
  expect(runtime.inspectionAircraftPoseApplied).toBe("true");
  expect(runtime.inspectionAircraftPoseAuthority).toBe(
    "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2",
  );
  expect(runtime.inspectionAircraftCabContactAuthority).toBe(
    "authored-rendered-forward-left-door-to-final-cab-v4",
  );

  const sourceReach = Number(runtime.terminal4UploadedJetwaySourceContactDistanceMeters);
  const target = Number(runtime.terminal4UploadedJetwayA1TargetDoorDistanceMeters);
  const extension = Number(runtime.terminal4UploadedJetwayA1AttachedExtensionMeters);
  const predictedGap = Number(runtime.terminal4UploadedJetwayA1PredictedDoorGapMeters);
  const predictedContact = Number(runtime.terminal4UploadedJetwayA1PredictedContactDistanceMeters);
  const actualContact = Number(runtime.terminal4UploadedJetwayA1ActualContactDistanceMeters);
  const actualGap = Number(runtime.terminal4UploadedJetwayA1ActualDoorGapMeters);
  const staticMaximumError = Number(runtime.terminal4UploadedJetwayStaticMaximumContactErrorMeters);
  const renderedAircraftCabError = Number(runtime.inspectionAircraftCabContactErrorMeters);
  const renderedAircraftVerticalError = Number(runtime.inspectionAircraftDoorVerticalErrorMeters);
  const renderedAircraftGroundClearance = Number(runtime.inspectionAircraftGroundClearanceMeters);
  const renderedDoorTargetX = Number(runtime.inspectionAircraftDoorTargetX);
  const renderedDoorTargetZ = Number(runtime.inspectionAircraftDoorTargetZ);
  const measuredCabX = Number(runtime.inspectionAircraftCabContactX);
  const measuredCabZ = Number(runtime.inspectionAircraftCabContactZ);
  const inspectionNoseGearX = Number(runtime.inspectionAircraftNoseGearX);
  const inspectionNoseGearZ = Number(runtime.inspectionAircraftNoseGearZ);
  expect(sourceReach).toBeGreaterThan(25.5);
  expect(sourceReach).toBeLessThan(26.5);
  expect(target).toBeGreaterThan(30.3);
  expect(target).toBeLessThan(30.8);
  expect(extension).toBeGreaterThan(4.2);
  expect(extension).toBeLessThan(4.8);
  expect(predictedGap).toBeLessThanOrEqual(0.05);
  expect(actualGap).toBeLessThanOrEqual(0.05);
  expect(Math.abs(predictedContact - target)).toBeLessThanOrEqual(0.05);
  expect(Math.abs(actualContact - target)).toBeLessThanOrEqual(0.05);
  expect(staticMaximumError).toBeLessThanOrEqual(0.05);
  expect(runtime.terminal4UploadedJetwayA1PartOrderValid).toBe("true");
  expect(Number.isFinite(renderedAircraftCabError)).toBe(true);
  expect(renderedAircraftCabError).toBeLessThanOrEqual(0.01);
  expect(renderedAircraftVerticalError).toBeLessThanOrEqual(0.01);
  expect(Math.abs(renderedAircraftGroundClearance)).toBeLessThanOrEqual(0.01);
  expect(runtime.inspectionAircraftJetwayVerticalFitAuthority).toBe(
    "grounded-aircraft-door-progressive-tunnel-slope-v1",
  );
  expect(Math.hypot(renderedDoorTargetX - measuredCabX, renderedDoorTargetZ - measuredCabZ)).toBeLessThanOrEqual(0.01);
  expect([inspectionNoseGearX, inspectionNoseGearZ].every(Number.isFinite)).toBe(true);

  const centers = JSON.parse(runtime.terminal4UploadedJetwayA1PartCentersMeters);
  expect(centers.Rotunda).toBeLessThan(centers.Tunnel_A);
  expect(centers.Tunnel_A).toBeLessThan(centers.Tunnel_B);
  expect(centers.Tunnel_B).toBeLessThan(centers.Tunnel_C);
  expect(centers.Tunnel_C).toBeLessThan(centers.Cab);

  await page.addStyleTag({ content: ".rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}" });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await captureInspectionPreset(
    page,
    "a1Connection",
    "test-results/uploaded-jetway-a1-articulated-v10.png",
  );
  await captureInspectionPreset(
    page,
    "a14",
    "test-results/uploaded-jetway-a-concourse-static-fleet-v10.png",
  );
  await captureInspectionPreset(
    page,
    "b14",
    "test-results/uploaded-jetway-b-concourse-static-fleet-v10.png",
  );
  await captureInspectionPreset(
    page,
    "b15",
    "test-results/uploaded-jetway-b15-static-fleet-v10.png",
  );

  fs.writeFileSync("test-results/uploaded-jetway-a1-articulated-v10.json", `${JSON.stringify({
    authority: runtime.terminal4UploadedJetwayArticulationAuthority,
    staticCabClosureAuthority: runtime.terminal4UploadedJetwayStaticCabClosureAuthority,
    staticCabClosureEvidenceAuthority: runtime.terminal4UploadedJetwayStaticCabClosureEvidenceAuthority,
    staticCabClosurePanelCount: Number(runtime.terminal4UploadedJetwayStaticCabClosurePanelCount),
    staticCabClosureWindowCount: Number(runtime.terminal4UploadedJetwayStaticCabClosureWindowCount),
    staticCabClosureSurroundPieceCount: Number(runtime.terminal4UploadedJetwayStaticCabClosureSurroundPieceCount),
    staticCabClosureAuthoredNodeTransformCount: Number(
      runtime.terminal4UploadedJetwayStaticCabClosureAuthoredNodeTransformCount,
    ),
    staticCabClosureDepthMeters: Number(runtime.terminal4UploadedJetwayStaticCabClosureDepthMeters),
    staticApronFacingOpenAreaMeters: Number(runtime.terminal4UploadedJetwayStaticApronFacingOpenAreaMeters),
    sourceReach,
    target,
    extension,
    predictedGap,
    actualGap,
    predictedContact,
    actualContact,
    staticMaximumError,
    renderedAircraftCabError,
    renderedDoorTarget: [renderedDoorTargetX, renderedDoorTargetZ],
    measuredCab: [measuredCabX, measuredCabZ],
    inspectionNoseGear: [inspectionNoseGearX, inspectionNoseGearZ],
    inspectionAircraftPoseAuthority: runtime.inspectionAircraftPoseAuthority,
    verifiedModelCount: Number(runtime.terminal4UploadedJetwayVerifiedModelCount),
    staticArticulatedGateCount: Number(runtime.terminal4UploadedJetwayStaticArticulatedGateCount),
    centers,
    evidenceViews: ["a1Connection", "a14", "b14", "b15"],
  }, null, 2)}\n`);
});
