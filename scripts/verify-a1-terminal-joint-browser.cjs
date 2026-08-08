const { chromium } = require('playwright');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDir = process.env.EVIDENCE_DIR || 'a1-terminal-joint-evidence';
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

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));

  const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (!response?.ok()) throw new Error(`A1 evidence navigation failed: ${response?.status() || 'no response'}`);

  // Use the same production inspection route a user uses. The previous global
  // evidence bridge is a build-time convenience and is not guaranteed to
  // survive the final production bundle.
  const inspectionLaunch = page.getByRole('button', { name: 'Drive tug / inspect airport' });
  await inspectionLaunch.waitFor({ state: 'visible', timeout: 30000 });
  await inspectionLaunch.click();

  const canvas = page.locator('canvas.trainerCanvas');
  await canvas.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => {
    const canvas = document.querySelector('canvas.trainerCanvas');
    return canvas?.dataset.inspectionMode === 'active'
      && canvas?.dataset.terminal4UploadedJetwayLoadState === 'ready'
      && canvas?.dataset.terminal4UploadedJetwayCount === '58';
  }, null, { timeout: 90000 });

  const inspectionLocation = page.getByRole('combobox', { name: 'Inspection location' });
  await inspectionLocation.waitFor({ state: 'visible', timeout: 30000 });
  await inspectionLocation.selectOption({ label: 'A1 terminal connection' });
  await page.waitForFunction(() => document.querySelector('canvas.trainerCanvas')?.dataset.inspectionPreset === 'a1Connection', null, { timeout: 30000 });

  // A1 terminal connection defaults to a full-assembly view. Select the actual
  // production terminal-joint evidence subview before inspecting or capturing.
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.trainerCanvas');
    if (!(canvas instanceof HTMLCanvasElement)) throw new Error('A1 evidence canvas is missing');
    canvas.dataset.a1EvidenceSubview = 'terminal-joint';
  });
  await page.waitForFunction(() => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    return data?.inspectionCameraEndpointSubview === 'terminal-joint'
      && data?.inspectionCameraEndpointSubviewAuthority === 'exact-a1-terminal-joint-and-bogie-contact-subviews-v2'
      && data?.inspectionCameraEndpointAuthority === 'exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2'
      && data?.inspectionCameraEndpointLockAuthority === 'exact-a1-evidence-camera-direct-lock-v1'
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;
  }, null, { timeout: 30000 });
  await page.waitForTimeout(750);

  const data = await canvas.evaluate(element => ({ ...element.dataset }));
  const failures = [];
  if (data.terminal4UploadedJetwayA1AssemblyContinuityAuthority !== 'exact-authored-five-part-chain-no-isolated-node-rotation-v2') failures.push(`continuity=${data.terminal4UploadedJetwayA1AssemblyContinuityAuthority}`);
  if (data.terminal4UploadedJetwayA1IsolatedNodeRotationCount !== '0') failures.push(`isolated rotations=${data.terminal4UploadedJetwayA1IsolatedNodeRotationCount}`);
  if (data.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed !== 'true') failures.push('apron-facing Rotunda opening is not closed');
  if (data.terminal4UploadedJetwayA1NoGeneratedGlassCorridor !== 'true') failures.push('generated glass/long corridor authority is active');
  if (data.terminal4UploadedJetwayBogieGroundContactAuthority !== 'exact-authored-a1-lowest-geometry-ramp-contact-v2') failures.push(`bogie authority=${data.terminal4UploadedJetwayBogieGroundContactAuthority}`);
  if (numeric(data.terminal4UploadedJetwayBogieGroundClearanceMeters, 'bogie clearance') > 0.02) failures.push(`bogie clearance=${data.terminal4UploadedJetwayBogieGroundClearanceMeters}m`);
  const vestibule = numeric(data.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters, 'visible vestibule length');
  if (vestibule < 1.5 || vestibule > 3.5) failures.push(`visible vestibule=${vestibule}m`);
  if (data.terminal4A1ConnectionAuthority !== 'nearest-structural-terminal-facade-photo-verified-v1') failures.push(`wall authority=${data.terminal4A1ConnectionAuthority}`);
  if (data.inspectionPreset !== 'a1Connection') failures.push(`preset=${data.inspectionPreset}`);
  if (data.inspectionCameraEndpointSubview !== 'terminal-joint') failures.push(`subview=${data.inspectionCameraEndpointSubview}`);

  await page.addStyleTag({ content: '.rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}' });
  await captureCanvas(page, canvas, `${evidenceDir}/a1-terminal-joint.png`);

  const cameraView = page.getByRole('combobox', { name: 'Camera view' });
  await cameraView.waitFor({ state: 'visible', timeout: 10000 });
  await cameraView.selectOption('overhead');
  await page.waitForTimeout(1200);
  await captureCanvas(page, canvas, `${evidenceDir}/a1-terminal-joint-overhead.png`);

  const report = {
    pageUrl,
    capturedAtUtc: new Date().toISOString(),
    failures,
    consoleErrors,
    pageErrors,
    telemetry: data,
  };
  fs.writeFileSync(`${evidenceDir}/report.json`, JSON.stringify(report, null, 2));

  await browser.close();
  if (pageErrors.length) throw new Error(`A1 evidence page errors: ${pageErrors.join(' | ')}`);
  if (failures.length) throw new Error(`A1 terminal-joint acceptance failed: ${failures.join(' | ')}`);
  console.log(`A1 TERMINAL JOINT EVIDENCE READY: ${JSON.stringify({ vestibule, bogieClearanceMeters: data.terminal4UploadedJetwayBogieGroundClearanceMeters })}`);
})().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
