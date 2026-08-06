import fs from "node:fs";
import { expect, test } from "@playwright/test";

const JETWAY_GROUND_AUTHORITY = "exact-authored-a1-lowest-geometry-ramp-contact-v1";
const VISUAL_ACCEPTANCE_AUTHORITY = "same-day-a1-continuous-compact-solid-closed-grounded-v1";
const ASSEMBLY_CONTINUITY_AUTHORITY = "exact-authored-five-part-chain-no-isolated-node-rotation-v2";

test("A1 authored jetway uses an exact 2.4 m real-terminal vestibule and a separated multi-point ramp footprint", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.getByRole("button", { name: "Drive tug / inspect airport" }).click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({ groundAuthority, visualAuthority, assemblyAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    const wallAuthority = String(data?.terminal4A1ConnectionAuthority || "");
    const centerToWallDistance = Number(data?.terminal4A1JetwayWallDistance);
    const visibleVestibuleLength = Number(data?.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters);
    return data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayBogieGroundContactAuthority === groundAuthority
      && Math.abs(Number(data?.terminal4UploadedJetwayBogieGroundClearanceMeters)) <= 0.005
      && Number(data?.terminal4UploadedJetwayBogieGroundContactPointCount) >= 8
      && Number(data?.terminal4UploadedJetwayBogieGroundContactClusterCount) >= 2
      && Number(data?.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters) >= 1.2
      && Number.isFinite(Number(data?.terminal4UploadedJetwayBogieGroundContactSpanX))
      && Number.isFinite(Number(data?.terminal4UploadedJetwayBogieGroundContactSpanZ))
      && centerToWallDistance > 2.9
      && centerToWallDistance < 5.8
      && Math.abs(visibleVestibuleLength - 2.4) <= 0.05
      && !/WALK|JETWAY|CONNECTOR|PORTAL/i.test(wallAuthority)
      && data?.terminal4UploadedJetwayA1AssemblyContinuityAuthority === assemblyAuthority
      && Number(data?.terminal4UploadedJetwayA1AssemblyPartCount) === 5
      && Math.abs(Number(data?.terminal4UploadedJetwayA1AssemblyTransformError)) <= 1e-9
      && Number(data?.terminal4UploadedJetwayA1IsolatedNodeRotationCount) === 0
      && data?.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed === "true"
      && data?.terminal4UploadedJetwayA1NoGeneratedGlassCorridor === "true"
      && data?.terminal4UploadedJetwayA1VisualAcceptanceAuthority === visualAuthority;
  }, {
    groundAuthority: JETWAY_GROUND_AUTHORITY,
    visualAuthority: VISUAL_ACCEPTANCE_AUTHORITY,
    assemblyAuthority: ASSEMBLY_CONTINUITY_AUTHORITY,
  }, { timeout: 300_000, polling: 100 });

  await page.getByLabel("Inspection location").selectOption("a1Connection");
  await page.waitForFunction(() => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionPreset === "a1Connection"
      && data?.a1JetwayDeployment === "1.000"
      && data?.a1JetwayState === "attached-to-aircraft-door";
  }, null, { timeout: 30_000, polling: 100 });

  const runtime = await page.evaluate(() => ({
    ...document.querySelector("canvas.trainerCanvas").dataset,
  }));
  expect(runtime.terminal4UploadedJetwayBogieGroundContactAuthority).toBe(JETWAY_GROUND_AUTHORITY);
  expect(Math.abs(Number(runtime.terminal4UploadedJetwayBogieGroundClearanceMeters))).toBeLessThanOrEqual(0.005);
  expect(Number(runtime.terminal4UploadedJetwayBogieGroundContactPointCount)).toBeGreaterThanOrEqual(8);
  expect(Number(runtime.terminal4UploadedJetwayBogieGroundContactClusterCount)).toBeGreaterThanOrEqual(2);
  expect(Number(runtime.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters)).toBeGreaterThanOrEqual(1.2);
  expect(Number(runtime.terminal4A1JetwayWallDistance)).toBeGreaterThan(2.9);
  expect(Number(runtime.terminal4A1JetwayWallDistance)).toBeLessThan(5.8);
  expect(Math.abs(Number(runtime.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters) - 2.4)).toBeLessThanOrEqual(0.05);
  expect(runtime.terminal4A1ConnectionAuthority).not.toMatch(/WALK|JETWAY|CONNECTOR|PORTAL/i);
  expect(runtime.terminal4UploadedJetwayA1AssemblyContinuityAuthority).toBe(ASSEMBLY_CONTINUITY_AUTHORITY);
  expect(Number(runtime.terminal4UploadedJetwayA1AssemblyPartCount)).toBe(5);
  expect(Math.abs(Number(runtime.terminal4UploadedJetwayA1AssemblyTransformError))).toBeLessThanOrEqual(1e-9);
  expect(Number(runtime.terminal4UploadedJetwayA1IsolatedNodeRotationCount)).toBe(0);
  expect(runtime.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed).toBe("true");
  expect(runtime.terminal4UploadedJetwayA1NoGeneratedGlassCorridor).toBe("true");
  expect(runtime.terminal4UploadedJetwayA1VisualAcceptanceAuthority).toBe(VISUAL_ACCEPTANCE_AUTHORITY);

  fs.mkdirSync("test-results", { recursive: true });
  fs.writeFileSync(
    "test-results/a1-jetway-contact-clusters.json",
    `${JSON.stringify({
      groundAuthority: runtime.terminal4UploadedJetwayBogieGroundContactAuthority,
      groundClearanceMeters: Number(runtime.terminal4UploadedJetwayBogieGroundClearanceMeters),
      contactPointCount: Number(runtime.terminal4UploadedJetwayBogieGroundContactPointCount),
      contactClusterCount: Number(runtime.terminal4UploadedJetwayBogieGroundContactClusterCount),
      contactSpan: [
        Number(runtime.terminal4UploadedJetwayBogieGroundContactSpanX),
        Number(runtime.terminal4UploadedJetwayBogieGroundContactSpanZ),
      ],
      horizontalContactSpanMeters: Number(runtime.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters),
      rotundaCenterToWallMeters: Number(runtime.terminal4A1JetwayWallDistance),
      visibleVestibuleLengthMeters: Number(runtime.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters),
      terminalConnectionAuthority: runtime.terminal4A1ConnectionAuthority,
      assemblyContinuityAuthority: runtime.terminal4UploadedJetwayA1AssemblyContinuityAuthority,
      assemblyPartCount: Number(runtime.terminal4UploadedJetwayA1AssemblyPartCount),
      assemblyTransformError: Number(runtime.terminal4UploadedJetwayA1AssemblyTransformError),
      isolatedNodeRotationCount: Number(runtime.terminal4UploadedJetwayA1IsolatedNodeRotationCount),
      apronFacingRotundaOpeningClosed: runtime.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed,
      noGeneratedGlassCorridor: runtime.terminal4UploadedJetwayA1NoGeneratedGlassCorridor,
      visualAcceptanceAuthority: runtime.terminal4UploadedJetwayA1VisualAcceptanceAuthority,
    }, null, 2)}\n`,
  );
});
