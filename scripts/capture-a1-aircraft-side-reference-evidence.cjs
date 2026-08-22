const { chromium } = require('@playwright/test');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDirectory = process.env.EVIDENCE_DIR || 'jetway-visual-evidence';
const COMMON_SUBVIEW_AUTHORITY = 'source-measured-a1-apron-side-evidence-camera-v5-balanced-branches';
const CAMERA_AUTHORITY = 'exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2';
const LOCK_AUTHORITY = 'exact-a1-evidence-camera-direct-lock-v1';
const SIDE_PROFILE_AUTHORITY = 'a1-rotunda-cab-outboard-side-profile-v1';
const AIRCRAFT_SIDE_AUTHORITY = 'a1-cab-tunnel-c-aircraft-side-close-v1';
const SERVICE_STAIR_AUTHORITY = 'exact-supplied-tunnel-c-service-stair-live-rendered-crj-clearance-v4';
const ATTACH_AUTHORITY = 'a1-terminal-connection-attached-evidence-v1';
const CAB_SURFACE_AUTHORITY = 'a1-final-exact-cab-footprint-door-contact-v7-bounded-lateral-hood-fit';
const MAX_DOOR_CAB_SURFACE_DISTANCE_METERS = 0.06;
// Aug. 17 attached-state authority: only the hood/front face reaches the CRJ door.
// The Cab body center must remain visibly outboard instead of being dragged into the
// nose/fuselage. The old <=3.5 m center rule enforced the opposite of the photo.
const MIN_CAB_CENTER_HORIZONTAL_SEPARATION_METERS = 2.0;
const MAX_CAB_CENTER_HORIZONTAL_SEPARATION_METERS = 6.0;
const MAX_BOGIE_GROUND_CLEARANCE_METERS = 0.015;
const MIN_SERVICE_STAIR_CLEARANCE_METERS = 0.15;

fs.mkdirSync(evidenceDirectory, { recursive: true });

function finite(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} is not finite: ${value}`);
  return number;
}

async function capture(page, filename) {
  const outputPath = `${evidenceDirectory}/${filename}`;
  const canvas = page.locator('canvas.trainerCanvas');
  const box = await canvas.boundingBox();
  if (!box || box.width <= 100 || box.height <= 100) throw new Error(`${filename} cannot capture a visible Three.js canvas`);
  const client = await page.context().newCDPSession(page);
  try {
    const { data } = await client.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: false,
      clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: box.height, scale: 1 },
    });
    fs.writeFileSync(outputPath, Buffer.from(data, 'base64'));
  } finally { await client.detach(); }
  const bytes = fs.statSync(outputPath).size;
  if (bytes < 100000) throw new Error(`${filename} is unexpectedly small: ${bytes}`);
  return bytes;
}

async function selectSubview(page, subview, specialAuthorityField, specialAuthority) {
  await page.evaluate((nextSubview) => {
    const canvas = document.querySelector('canvas.trainerCanvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('A1 evidence canvas is missing');
    canvas.dataset.a1EvidenceSubview = nextSubview;
  }, subview);
  await page.waitForFunction(({ subview, commonAuthority, cameraAuthority, lockAuthority, specialAuthorityField, specialAuthority }) => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    return data?.inspectionCameraEndpointSubview === subview
      && data?.inspectionCameraEndpointSubviewAuthority === commonAuthority
      && data?.inspectionCameraEndpointAuthority === cameraAuthority
      && data?.inspectionCameraEndpointLockAuthority === lockAuthority
      && data?.[specialAuthorityField] === specialAuthority
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;
  }, { subview, commonAuthority: COMMON_SUBVIEW_AUTHORITY, cameraAuthority: CAMERA_AUTHORITY, lockAuthority: LOCK_AUTHORITY, specialAuthorityField, specialAuthority }, { timeout: 30000, polling: 100 });
  await page.waitForTimeout(700);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    if (!response?.ok()) throw new Error(`A1 aircraft-side evidence navigation failed: ${response?.status() || 'no response'}`);
    const inspectionLaunch = page.getByRole('button', { name: 'Drive tug / inspect airport' });
    await inspectionLaunch.waitFor({ state: 'visible', timeout: 30000 });
    await inspectionLaunch.click();
    await page.waitForFunction(() => {
      const data = document.querySelector('canvas.trainerCanvas')?.dataset;
      return data?.inspectionMode === 'active' && data?.terminal4UploadedJetwayLoadState === 'ready' && data?.terminal4UploadedJetwayCount === '58';
    }, null, { timeout: 180000, polling: 100 });

    await page.getByLabel('Inspection location').selectOption('a1Connection');
    await page.waitForFunction(() => document.querySelector('canvas.trainerCanvas')?.dataset?.inspectionPreset === 'a1Connection', null, { timeout: 30000, polling: 100 });
    await page.evaluate(() => {
      const result = window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__?.();
      if (!result) throw new Error('Final A1 attached-evidence bridge is missing');
    });
    await page.waitForFunction(({ attachAuthority }) => {
      const data = document.querySelector('canvas.trainerCanvas')?.dataset;
      return data?.a1InspectionAttachedEvidenceAuthority === attachAuthority
        && data?.a1JetwayDeployment === '1.000'
        && data?.a1JetwayState === 'attached-to-aircraft-door';
    }, { attachAuthority: ATTACH_AUTHORITY }, { timeout: 30000, polling: 100 });

    await page.addStyleTag({ content: '.rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}' });

    const attached = await page.locator('canvas.trainerCanvas').evaluate((element) => ({ ...element.dataset }));
    if (attached.terminal4UploadedJetwayA1ServiceStairClearanceAuthority !== SERVICE_STAIR_AUTHORITY) throw new Error(`A1 service-stair authority is stale: ${attached.terminal4UploadedJetwayA1ServiceStairClearanceAuthority}`);
    if (attached.terminal4UploadedJetwayA1ServiceStairTriangleCount !== '2352') throw new Error(`A1 exact service-stair triangle count changed: ${attached.terminal4UploadedJetwayA1ServiceStairTriangleCount}`);
    const penetration = finite(attached.terminal4UploadedJetwayA1ServiceStairFuselagePenetrationMeters, 'service-stair fuselage penetration');
    const outboardClearance = finite(attached.terminal4UploadedJetwayA1ServiceStairOutboardClearanceMeters, 'service-stair outboard clearance');
    const boxSeparation = finite(attached.terminal4UploadedJetwayA1ServiceStairBoxSeparationMeters, 'service-stair fuselage-box separation');
    const doorCabSurfaceDistance = finite(attached.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters, 'exact Cab door-facing surface distance');
    // This representative-point value is retained only as telemetry. It is not the
    // final hood/sill authority; the v7 physical face/hood proof below is.
    const renderedCabDoorVerticalError = finite(attached.inspectionAircraftDoorVerticalErrorMeters, 'representative Cab/door vertical diagnostic');
    const cabDoorFacingVertexCount = finite(attached.inspectionAircraftCabDoorFacingVertexCount, 'Cab door-facing vertex count');
    const bogieGroundClearance = finite(attached.terminal4UploadedJetwayBogieGroundClearanceMeters, 'bogie ground clearance');
    const cabCenterX = finite(attached.inspectionAircraftLiveVisibleCabWorldX, 'live Cab center X');
    const cabCenterZ = finite(attached.inspectionAircraftLiveVisibleCabWorldZ, 'live Cab center Z');
    const doorCenterX = finite(attached.inspectionAircraftLiveVisibleDoorWorldX, 'live door center X');
    const doorCenterZ = finite(attached.inspectionAircraftLiveVisibleDoorWorldZ, 'live door center Z');
    const cabCenterHorizontalSeparation = Math.hypot(cabCenterX - doorCenterX, cabCenterZ - doorCenterZ);
    if (penetration > 0.001) throw new Error(`A1 exact service stair penetrates CRJ envelope by ${penetration} m`);
    if (outboardClearance < MIN_SERVICE_STAIR_CLEARANCE_METERS) throw new Error(`A1 service stair outboard clearance is only ${outboardClearance} m`);
    if (boxSeparation < MIN_SERVICE_STAIR_CLEARANCE_METERS) throw new Error(`A1 service stair fuselage-box separation is only ${boxSeparation} m`);
    if (cabCenterHorizontalSeparation < MIN_CAB_CENTER_HORIZONTAL_SEPARATION_METERS
      || cabCenterHorizontalSeparation > MAX_CAB_CENTER_HORIZONTAL_SEPARATION_METERS) {
      throw new Error(`A1 Cab body is not in the Aug. 17 outboard attached-state envelope: center separation=${cabCenterHorizontalSeparation} m`);
    }
    if (attached.inspectionAircraftCabDoorContactAuthority !== CAB_SURFACE_AUTHORITY
      || attached.inspectionAircraftCabDoorContactPlaneCovered !== 'true'
      || attached.inspectionAircraftCabDoorLaterallyCovered !== 'true'
      || attached.inspectionAircraftCabDoorVerticallyCovered !== 'true'
      || cabDoorFacingVertexCount < 3
      || doorCabSurfaceDistance > MAX_DOOR_CAB_SURFACE_DISTANCE_METERS) {
      throw new Error(`A1 exact supplied hood does not cover the fixed CRJ door: authority=${attached.inspectionAircraftCabDoorContactAuthority} distance=${doorCabSurfaceDistance} m plane=${attached.inspectionAircraftCabDoorContactPlaneCovered} lateral=${attached.inspectionAircraftCabDoorLaterallyCovered} vertical=${attached.inspectionAircraftCabDoorVerticallyCovered} vertices=${cabDoorFacingVertexCount}`);
    }
    if (Math.abs(bogieGroundClearance) > MAX_BOGIE_GROUND_CLEARANCE_METERS) throw new Error(`A1 bogie is not grounded: ${bogieGroundClearance} m`);

    const captures = {};
    await selectSubview(page, 'side-profile', 'inspectionCameraEndpointSideProfileAuthority', SIDE_PROFILE_AUTHORITY);
    const sideDataset = await page.locator('canvas.trainerCanvas').evaluate((element) => ({ ...element.dataset }));
    captures['a1-side-profile.png'] = await capture(page, 'a1-side-profile.png');
    await selectSubview(page, 'aircraft-side', 'inspectionCameraEndpointAircraftSideAuthority', AIRCRAFT_SIDE_AUTHORITY);
    const aircraftDataset = await page.locator('canvas.trainerCanvas').evaluate((element) => ({ ...element.dataset }));
    captures['a1-aircraft-side.png'] = await capture(page, 'a1-aircraft-side.png');

    const report = {
      pageUrl, capturedAtUtc: new Date().toISOString(), attachedAuthority: attached.a1InspectionAttachedEvidenceAuthority,
      deployment: attached.a1JetwayDeployment, state: attached.a1JetwayState,
      serviceStair: {
        authority: attached.terminal4UploadedJetwayA1ServiceStairClearanceAuthority,
        triangleCount: Number(attached.terminal4UploadedJetwayA1ServiceStairTriangleCount),
        swingDegrees: finite(attached.terminal4UploadedJetwayA1ServiceStairSwingDegrees, 'service-stair swing'),
        fuselagePenetrationMeters: penetration, outboardClearanceMeters: outboardClearance, fuselageBoxSeparationMeters: boxSeparation,
      },
      cabDoorSurface: {
        authority: CAB_SURFACE_AUTHORITY,
        minimumHorizontalVertexDistanceMeters: doorCabSurfaceDistance,
        representativeVerticalDiagnosticMeters: renderedCabDoorVerticalError,
        cabCenterHorizontalSeparationMeters: cabCenterHorizontalSeparation,
        doorFacingVertexCount: cabDoorFacingVertexCount,
        contactPlaneCovered: attached.inspectionAircraftCabDoorContactPlaneCovered,
        laterallyCovered: attached.inspectionAircraftCabDoorLaterallyCovered,
        verticallyCovered: attached.inspectionAircraftCabDoorVerticallyCovered,
      },
      bogieGroundClearanceMeters: bogieGroundClearance,
      sideProfile: {
        authority: sideDataset.inspectionCameraEndpointSideProfileAuthority,
        spanMeters: finite(sideDataset.inspectionCameraEndpointSideProfileSpanMeters, 'side-profile span'),
        cameraDistanceMeters: finite(sideDataset.inspectionCameraEndpointSideProfileDistanceMeters, 'side-profile distance'),
        outboardDot: finite(sideDataset.inspectionCameraEndpointSideProfileOutboardDot, 'side-profile outboard dot'),
        sideSign: finite(sideDataset.inspectionCameraEndpointSideProfileSign, 'side-profile sign'),
      },
      aircraftSide: {
        authority: aircraftDataset.inspectionCameraEndpointAircraftSideAuthority,
        spanMeters: finite(aircraftDataset.inspectionCameraEndpointAircraftSideSpanMeters, 'aircraft-side span'),
        cameraDistanceMeters: finite(aircraftDataset.inspectionCameraEndpointAircraftSideDistanceMeters, 'aircraft-side distance'),
        outboardDot: finite(aircraftDataset.inspectionCameraEndpointAircraftSideOutboardDot, 'aircraft-side outboard dot'),
        sideSign: finite(aircraftDataset.inspectionCameraEndpointAircraftSideSign, 'aircraft-side sign'),
      },
      captures, consoleErrors, pageErrors,
    };
    fs.writeFileSync(`${evidenceDirectory}/a1-aircraft-side-reference-evidence.json`, `${JSON.stringify(report, null, 2)}\n`);
    if (pageErrors.length) throw new Error(`A1 aircraft-side evidence page errors: ${pageErrors.join(' | ')}`);
    console.log(`A1 side/reference evidence passed: penetration=${penetration.toFixed(3)} m, outboard=${outboardClearance.toFixed(3)} m, box-separation=${boxSeparation.toFixed(3)} m, hood surface=${doorCabSurfaceDistance.toFixed(3)} m, Cab body center=${cabCenterHorizontalSeparation.toFixed(3)} m, representative vertical diagnostic=${renderedCabDoorVerticalError.toFixed(3)} m, bogie=${bogieGroundClearance.toFixed(3)} m.`);
  } finally { await browser.close(); }
})().catch((error) => { console.error(error.stack || error.message || error); process.exit(1); });
