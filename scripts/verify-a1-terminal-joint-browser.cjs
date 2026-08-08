const { chromium } = require('playwright');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDir = process.env.EVIDENCE_DIR || 'a1-terminal-joint-evidence';
const CURRENT_SUBVIEW_AUTHORITY = 'source-measured-a1-terminal-joint-camera-v3';
const LEGACY_SUBVIEW_AUTHORITY = 'exact-a1-terminal-joint-and-bogie-contact-subviews-v2';
const CAMERA_AUTHORITY = 'exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2';
const LOCK_AUTHORITY = 'exact-a1-evidence-camera-direct-lock-v1';
const VISUAL_AUTHORITY = 'same-day-a1-continuous-source-measured-solid-closed-grounded-v2';
const CONTINUITY_AUTHORITY = 'exact-authored-five-part-chain-no-isolated-node-rotation-v2';
const BOGIE_AUTHORITY = 'exact-authored-a1-lowest-geometry-ramp-contact-v2';
const WALL_AUTHORITY = 'nearest-structural-terminal-facade-photo-verified-v1';
fs.mkdirSync(evidenceDir, { recursive: true });

function numeric(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label} is not finite: ${value}`);
  return number;
}

async function captureCanvas(page, canvas, path) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const box = await canvas.boundingBox();
  if (!box) throw new Error('A1 evidence canvas has no bounds');
  const session = await page.context().newCDPSession(page);
  try {
    const result = await session.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
      clip: {
        x: Math.max(0, Math.floor(box.x)),
        y: Math.max(0, Math.floor(box.y)),
        width: Math.floor(box.width),
        height: Math.floor(box.height),
        scale: 1,
      },
    });
    const payload = Buffer.from(result.data, 'base64');
    if (payload.length < 10000) throw new Error(`A1 evidence screenshot is unexpectedly small: ${payload.length}`);
    fs.writeFileSync(path, payload);
  } finally {
    await session.detach();
  }
}

function subviewAuthorityAccepted(value) {
  return value === CURRENT_SUBVIEW_AUTHORITY || value === LEGACY_SUBVIEW_AUTHORITY;
}

async function selectSubview(page, subview) {
  await page.evaluate(nextSubview => {
    const canvas = document.querySelector('canvas.trainerCanvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('A1 evidence canvas is missing');
    canvas.dataset.a1EvidenceSubview = nextSubview;
  }, subview);
  await page.waitForFunction(({ expectedSubview, currentAuthority, legacyAuthority, cameraAuthority, lockAuthority }) => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    return data?.inspectionCameraEndpointSubview === expectedSubview
      && [currentAuthority, legacyAuthority].includes(data?.inspectionCameraEndpointSubviewAuthority)
      && data?.inspectionCameraEndpointAuthority === cameraAuthority
      && data?.inspectionCameraEndpointLockAuthority === lockAuthority
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;
  }, {
    expectedSubview: subview,
    currentAuthority: CURRENT_SUBVIEW_AUTHORITY,
    legacyAuthority: LEGACY_SUBVIEW_AUTHORITY,
    cameraAuthority: CAMERA_AUTHORITY,
    lockAuthority: LOCK_AUTHORITY,
  }, { timeout: 30000, polling: 100 });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));

  const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (!response?.ok()) throw new Error(`A1 evidence navigation failed: ${response?.status() || 'no response'}`);

  const inspectionLaunch = page.getByRole('button', { name: 'Drive tug / inspect airport' });
  await inspectionLaunch.waitFor({ state: 'visible', timeout: 30000 });
  await inspectionLaunch.click();

  const canvas = page.locator('canvas.trainerCanvas');
  await canvas.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(({ visualAuthority, continuityAuthority, bogieAuthority, wallAuthority }) => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    const vestibule = Number(data?.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters);
    const wallDistance = Number(data?.terminal4A1JetwayWallDistance);
    const clearance = Number(data?.terminal4UploadedJetwayBogieGroundClearanceMeters);
    return data?.inspectionMode === 'active'
      && data?.terminal4UploadedJetwayLoadState === 'ready'
      && data?.terminal4UploadedJetwayCount === '58'
      && data?.terminal4UploadedJetwayA1VisualAcceptanceAuthority === visualAuthority
      && data?.terminal4UploadedJetwayA1AssemblyContinuityAuthority === continuityAuthority
      && data?.terminal4UploadedJetwayA1AssemblyPartCount === '5'
      && data?.terminal4UploadedJetwayA1IsolatedNodeRotationCount === '0'
      && data?.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed === 'true'
      && data?.terminal4UploadedJetwayA1NoGeneratedGlassCorridor === 'true'
      && data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieAuthority
      && Math.abs(clearance) <= 0.005
      && Number(data?.terminal4UploadedJetwayBogieGroundContactPointCount) >= 8
      && Number(data?.terminal4UploadedJetwayBogieGroundContactClusterCount) >= 2
      && Number(data?.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters) >= 1.2
      && Number.isFinite(vestibule)
      && Math.abs(vestibule - 2.4) <= 0.05
      && Number.isFinite(wallDistance)
      && wallDistance > 2.9
      && wallDistance < 5.8
      && data?.terminal4A1ConnectionAuthority === wallAuthority;
  }, {
    visualAuthority: VISUAL_AUTHORITY,
    continuityAuthority: CONTINUITY_AUTHORITY,
    bogieAuthority: BOGIE_AUTHORITY,
    wallAuthority: WALL_AUTHORITY,
  }, { timeout: 120000, polling: 100 });

  const inspectionLocation = page.getByRole('combobox', { name: 'Inspection location' });
  await inspectionLocation.waitFor({ state: 'visible', timeout: 30000 });
  await inspectionLocation.selectOption({ label: 'A1 terminal connection' });
  await page.waitForFunction(() => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    return data?.inspectionPreset === 'a1Connection'
      && data?.a1JetwayDeployment === '1.000'
      && data?.a1JetwayState === 'attached-to-aircraft-door';
  }, null, { timeout: 30000, polling: 100 });

  await page.addStyleTag({ content: '.rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}' });

  await selectSubview(page, 'terminal-joint');
  await page.waitForTimeout(750);
  const terminalData = await canvas.evaluate(element => ({ ...element.dataset }));
  if (!subviewAuthorityAccepted(terminalData.inspectionCameraEndpointSubviewAuthority)) {
    throw new Error(`Unexpected A1 terminal-joint subview authority: ${terminalData.inspectionCameraEndpointSubviewAuthority}`);
  }
  await captureCanvas(page, canvas, `${evidenceDir}/a1-terminal-joint.png`);

  await selectSubview(page, 'bogie-contact');
  await page.waitForTimeout(750);
  const bogieData = await canvas.evaluate(element => ({ ...element.dataset }));
  await captureCanvas(page, canvas, `${evidenceDir}/a1-bogie-contact.png`);

  await selectSubview(page, 'full-assembly');
  await page.waitForTimeout(750);
  const assemblyData = await canvas.evaluate(element => ({ ...element.dataset }));
  await captureCanvas(page, canvas, `${evidenceDir}/a1-full-assembly.png`);

  const cameraView = page.getByRole('combobox', { name: 'Camera view' });
  await cameraView.waitFor({ state: 'visible', timeout: 10000 });
  await cameraView.selectOption('overhead');
  await page.waitForTimeout(1200);
  await captureCanvas(page, canvas, `${evidenceDir}/a1-terminal-joint-overhead.png`);

  const report = {
    pageUrl,
    capturedAtUtc: new Date().toISOString(),
    consoleErrors,
    pageErrors,
    terminalTelemetry: terminalData,
    bogieTelemetry: bogieData,
    assemblyTelemetry: assemblyData,
  };
  fs.writeFileSync(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2));

  await browser.close();
  if (pageErrors.length) throw new Error(`A1 evidence page errors: ${pageErrors.join(' | ')}`);
  console.log(`A1 TERMINAL JOINT EVIDENCE READY: ${JSON.stringify({
    vestibule: numeric(terminalData.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters, 'visible vestibule'),
    bogieClearanceMeters: numeric(bogieData.terminal4UploadedJetwayBogieGroundClearanceMeters, 'bogie clearance'),
    subviewAuthority: terminalData.inspectionCameraEndpointSubviewAuthority,
  })}`);
})().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
