import { writeFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";

const TARGET_URL = process.env.PLAYWRIGHT_TARGET_URL || "/";
const DIRECT_A1_TERMINAL_AUTHORITY = "nearest-structural-terminal-facade-photo-verified-v1";
const TERMINAL_RELOCATED_AIRCRAFT_AUTHORITY = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2";
const PHOTO_REGISTERED_NOSE_GEAR = Object.freeze({ x: 12.353412, z: -12.486888 });
const GROUND_SUFFIXES = ["/models/kphx-ground/kphx-ground.gltf", "/models/kphx-ground/kphx-ground.bin"];
const PHOTO_SUFFIXES = ["/models/kphx-photo/photo-manifest.json"];
const TERMINAL_SUFFIXES = [
  "/models/phx-terminal4/terminal4.gltf",
  "/models/phx-terminal4/terminal4.bin",
  "/models/phx-terminal4/texture-manifest.json",
  "/models/phx-terminal4/textures/BGATE1.png",
  "/models/phx-terminal4/textures/PARKRAMPS.png",
  "/models/phx-terminal4/textures/PARKRAMP1.png",
  "/models/phx-terminal4/textures/PHX_TERM400_0.png",
  "/models/phx-terminal4/textures/PHX_TERM400_1.png",
  "/models/phx-terminal4/textures/RW.png",
  "/models/phx-terminal4/textures/M1DGJETWAY.png",
  "/models/phx-terminal4/textures/M1DGJETWAY_LM.png",
];
const SOURCE_ASSETS = [...GROUND_SUFFIXES, ...PHOTO_SUFFIXES, ...TERMINAL_SUFFIXES];

async function launchStandup(page) {
  await page.goto(TARGET_URL, { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Choose pushback equipment" })).toBeVisible();
  const directInspection = page.getByRole("button", { name: "Drive tug / inspect airport" });
  await expect(directInspection).toBeEnabled();
  await directInspection.click();
  await expect(page.getByRole("heading", { name: "Airport inspection mode" })).toBeVisible();

  await page.waitForFunction(({ expectedAuthority, aircraftAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return data?.inspectionMode === "active"
      && data?.environmentSource === "authored-phx-terminal4-textured-source-jetways"
      && data?.groundSource === "authored-kphx-v181-source-textured-nearfield"
      && data?.photoGroundSource === "source-authored-phx-photo"
      && data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayCount === "58"
      && data?.terminal4UploadedJetwayConnectorCount === "58"
      && data?.terminal4UploadedJetwayVerifiedModelCount === "58"
      && data?.terminal4A1JetwayWallDistance !== "loading"
      && Number(data?.terminal4A1JetwayWallDistance) > 2.9
      && Number(data?.terminal4A1JetwayWallDistance) < 5.8
      && Math.abs(Number(data?.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters) - 2.4) <= 0.05
      && data?.terminal4A1ConnectionAuthority === expectedAuthority
      && data?.inspectionAircraftPoseAuthority === aircraftAuthority
      && Number.isFinite(Number(data?.inspectionAircraftTerminalRelocationX))
      && Number.isFinite(Number(data?.inspectionAircraftTerminalRelocationZ))
      && data?.terminal4A1LegacyBlockRemovedTriangles === "36";
  }, {
    expectedAuthority: DIRECT_A1_TERMINAL_AUTHORITY,
    aircraftAuthority: TERMINAL_RELOCATED_AIRCRAFT_AUTHORITY,
  }, { timeout: 300_000, polling: 100 });
}

async function captureRegion(page, fileName, region = null, minimumBytes = 50_000) {
  const bounds = await page.evaluate(() => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Three.js canvas is missing");
    const box = canvas.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
  expect(bounds.width).toBeGreaterThan(64);
  expect(bounds.height).toBeGreaterThan(64);

  const clip = region ? {
    x: bounds.x + bounds.width * region.left,
    y: bounds.y + bounds.height * region.top,
    width: bounds.width * region.width,
    height: bounds.height * region.height,
  } : bounds;

  const client = await page.context().newCDPSession(page);
  try {
    await client.send("Page.bringToFront");
    const { data } = await Promise.race([
      client.send("Page.captureScreenshot", {
        format: "png",
        fromSurface: true,
        captureBeyondViewport: false,
        clip: {
          x: Math.max(0, clip.x),
          y: Math.max(0, clip.y),
          width: Math.max(1, Math.min(clip.width, 1440 - Math.max(0, clip.x))),
          height: Math.max(1, Math.min(clip.height, 900 - Math.max(0, clip.y))),
          scale: 1,
        },
      }),
      new Promise((_, reject) => setTimeout(
        () => reject(new Error(`Chromium compositor capture exceeded 45 seconds for ${fileName}`)),
        45_000,
      )),
    ]);
    const image = Buffer.from(data, "base64");
    expect(image.byteLength).toBeGreaterThan(minimumBytes);
    await writeFile(`test-results/${fileName}`, image);
  } finally {
    await client.detach();
  }
}

async function prepareA1Evidence(page) {
  await page.evaluate(async () => {
    const canvas = document.querySelector("canvas.trainerCanvas");
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error("Three.js canvas is missing");
    const location = document.querySelector('select[aria-label="Inspection location"]');
    if (location instanceof HTMLSelectElement) {
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      if (!setter) throw new Error("Native inspection selector setter is unavailable");
      setter.call(location, "a1Connection");
      location.dispatchEvent(new Event("input", { bubbles: true }));
      location.dispatchEvent(new Event("change", { bubbles: true }));
    }
    canvas.dispatchEvent(new WheelEvent("wheel", { deltaY: 850, bubbles: true, cancelable: true }));

    const style = document.createElement("style");
    style.textContent = `
      .rr-hud, .rr-metrics, .rr-score-float, .rr-guidance, .rr-diagnostics,
      .rr-steer, .rr-throttle { display: none !important; }
      .rr-shell, .rr-scene, canvas { width: 100vw !important; height: 100vh !important; }
    `;
    document.head.appendChild(style);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
}

test("loads source-correct PHX scenery with the complete exact Terminal 4 jetway fleet and pavement-coincident markings", async ({ page }) => {
  test.setTimeout(600_000);
  await page.setViewportSize({ width: 1440, height: 900 });

  const assetResponses = [];
  const tileResponses = new Map();
  const runtimeErrors = [];
  page.on("response", (response) => {
    const pathname = new URL(response.url()).pathname;
    if (SOURCE_ASSETS.some((suffix) => pathname.endsWith(suffix))) assetResponses.push(response);
    if (pathname.includes("/models/kphx-photo/tiles/")) tileResponses.set(pathname, response);
  });
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(message.text());
  });
  page.on("pageerror", (error) => runtimeErrors.push(error.message));

  await launchStandup(page);
  const runtime = await page.evaluate(() => ({
    ...document.querySelector("canvas.trainerCanvas").dataset,
  }));
  await writeFile(
    "test-results/kphx-a1-preassert-runtime.json",
    JSON.stringify(runtime, null, 2),
    "utf8",
  );
  await captureRegion(page, "kphx-a1-preassert-current-head.png", null, 20_000);

  expect(runtime.inspectionMode).toBe("active");
  expect(runtime.environmentSource).toBe("authored-phx-terminal4-textured-source-jetways");
  expect(runtime.groundSource).toBe("authored-kphx-v181-source-textured-nearfield");
  expect(runtime.photoGroundSource).toBe("source-authored-phx-photo");
  expect(runtime.kphxVersion).toBe("1.8.1");
  expect(runtime.kphxDetailLevel).toBe("terminal4-authored-pavement-v5-source-ramp-stand-markings");
  expect(runtime.photoDetailLevel).toBe("full-airport-source-aerial-tiled-1.2m-v2");
  expect(runtime.photoTextureMode).toBe("tiled-native-source-resolution-v2");
  expect(runtime.photoRuntimeTileCount).toBe("21");
  expect(runtime.photoMaxTextureDimension).toBe("1024");
  expect(runtime.photoTileCount).toBe("199");
  expect(runtime.photoWidth).toBe("6400");
  expect(runtime.photoHeight).toBe("2304");
  expect(runtime.photoBytes).toBe("2698886");
  expect(runtime.hiddenAdexSurfaceMaterials).toBe("1");
  expect(runtime.sourceJetwayCount).toBe("112");
  expect(runtime.terminal4JetwayCount).toBe("58");
  expect(runtime.terminal4ParkingCount).toBe("58");
  expect(runtime.terminal4TextureCount).toBe("17");
  expect(runtime.terminal4ExactTextureCount).toBe("17");
  expect(runtime.terminal4A1LegacyBlockRemovedTriangles).toBe("36");
  expect(runtime.terminal4A1LegacyBlockAuthority).toBe("surgical-exact-three-box-36-triangle-authored-removal-v3");
  expect(runtime.terminal4FallbackTextureCount).toBe("0");
  expect(runtime.terminal4TexturedMaterialCount).toBe("22");
  expect(runtime.terminal4Position).toBe("-101.593,0.035,70.901");
  expect(runtime.terminal4Placement).toBe(
    "decoded original KPHX_ADEX library-object placement relative to decoded original Gate A1",
  );
  expect(runtime.groundMarkingContactMode).toBe("pavement-coincident-decals");
  expect(runtime.b15Anchors).toBe("ready");
  expect(runtime.b15CorridorMeters).toBe("515,542");
  expect(runtime.terminal4UploadedJetwayLoadState).toBe("ready");
  expect(runtime.terminal4UploadedJetwayCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayConnectorCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayVerifiedModelCount).toBe("58");
  expect(runtime.terminal4UploadedJetwayReadyAuthority).toBe(
    "exact-uploaded-airport-jetway-complete-58-gates-v1",
  );

  const nearestGeometryMeters = Number(runtime.terminal4A1NearestGeometryMeters);
  expect(nearestGeometryMeters).toBeGreaterThan(29.9);
  expect(nearestGeometryMeters).toBeLessThan(30.6);
  const a1WallDistance = Number(runtime.terminal4A1JetwayWallDistance);
  expect(a1WallDistance).toBeGreaterThan(2.9);
  expect(a1WallDistance).toBeLessThan(5.8);
  expect(Math.abs(Number(runtime.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters) - 2.4)).toBeLessThanOrEqual(0.05);
  expect(runtime.terminal4A1ConnectionAuthority).toBe(DIRECT_A1_TERMINAL_AUTHORITY);
  expect(runtime.terminal4A1ConnectionAuthority).not.toMatch(/WALK/i);
  const a1TerminalDirection = runtime.terminal4A1ConnectionDirection.split(",").map(Number);
  expect(a1TerminalDirection).toHaveLength(2);
  expect(Math.abs(Math.hypot(...a1TerminalDirection) - 1)).toBeLessThanOrEqual(0.01);
  const aircraftRelocationX = Number(runtime.inspectionAircraftTerminalRelocationX);
  const aircraftRelocationZ = Number(runtime.inspectionAircraftTerminalRelocationZ);
  expect(Number.isFinite(aircraftRelocationX)).toBe(true);
  expect(Number.isFinite(aircraftRelocationZ)).toBe(true);
  expect(Math.hypot(aircraftRelocationX, aircraftRelocationZ)).toBeGreaterThan(1);
  expect(runtime.inspectionAircraftPoseAuthority).toBe(TERMINAL_RELOCATED_AIRCRAFT_AUTHORITY);
  const signedDoorVerticalGapMeters = Number(runtime.inspectionAircraftDoorSignedVerticalGapMeters);
  const requestedJetwayVerticalFitMeters = Number(runtime.inspectionAircraftJetwayRequestedVerticalFitMeters);
  expect(Number.isFinite(signedDoorVerticalGapMeters)).toBe(true);
  expect(Number.isFinite(requestedJetwayVerticalFitMeters)).toBe(true);
  expect(Number(runtime.inspectionAircraftDoorVerticalErrorMeters)).toBeCloseTo(
    Math.abs(signedDoorVerticalGapMeters),
    5,
  );
  expect(Number(runtime.inspectionAircraftDoorVerticalErrorMeters)).toBeLessThanOrEqual(6);
  expect(requestedJetwayVerticalFitMeters).toBeCloseTo(signedDoorVerticalGapMeters, 5);
  expect(Number(runtime.inspectionAircraftJetwayVerticalFitMeters)).toBeCloseTo(0, 5);
  expect(runtime.inspectionAircraftJetwayAuthoredBogieGroundPreserved).toBe("true");
  expect(Math.abs(Number(runtime.inspectionAircraftGroundClearanceMeters))).toBeLessThanOrEqual(0.01);
  expect(runtime.inspectionAircraftJetwayVerticalFitAuthority).toBe(
    "grounded-jetway-door-gap-reported-no-child-lift-v1",
  );
  expect(Number(runtime.inspectionAircraftNoseGearX)).toBeCloseTo(
    PHOTO_REGISTERED_NOSE_GEAR.x + aircraftRelocationX,
    3,
  );
  expect(Number(runtime.inspectionAircraftNoseGearZ)).toBeCloseTo(
    PHOTO_REGISTERED_NOSE_GEAR.z + aircraftRelocationZ,
    3,
  );
  expect(runtime.inspectionAircraftHeadingAuthority).toBe(
    "measured-cab-normal-aircraft-heading-v1",
  );
  const cabDirectionX = Number(runtime.inspectionAircraftCabDirectionX);
  const cabDirectionZ = Number(runtime.inspectionAircraftCabDirectionZ);
  const expectedCabRegisteredYaw = Math.atan2(-cabDirectionZ, cabDirectionX);
  expect(Number(runtime.inspectionAircraftYaw)).toBeCloseTo(expectedCabRegisteredYaw, 4);
  const terminalConnectedJetways = Number(runtime.terminal4TerminalConnectedJetwayCount);
  expect(terminalConnectedJetways).toBeGreaterThan(0);
  expect(Number(runtime.terminal4SourceCutoutMaterialCount)).toBeGreaterThan(0);
  expect(Number(runtime.terminal4FacadeInfillCount)).toBe(0);
  expect(Number(runtime.terminal4OpenServiceBayCount)).toBe(0);
  expect(Number(runtime.terminal4LowerFacadeFitCount)).toBe(terminalConnectedJetways);
  const openFacadeCells = Number(runtime.terminal4SourceFacadeOpenCellCount);
  const closedFacadeCells = Number(runtime.terminal4SourceFacadeClosedCellCount);
  expect(openFacadeCells).toBeGreaterThan(0);
  expect(closedFacadeCells).toBeGreaterThan(openFacadeCells * 3);
  expect(Number(runtime.terminal4SourceFacadeVariantMaterialCount)).toBeGreaterThanOrEqual(4);
  expect(runtime.terminal4ExactJetwayTextureActive).toBe("true");
  expect(runtime.terminal4JetwayTextureAuthority).toContain("M1DGJETWAY exact recovered");
  expect(runtime.terminal4JetwayDetailLevel).toBe("fsx-air-jetway01-exact-textured-source-scale-articulated-v5");
  expect(runtime.terminal4JetwaySourceScaleAuthority).toBe(
    "airport-authored-AIR_Jetway01-scale-preserved-no-aircraft-specific-shrink",
  );
  expect(runtime.terminal4JetwaySourceGeometryMode).toBe(
    "exact-uploaded-airport-jetway-glb-562e3144-v1",
  );
  expect(runtime.terminal4RequiresOriginalJetwayMesh).toBe("true");
  expect(runtime.terminal4JetwayInitialState).toBe("attached-to-aircraft-door");
  expect(runtime.terminal4JetwayPrePushSequence).toBe(
    "retract-bellows-clear-door-telescope-in-rotate-to-park",
  );

  for (const suffix of SOURCE_ASSETS) {
    expect(assetResponses.some((response) => (
      new URL(response.url()).pathname.endsWith(suffix) && response.status() === 200
    )), `successful response for ${suffix}`).toBe(true);
  }
  expect(tileResponses.size).toBe(21);
  expect([...tileResponses.values()].every((response) => response.status() === 200)).toBe(true);

  const entries = await page.evaluate((suffixes) => suffixes.map((suffix) => {
    const entry = performance.getEntriesByType("resource")
      .find((resource) => new URL(resource.name).pathname.endsWith(suffix));
    return entry ? {
      suffix,
      decodedBodySize: entry.decodedBodySize,
      transferSize: entry.transferSize,
    } : null;
  }), SOURCE_ASSETS);
  expect(entries.every(Boolean)).toBe(true);
  const bySuffix = Object.fromEntries(entries.map((entry) => [entry.suffix, entry]));
  const measuredSize = (suffix) => Math.max(
    bySuffix[suffix].decodedBodySize,
    bySuffix[suffix].transferSize,
  );
  expect(measuredSize("/models/kphx-ground/kphx-ground.bin")).toBeGreaterThan(500_000);
  expect(measuredSize("/models/phx-terminal4/terminal4.bin")).toBeGreaterThan(1_000_000);
  expect(measuredSize("/models/phx-terminal4/textures/BGATE1.png")).toBeGreaterThan(10_000);
  expect(measuredSize("/models/phx-terminal4/textures/PHX_TERM400_0.png")).toBeGreaterThan(10_000);
  expect(measuredSize("/models/phx-terminal4/textures/PHX_TERM400_1.png")).toBeGreaterThan(10_000);

  const relevantErrors = runtimeErrors.filter((message) =>
    /KPHX ground load failed|PHX airport ground failed to load|PHX source aerial failed to load|source aerial failed to load|Terminal 4 visual load failed|material texture is missing|GLTFLoader|WebGL.*shader|ReferenceError|TypeError|SyntaxError/i.test(message),
  );
  expect(relevantErrors).toEqual([]);

  await prepareA1Evidence(page);
  await captureRegion(page, "kphx-a1-uploaded-jetway-chase.png");
  await captureRegion(page, "kphx-a1-terminal-connection-close.png", {
    left: 0,
    top: 0.08,
    width: 0.62,
    height: 0.78,
  }, 20_000);

  await page.evaluate(async () => {
    const select = document.querySelector('select[aria-label="Camera view"]');
    if (!(select instanceof HTMLSelectElement)) throw new Error("Camera view selector is missing");
    const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
    if (!setter) throw new Error("Native camera selector setter is unavailable");
    setter.call(select, "overhead");
    select.dispatchEvent(new Event("input", { bubbles: true }));
    select.dispatchEvent(new Event("change", { bubbles: true }));
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  await captureRegion(page, "kphx-a1-uploaded-jetway-overhead.png");
});
