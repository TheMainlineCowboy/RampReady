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
const A1_FIXED_SOURCE_GATE_AUTHORITY = 'final-live-cab-mesh-visible-door-registration-v7';
const A1_LIVE_VISUAL_CONTACT_AUTHORITY = 'live-final-visible-a1-door-cab-monitor-v1';
const STATIC_OWN_GATE_AUTHORITY = '57-static-own-gate-target-real-wall-compact-registration-v9';
const MAXIMUM_STATIC_OWN_GATE_HEADING_ERROR_RADIANS = 0.002;
const MAXIMUM_STATIC_TERMINAL_FACING_DOT = 0.25;
const MAXIMUM_A1_LIVE_HORIZONTAL_ERROR_METERS = 0.06;
const MAXIMUM_DEFERRED_A1_VERTICAL_ERROR_METERS = 6;

const fleetViews = Object.freeze([
  ['a14', 'A concourse midpoint', 'a-concourse-fleet.png', 'chase'],
  ['b14', 'B concourse midpoint', 'b-concourse-fleet.png', 'chase'],
  ['b15', 'B15 ramp', 'b15-terminal-jetways.png', 'overhead'],
]);

fs.mkdirSync(evidenceDirectory, { recursive: true });

function checkpoint(stage, detail = {}) {
  fs.writeFileSync(progressPath, `${JSON.stringify({
    stage,
    capturedAtUtc: new Date().toISOString(),
    ...detail,
  }, null, 2)}\n`);
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function selectByLabel(page, ariaLabel, optionLabel) {
  await page.evaluate(({ ariaLabel, optionLabel }) => {
    const select = document.querySelector(`select[aria-label="${ariaLabel}"]`);
    if (!(select instanceof HTMLSelectElement)) throw new Error(`${ariaLabel} control is missing`);
    const option = [...select.options].find((entry) => entry.textContent?.trim() === optionLabel);
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
  await page.waitForFunction((expected) => (
    document.querySelector('canvas.trainerCanvas')?.dataset?.inspectionPreset === expected
  ), preset, { timeout: 30000, polling: 100 });
  await page.waitForTimeout(1200);
}

async function selectA1Subview(page, subview) {
  await page.evaluate((nextSubview) => {
    const canvas = document.querySelector('canvas.trainerCanvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('A1 evidence canvas is missing');
    canvas.dataset.a1EvidenceSubview = nextSubview;
  }, subview);
  await page.waitForFunction(({ subview, currentAuthority, legacyAuthority, cameraAuthority, lockAuthority }) => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    return data?.inspectionCameraEndpointSubview === subview
      && [currentAuthority, legacyAuthority].includes(data?.inspectionCameraEndpointSubviewAuthority)
      && data?.inspectionCameraEndpointAuthority === cameraAuthority
      && data?.inspectionCameraEndpointLockAuthority === lockAuthority
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;
  }, {
    subview,
    currentAuthority: CURRENT_SUBVIEW_AUTHORITY,
    legacyAuthority: LEGACY_SUBVIEW_AUTHORITY,
    cameraAuthority: CAMERA_AUTHORITY,
    lockAuthority: LOCK_AUTHORITY,
  }, { timeout: 30000, polling: 100 });
  await page.waitForTimeout(500);
}

async function capture(page, filename) {
  const outputPath = `${evidenceDirectory}/${filename}`;
  const canvas = page.locator('canvas.trainerCanvas');
  const box = await canvas.boundingBox();
  if (!box || box.width <= 100 || box.height <= 100) {
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
        width: Math.min(box.width, 1600),
        height: Math.min(box.height, 900),
        scale: 1,
      },
    });
    fs.writeFileSync(outputPath, Buffer.from(data, 'base64'));
  } finally {
    await client.detach();
  }
  const bytes = fs.statSync(outputPath).size;
  if (bytes < 10000) throw new Error(`${filename} screenshot is implausibly small: ${bytes} bytes`);
  return bytes;
}

(async () => {
  checkpoint('launch');
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-dev-shm-usage'],
  });
  const context = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error?.message || String(error)));
  page.on('requestfailed', (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || 'unknown'}`));

  await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 120000 });
  checkpoint('loaded');
  await page.waitForSelector('canvas.trainerCanvas', { state: 'visible', timeout: 60000 });
  const inspectionButton = page.getByRole('button', { name: 'Free-drive inspection' });
  if (await inspectionButton.count()) await inspectionButton.click();
  await page.waitForFunction(() => document.querySelector('canvas.trainerCanvas')?.dataset?.inspectionMode === 'active', null, { timeout: 30000, polling: 100 });
  await selectByLabel(page, 'Inspection location', 'A1 terminal connection');
  await waitForPreset(page, 'a1Connection');

  if (typeof (await page.evaluate(() => window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__)) === 'undefined') {
    throw new Error('A1 attached visual-evidence bridge is missing');
  }
  await page.evaluate(() => window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__());
  await page.waitForFunction(() => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    return data?.a1JetwayDeployment === '1.000' && data?.a1JetwayState === 'attached-to-aircraft-door';
  }, null, { timeout: 30000, polling: 100 });
  await page.waitForTimeout(800);

  const a1 = await page.locator('canvas.trainerCanvas').evaluate((element) => ({ ...element.dataset }));
  const geometryFailures = [];
  const deferredGeometry = [];
  if (a1.terminal4UploadedJetwayA1VisualAuthority !== A1_VISUAL_AUTHORITY) {
    geometryFailures.push(`A1 visual authority is wrong: ${a1.terminal4UploadedJetwayA1VisualAuthority}`);
  }
  if (Math.abs(Number(a1.terminal4UploadedJetwayBogieGroundClearanceMeters)) > 0.005) {
    geometryFailures.push(`A1 bogie is not grounded: ${a1.terminal4UploadedJetwayBogieGroundClearanceMeters}`);
  }
  if (a1.inspectionAircraftFixedSourceGateAuthority !== A1_FIXED_SOURCE_GATE_AUTHORITY) {
    geometryFailures.push(`A1 final live-Cab placement authority is wrong: ${a1.inspectionAircraftFixedSourceGateAuthority}`);
  }
  if (a1.inspectionAircraftLiveVisibleContactAuthority !== A1_LIVE_VISUAL_CONTACT_AUTHORITY) {
    geometryFailures.push(`A1 live visual monitor authority is wrong: ${a1.inspectionAircraftLiveVisibleContactAuthority}`);
  }
  if (a1.a1JetwayDeployment !== '1.000' || a1.a1JetwayState !== 'attached-to-aircraft-door') {
    geometryFailures.push(`A1 contact evidence was not captured attached: deployment=${a1.a1JetwayDeployment} state=${a1.a1JetwayState}`);
  }

  for (const [label, value] of [
    ['live Cab X', a1.inspectionAircraftLiveVisibleCabWorldX],
    ['live Cab Y', a1.inspectionAircraftLiveVisibleCabWorldY],
    ['live Cab Z', a1.inspectionAircraftLiveVisibleCabWorldZ],
    ['live door X', a1.inspectionAircraftLiveVisibleDoorWorldX],
    ['live door Y', a1.inspectionAircraftLiveVisibleDoorWorldY],
    ['live door Z', a1.inspectionAircraftLiveVisibleDoorWorldZ],
    ['live Cab vertex count', a1.inspectionAircraftLiveVisibleCabVertexCount],
    ['live Cab endpoint count', a1.inspectionAircraftLiveVisibleCabEndpointVertexCount],
  ]) {
    if (finiteNumber(value) === null) geometryFailures.push(`A1 ${label} is missing: ${value}`);
  }
  if (Number(a1.inspectionAircraftLiveVisibleCabVertexCount) < 100
    || Number(a1.inspectionAircraftLiveVisibleCabEndpointVertexCount) < 3) {
    geometryFailures.push(`A1 live Cab sample is invalid: vertices=${a1.inspectionAircraftLiveVisibleCabVertexCount} endpoint=${a1.inspectionAircraftLiveVisibleCabEndpointVertexCount}`);
  }

  const liveHorizontalError = finiteNumber(a1.inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters);
  if (liveHorizontalError === null || liveHorizontalError > MAXIMUM_A1_LIVE_HORIZONTAL_ERROR_METERS) {
    geometryFailures.push(`A1 live visible door/Cab horizontal error is unacceptable while attached: ${a1.inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters} m`);
  }

  const verticalError = finiteNumber(a1.inspectionAircraftDoorVerticalErrorMeters);
  if (verticalError === null || Math.abs(verticalError) > MAXIMUM_DEFERRED_A1_VERTICAL_ERROR_METERS) {
    geometryFailures.push(`A1 deferred door-height gap escaped safe bounds: ${a1.inspectionAircraftDoorVerticalErrorMeters} m`);
  } else if (Math.abs(verticalError) > 0.5) {
    deferredGeometry.push(`A1 bridge lift remains deferred: vertical gap=${verticalError.toFixed(3)} m; aircraft and exact bogie remain grounded.`);
  }
  if (a1.inspectionAircraftJetwayAuthoredBogieGroundPreserved !== 'true') {
    geometryFailures.push(`A1 exact bogie ground preservation is false: ${a1.inspectionAircraftJetwayAuthoredBogieGroundPreserved}`);
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
  if (maximumOwnGateHeadingError === null
    || maximumOwnGateHeadingError > MAXIMUM_STATIC_OWN_GATE_HEADING_ERROR_RADIANS) {
    geometryFailures.push(`Static maximum own-gate heading error is invalid: ${a1.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians}`);
  }
  const maximumTerminalFacingDot = finiteNumber(a1.terminal4UploadedJetwayStaticMaximumTerminalFacingDot);
  if (maximumTerminalFacingDot === null || maximumTerminalFacingDot > MAXIMUM_STATIC_TERMINAL_FACING_DOT) {
    geometryFailures.push(`Static fleet contains a bridge aimed back toward the terminal: max dot=${a1.terminal4UploadedJetwayStaticMaximumTerminalFacingDot}`);
  }

  const captures = {};
  await selectA1Subview(page, 'terminal-joint');
  captures['a1-terminal-joint-close.png'] = await capture(page, 'a1-terminal-joint-close.png');
  await selectA1Subview(page, 'bogie-contact');
  captures['a1-bogie-contact-close.png'] = await capture(page, 'a1-bogie-contact-close.png');
  await selectA1Subview(page, 'side-profile');
  captures['a1-side-profile.png'] = await capture(page, 'a1-side-profile.png');
  await selectA1Subview(page, 'aircraft-side');
  captures['a1-aircraft-side.png'] = await capture(page, 'a1-aircraft-side.png');
  await selectA1Subview(page, 'full-assembly');
  captures['a1-terminal-connection.png'] = await capture(page, 'a1-terminal-connection.png');
  await selectByValue(page, 'Camera view', 'overhead');
  await page.waitForTimeout(1000);
  captures['a1-terminal-overhead.png'] = await capture(page, 'a1-terminal-overhead.png');
  checkpoint('a1-complete', { captures: Object.keys(captures), geometryFailures, deferredGeometry, liveHorizontalError });

  for (const [preset, label, filename, cameraView] of fleetViews) {
    await selectByLabel(page, 'Inspection location', label);
    await waitForPreset(page, preset);
    await selectByValue(page, 'Camera view', cameraView);
    await page.waitForTimeout(900);
    captures[filename] = await capture(page, filename);
    checkpoint(`${preset}-complete`, { filename, bytes: captures[filename] });
  }

  const finalDataset = await page.locator('canvas.trainerCanvas').evaluate((element) => ({ ...element.dataset }));
  const finalLiveError = finiteNumber(finalDataset.inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters);
  const finalDeployment = finiteNumber(finalDataset.a1JetwayDeployment);
  if (finalDataset.inspectionAircraftLiveVisibleContactAuthority !== A1_LIVE_VISUAL_CONTACT_AUTHORITY) {
    geometryFailures.push(`A1 live visual monitor stopped before final fleet capture: ${finalDataset.inspectionAircraftLiveVisibleContactAuthority}`);
  }
  if (finalDeployment === null) {
    geometryFailures.push(`A1 final deployment telemetry is invalid: ${finalDataset.a1JetwayDeployment}`);
  } else if (Math.abs(finalDeployment - 1) <= 0.001) {
    if (finalLiveError === null || finalLiveError > MAXIMUM_A1_LIVE_HORIZONTAL_ERROR_METERS) {
      geometryFailures.push(`A1 live visible contact drifted while still attached: error=${finalDataset.inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters}`);
    }
  } else if (Math.abs(finalDeployment) <= 0.001) {
    if (finalDataset.a1JetwayState !== 'parked-clear-of-aircraft') {
      geometryFailures.push(`A1 retracted after fleet capture but did not report the parked state: ${finalDataset.a1JetwayState}`);
    }
  } else {
    geometryFailures.push(`A1 ended fleet evidence in an unexpected intermediate deployment: ${finalDataset.a1JetwayDeployment}`);
  }

  const criticalConsole = consoleErrors.filter((message) => /Exact jetway readiness mismatch|Airport_Jetway\.glb fleet|A1 Rotunda|Static jetway|Terminal 4|KPHX|ReferenceError|TypeError|SyntaxError/i.test(message));
  const criticalFailedRequests = failedRequests.filter((message) => /airport-jetway|phx-terminal4|kphx-ground|kphx-photo|assets\/.*\.js/i.test(message));

  fs.writeFileSync(`${evidenceDirectory}/report.json`, `${JSON.stringify({
    capturedAtUtc: new Date().toISOString(),
    pageUrl,
    captures,
    geometryFailures,
    deferredGeometry,
    consoleErrors,
    pageErrors,
    failedRequests,
    a1TelemetryAtA1Capture: a1,
    finalTelemetry: finalDataset,
  }, null, 2)}\n`);

  if (geometryFailures.length) throw new Error(`Fleet geometry acceptance failed: ${geometryFailures.join(' | ')}`);
  if (criticalConsole.length) throw new Error(`Fleet evidence critical console errors: ${criticalConsole.join(' | ')}`);
  if (pageErrors.length) throw new Error(`Fleet evidence page errors: ${pageErrors.join(' | ')}`);
  if (criticalFailedRequests.length) throw new Error(`Fleet evidence failed requests: ${criticalFailedRequests.join(' | ')}`);

  checkpoint('complete', {
    captures,
    deferredGeometry,
    attachedLiveHorizontalError: liveHorizontalError,
    finalDeployment,
    finalLiveError,
  });
  await context.close();
  await browser.close();
  console.log(`TERMINAL 4 FLEET VISUAL EVIDENCE ACCEPTED: ${Object.keys(captures).join(', ')}`);
  console.log(`A1 LIVE ATTACHED CONTACT ACCEPTED: ${liveHorizontalError.toFixed(6)} m horizontal error at deployment 1.000.`);
  if (deferredGeometry.length) console.log(`DEFERRED HEIGHT ONLY: ${deferredGeometry.join(' | ')}`);
})().catch((error) => {
  checkpoint('failed', { error: error?.stack || error?.message || String(error) });
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
