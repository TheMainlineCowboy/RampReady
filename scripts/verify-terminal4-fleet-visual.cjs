const { chromium } = require('@playwright/test');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDirectory = process.env.EVIDENCE_DIR || 'jetway-visual-evidence';
const progressPath = `${evidenceDirectory}/capture-progress.json`;
const CURRENT_SUBVIEW_AUTHORITY = 'source-measured-a1-terminal-joint-camera-v3';
const LEGACY_SUBVIEW_AUTHORITY = 'exact-a1-terminal-joint-and-bogie-contact-subviews-v2';
const CAMERA_AUTHORITY = 'exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2';
const LOCK_AUTHORITY = 'exact-a1-evidence-camera-direct-lock-v1';
const A1_VISUAL_AUTHORITY = 'same-day-a1-continuous-source-measured-solid-closed-grounded-v2';
const STATIC_OWN_GATE_AUTHORITY = '57-static-own-gate-target-real-wall-compact-registration-v9';
const MAXIMUM_STATIC_OWN_GATE_HEADING_ERROR_RADIANS = 0.002;
const MAXIMUM_STATIC_TERMINAL_FACING_DOT = 0.25;
const MAXIMUM_A1_HORIZONTAL_DOOR_ERROR_METERS = 0.06;
// A1 bridge height is intentionally deferred. The user explicitly asked that
// exact aircraft-height fit not block the airport/jetway placement work. Keep
// the signed vertical gap finite and visible in the report, but never "fix" it
// by floating the bogie or aircraft. A later bridge-lift rig will own Y.
const MAXIMUM_DEFERRED_A1_DOOR_VERTICAL_ERROR_METERS = 6;

const views = Object.freeze([
  ['a14', 'A concourse midpoint', 'a-concourse-fleet.png', 'chase'],
  ['b14', 'B concourse midpoint', 'b-concourse-fleet.png', 'chase'],
  ['b15', 'B15 ramp', 'b15-terminal-jetways.png', 'overhead'],
]);

fs.mkdirSync(evidenceDirectory, { recursive: true });

function checkpoint(stage, detail = {}) {
  fs.writeFileSync(progressPath, `${JSON.stringify({ stage, capturedAtUtc: new Date().toISOString(), ...detail }, null, 2)}\n`);
}

async function selectByLabel(page, ariaLabel, optionLabel) {
  await page.evaluate(({ ariaLabel, optionLabel }) => {
    const select = document.querySelector(`select[aria-label="${ariaLabel}"]`);
    if (!(select instanceof HTMLSelectElement)) throw new Error(`${ariaLabel} control is missing`);
    const option = [...select.options].find(entry => entry.textContent?.trim() === optionLabel);
    if (!option) throw new Error(`${ariaLabel} option is missing: ${optionLabel}`);
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, { ariaLabel, optionLabel });
}

async function selectByValue(page, ariaLabel, value) {
  await page.evaluate(({ ariaLabel, value }) => {
    const select = document.querySelector(`select[aria-label="${ariaLabel}"]`);
    if (!(select instanceof HTMLSelectElement)) throw new Error(`${ariaLabel} control is missing`);
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, { ariaLabel, value });
}

async function waitForPreset(page, preset) {
  await page.waitForFunction(expected => document.querySelector('canvas.trainerCanvas')?.dataset?.inspectionPreset === expected, preset, {
    timeout: 30000,
    polling: 100,
  });
  await page.waitForTimeout(1200);
}

async function selectA1Subview(page, subview) {
  await page.evaluate(nextSubview => {
    const canvas = document.querySelector('canvas.trainerCanvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('A1 fleet evidence canvas is missing');
    canvas.dataset.a1EvidenceSubview = nextSubview;
  }, subview);
  await page.waitForFunction(({ subview, currentAuthority, legacyAuthority, cameraAuthority, lockAuthority }) => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    return data?.inspectionCameraEndpointSubview === subview
      && [currentAuthority, legacyAuthority].includes(data?.inspectionCameraEndpointSubviewAuthority)
      && data?.inspectionCameraEndpointAuthority === cameraAuthority
      && data?.inspectionCameraEndpointLockAuthority === lockAuthority
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;
  }, { subview, currentAuthority: CURRENT_SUBVIEW_AUTHORITY, legacyAuthority: LEGACY_SUBVIEW_AUTHORITY, cameraAuthority: CAMERA_AUTHORITY, lockAuthority: LOCK_AUTHORITY }, {
    timeout: 30000,
    polling: 100,
  });
  await page.waitForTimeout(500);
}

async function capture(page, filename) {
  const path = `${evidenceDirectory}/${filename}`;
  const canvas = page.locator('canvas.trainerCanvas');
  const box = await canvas.boundingBox();
  if (!box || !(box.width > 100) || !(box.height > 100)) {
    throw new Error(`${filename} cannot capture a visible Three.js canvas`);
  }
  const client = await page.context().newCDPSession(page);
  try {
    const { data } = await client.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
      clip: {
        x: Math.max(0, box.x),
        y: Math.max(0, box.y),
        width: box.width,
        height: box.height,
        scale: 1,
      },
    });
    const payload = Buffer.from(data, 'base64');
    fs.writeFileSync(path, payload);
  } finally {
    await client.detach();
  }
  const bytes = fs.statSync(path).size;
  if (bytes < 100000) throw new Error(`${filename} is unexpectedly small: ${bytes}`);
  return bytes;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

(async () => {
  checkpoint('launch');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const geometryFailures = [];
  const deferredGeometry = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`));

  const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (!response?.ok()) throw new Error(`Fleet evidence navigation failed: ${response?.status() || 'no response'}`);
  const inspectionLaunch = page.getByRole('button', { name: 'Drive tug / inspect airport' });
  await inspectionLaunch.waitFor({ state: 'visible', timeout: 30000 });
  await inspectionLaunch.click();

  try {
    await page.waitForFunction(() => {
      const data = document.querySelector('canvas.trainerCanvas')?.dataset;
      return data?.inspectionMode === 'active'
        && data?.terminal4UploadedJetwayLoadState === 'ready'
        && data?.terminal4UploadedJetwayCount === '58'
        && data?.terminal4UploadedJetwayConnectorCount === '58';
    }, null, { timeout: 180000, polling: 100 });
  } catch (error) {
    const readinessDataset = await page.locator('canvas.trainerCanvas').evaluate(element => ({ ...element.dataset })).catch(() => ({}));
    fs.writeFileSync(`${evidenceDirectory}/readiness-diagnostic.json`, `${JSON.stringify({
      capturedAtUtc: new Date().toISOString(),
      dataset: readinessDataset,
      consoleErrors,
      pageErrors,
      failedRequests,
      originalError: error?.stack || error?.message || String(error),
    }, null, 2)}\n`);
    throw new Error(`Fleet readiness failed before visual capture. loadState=${readinessDataset.terminal4UploadedJetwayLoadState || 'missing'} count=${readinessDataset.terminal4UploadedJetwayCount || 'missing'} connectors=${readinessDataset.terminal4UploadedJetwayConnectorCount || 'missing'} console=${consoleErrors.join(' | ') || 'none'} page=${pageErrors.join(' | ') || 'none'}`);
  }
  checkpoint('fleet-ready');

  const captures = {};
  await selectByValue(page, 'Camera view', 'chase');
  await selectByLabel(page, 'Inspection location', 'A1 terminal connection');
  await waitForPreset(page, 'a1Connection');

  const a1 = await page.locator('canvas.trainerCanvas').evaluate(element => ({ ...element.dataset }));
  if (a1.terminal4UploadedJetwayA1VisualAcceptanceAuthority !== A1_VISUAL_AUTHORITY) {
    geometryFailures.push(`A1 visual authority is stale: ${a1.terminal4UploadedJetwayA1VisualAcceptanceAuthority}`);
  }
  if (a1.terminal4UploadedJetwayA1AssemblyPartCount !== '5' || a1.terminal4UploadedJetwayA1IsolatedNodeRotationCount !== '0') {
    geometryFailures.push(`A1 authored assembly continuity failed: parts=${a1.terminal4UploadedJetwayA1AssemblyPartCount} isolated=${a1.terminal4UploadedJetwayA1IsolatedNodeRotationCount}`);
  }
  if (Math.abs(Number(a1.terminal4UploadedJetwayBogieGroundClearanceMeters)) > 0.005) {
    geometryFailures.push(`A1 bogie is not grounded: ${a1.terminal4UploadedJetwayBogieGroundClearanceMeters}`);
  }
  const a1HorizontalDoorError = finiteNumber(a1.inspectionAircraftCabContactErrorMeters);
  if (a1HorizontalDoorError === null || Math.abs(a1HorizontalDoorError) > MAXIMUM_A1_HORIZONTAL_DOOR_ERROR_METERS) {
    geometryFailures.push(`A1 Cab/aircraft horizontal door error is unacceptable: ${a1.inspectionAircraftCabContactErrorMeters} m`);
  }
  const a1SourceGateDoorError = finiteNumber(a1.inspectionAircraftSourceGateDoorTargetErrorMeters);
  if (a1SourceGateDoorError === null || Math.abs(a1SourceGateDoorError) > MAXIMUM_A1_HORIZONTAL_DOOR_ERROR_METERS) {
    geometryFailures.push(`A1 source-gate door target error is unacceptable: ${a1.inspectionAircraftSourceGateDoorTargetErrorMeters} m`);
  }
  const a1DoorVerticalError = finiteNumber(a1.inspectionAircraftDoorVerticalErrorMeters);
  if (a1DoorVerticalError === null || Math.abs(a1DoorVerticalError) > MAXIMUM_DEFERRED_A1_DOOR_VERTICAL_ERROR_METERS) {
    geometryFailures.push(`A1 deferred door-height gap escaped safe bounds: ${a1.inspectionAircraftDoorVerticalErrorMeters} m`);
  } else if (Math.abs(a1DoorVerticalError) > 0.5) {
    deferredGeometry.push(`A1 bridge lift remains deferred: Cab/aircraft door vertical gap=${a1DoorVerticalError.toFixed(3)} m; aircraft and bogie remain grounded.`);
  }
  if (a1.inspectionAircraftJetwayAuthoredBogieGroundPreserved !== 'true') {
    geometryFailures.push(`A1 exact-model bogie ground preservation is false: ${a1.inspectionAircraftJetwayAuthoredBogieGroundPreserved}`);
  }
  if (a1.terminal4TerminalConnectedJetwayCount !== '58') {
    geometryFailures.push(`Terminal-connected jetway count is not 58: ${a1.terminal4TerminalConnectedJetwayCount}`);
  }
  if (a1.terminal4UploadedJetwayStaticOwnGateTargetAuthority !== STATIC_OWN_GATE_AUTHORITY) {
    geometryFailures.push(`Static own-gate authority is wrong: ${a1.terminal4UploadedJetwayStaticOwnGateTargetAuthority}`);
  }
  if (a1.terminal4UploadedJetwayStaticOwnGateTargetCount !== '57') {
    geometryFailures.push(`Static own-gate target count is not 57: ${a1.terminal4UploadedJetwayStaticOwnGateTargetCount}`);
  }
  const maximumOwnGateHeadingError = finiteNumber(a1.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians);
  if (maximumOwnGateHeadingError === null || maximumOwnGateHeadingError > MAXIMUM_STATIC_OWN_GATE_HEADING_ERROR_RADIANS) {
    geometryFailures.push(`Static maximum own-gate heading error is invalid: ${a1.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians}`);
  }
  const maximumTerminalFacingDot = finiteNumber(a1.terminal4UploadedJetwayStaticMaximumTerminalFacingDot);
  if (maximumTerminalFacingDot === null || maximumTerminalFacingDot > MAXIMUM_STATIC_TERMINAL_FACING_DOT) {
    geometryFailures.push(`Static fleet includes a bridge aimed back toward the terminal: max dot=${a1.terminal4UploadedJetwayStaticMaximumTerminalFacingDot}`);
  }

  await selectA1Subview(page, 'terminal-joint');
  captures['a1-terminal-joint-close.png'] = await capture(page, 'a1-terminal-joint-close.png');
  await selectA1Subview(page, 'bogie-contact');
  captures['a1-bogie-contact-close.png'] = await capture(page, 'a1-bogie-contact-close.png');
  await selectA1Subview(page, 'full-assembly');
  captures['a1-terminal-connection.png'] = await capture(page, 'a1-terminal-connection.png');
  await selectByValue(page, 'Camera view', 'overhead');
  await page.waitForTimeout(1000);
  captures['a1-terminal-overhead.png'] = await capture(page, 'a1-terminal-overhead.png');
  checkpoint('a1-complete', { captures: Object.keys(captures), geometryFailures, deferredGeometry });

  for (const [preset, label, filename, cameraView] of views) {
    await selectByLabel(page, 'Inspection location', label);
    await waitForPreset(page, preset);
    await selectByValue(page, 'Camera view', cameraView);
    await page.waitForTimeout(900);
    captures[filename] = await capture(page, filename);
    checkpoint(`${preset}-complete`, { label, filename, cameraView, bytes: captures[filename] });
  }

  const criticalConsole = consoleErrors.filter(message => /Exact jetway readiness mismatch|Airport_Jetway\.glb fleet|A1 Rotunda|Static jetway|Terminal 4|KPHX|ReferenceError|TypeError|SyntaxError/i.test(message));
  const criticalFailedRequests = failedRequests.filter(message => /airport-jetway|phx-terminal4|kphx-ground|kphx-photo|assets\/.*\.js/i.test(message));

  fs.writeFileSync(`${evidenceDirectory}/report.json`, `${JSON.stringify({
    capturedAtUtc: new Date().toISOString(),
    pageUrl,
    captures,
    geometryFailures,
    deferredGeometry,
    consoleErrors,
    pageErrors,
    failedRequests,
    a1Telemetry: a1,
  }, null, 2)}\n`);
  checkpoint('captured-and-validated', { captures, geometryFailures, deferredGeometry });

  if (geometryFailures.length) throw new Error(`Fleet geometry acceptance failed: ${geometryFailures.join(' | ')}`);
  if (criticalConsole.length) throw new Error(`Fleet evidence critical console errors: ${criticalConsole.join(' | ')}`);
  if (pageErrors.length) throw new Error(`Fleet evidence page errors: ${pageErrors.join(' | ')}`);
  if (criticalFailedRequests.length) throw new Error(`Fleet evidence failed requests: ${criticalFailedRequests.join(' | ')}`);

  checkpoint('complete', { captures, deferredGeometry });
  await context.close();
  await browser.close();
  console.log(`TERMINAL 4 FLEET VISUAL EVIDENCE ACCEPTED: ${Object.keys(captures).join(', ')}`);
  if (deferredGeometry.length) console.log(`DEFERRED HEIGHT ONLY: ${deferredGeometry.join(' | ')}`);
})().catch(async error => {
  checkpoint('failed', { error: error?.stack || error?.message || String(error) });
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
