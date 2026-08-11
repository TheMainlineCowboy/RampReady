const { chromium } = require('playwright');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDir = process.env.EVIDENCE_DIR || 'a1-terminal-joint-evidence';
const MOBILE_VIEWPORT = Object.freeze({ width: 448, height: 998 });
const CURRENT_SUBVIEW_AUTHORITY = 'source-measured-a1-terminal-joint-camera-v3';
const LEGACY_SUBVIEW_AUTHORITY = 'exact-a1-terminal-joint-and-bogie-contact-subviews-v2';
const CAMERA_AUTHORITY = 'exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2';
const LOCK_AUTHORITY = 'exact-a1-evidence-camera-direct-lock-v1';
const PROFILE_AUTHORITY = 'rotunda-terminal-and-tunnel-a-elbow-revealing-bisector-profile-v5-midheight';
const MAX_BRANCH_VIEW_COSINE = 0.88;
const MAX_BRANCH_VIEW_IMBALANCE = 0.20;

fs.mkdirSync(evidenceDir, { recursive: true });

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

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: MOBILE_VIEWPORT,
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 1,
  });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('pageerror', error => pageErrors.push(error.message));

  const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (!response?.ok()) throw new Error(`A1 mobile evidence navigation failed: ${response?.status() || 'no response'}`);

  const inspectionLaunch = page.getByRole('button', { name: 'Drive tug / inspect airport' });
  await inspectionLaunch.waitFor({ state: 'visible', timeout: 30000 });
  await inspectionLaunch.click();

  const canvas = page.locator('canvas.trainerCanvas');
  await canvas.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    return data?.inspectionMode === 'active'
      && data?.environmentSource === 'authored-phx-terminal4-textured-source-jetways'
      && data?.terminal4UploadedJetwayLoadState === 'ready'
      && data?.terminal4UploadedJetwayCount === '58'
      && Number.isFinite(Number(data?.terminal4A1JetwayWallDistance))
      && Number.isFinite(Number(data?.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters));
  }, null, { timeout: 120000, polling: 100 });

  await selectByLabel(page, 'Inspection location', 'A1 terminal connection');
  await selectByValue(page, 'Camera view', 'chase');

  await page.waitForFunction(() => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    return data?.inspectionPreset === 'a1Connection'
      && data?.a1JetwayDeployment === '1.000'
      && data?.a1JetwayState === 'attached-to-aircraft-door';
  }, null, { timeout: 30000, polling: 100 });

  // Force the final production passenger-elbow camera while retaining the real
  // portrait HUD. The accepted camera must expose the terminal-side leg and
  // supplied Tunnel A on opposite sides of the Rotunda; a projection that stacks
  // both branches in the same screen direction is not valid visual evidence.
  await page.evaluate(() => {
    const element = document.querySelector('canvas.trainerCanvas');
    if (!(element instanceof HTMLCanvasElement)) throw new Error('A1 mobile evidence canvas is missing');
    element.dataset.a1EvidenceSubview = 'terminal-joint';
  });
  await page.waitForFunction(({ currentAuthority, legacyAuthority, cameraAuthority, lockAuthority, profileAuthority, maxBranchViewCosine, maxBranchViewImbalance }) => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    const wallView = Number(data?.inspectionCameraEndpointJointWallViewCosine);
    const tunnelView = Number(data?.inspectionCameraEndpointJointTunnelAViewCosine);
    const imbalance = Number(data?.inspectionCameraEndpointJointBranchViewImbalance);
    return data?.inspectionCameraEndpointSubview === 'terminal-joint'
      && [currentAuthority, legacyAuthority].includes(data?.inspectionCameraEndpointSubviewAuthority)
      && data?.inspectionCameraEndpointAuthority === cameraAuthority
      && data?.inspectionCameraEndpointLockAuthority === lockAuthority
      && data?.inspectionCameraEndpointJointProfileAuthority === profileAuthority
      && Number.isFinite(wallView) && wallView < maxBranchViewCosine
      && Number.isFinite(tunnelView) && tunnelView < maxBranchViewCosine
      && Number.isFinite(imbalance) && imbalance < maxBranchViewImbalance
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;
  }, {
    currentAuthority: CURRENT_SUBVIEW_AUTHORITY,
    legacyAuthority: LEGACY_SUBVIEW_AUTHORITY,
    cameraAuthority: CAMERA_AUTHORITY,
    lockAuthority: LOCK_AUTHORITY,
    profileAuthority: PROFILE_AUTHORITY,
    maxBranchViewCosine: MAX_BRANCH_VIEW_COSINE,
    maxBranchViewImbalance: MAX_BRANCH_VIEW_IMBALANCE,
  }, { timeout: 30000, polling: 100 });

  await page.waitForTimeout(1200);
  const telemetry = await canvas.evaluate(element => ({ ...element.dataset }));
  const box = await canvas.boundingBox();
  if (!box || box.width < 400 || box.height < 850) {
    throw new Error(`A1 mobile canvas is not filling the Pixel-class viewport: ${JSON.stringify(box)}`);
  }
  if (telemetry.inspectionCameraEndpointSubview !== 'terminal-joint') {
    throw new Error(`Pixel evidence did not retain the terminal-joint camera: ${telemetry.inspectionCameraEndpointSubview}`);
  }
  if (telemetry.inspectionCameraEndpointJointProfileAuthority !== PROFILE_AUTHORITY) {
    throw new Error(`Pixel evidence did not retain the elbow-revealing branch profile: ${telemetry.inspectionCameraEndpointJointProfileAuthority}`);
  }

  await page.screenshot({
    path: `${evidenceDir}/a1-mobile-pixel8pro-terminal-joint.png`,
    fullPage: false,
  });

  // locator.screenshot waits for a WebGL canvas to become visually stable,
  // which a continuously rendered simulator never does. Capture the already
  // measured canvas rectangle directly from the page compositor instead.
  await page.screenshot({
    path: `${evidenceDir}/a1-mobile-pixel8pro-terminal-joint-canvas.png`,
    fullPage: false,
    clip: {
      x: Math.max(0, Math.floor(box.x)),
      y: Math.max(0, Math.floor(box.y)),
      width: Math.min(MOBILE_VIEWPORT.width, Math.floor(box.width)),
      height: Math.min(MOBILE_VIEWPORT.height, Math.floor(box.height)),
    },
  });

  fs.writeFileSync(`${evidenceDir}/mobile-report.json`, JSON.stringify({
    pageUrl,
    capturedAtUtc: new Date().toISOString(),
    viewport: MOBILE_VIEWPORT,
    consoleErrors,
    pageErrors,
    telemetry,
  }, null, 2));

  await browser.close();
  if (pageErrors.length) throw new Error(`A1 mobile evidence page errors: ${pageErrors.join(' | ')}`);
  if (consoleErrors.length) throw new Error(`A1 mobile evidence console errors: ${consoleErrors.join(' | ')}`);
  console.log(`A1 MOBILE PIXEL PASSENGER-ELBOW EVIDENCE READY: ${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`);
})().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
