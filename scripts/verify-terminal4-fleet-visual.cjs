const { chromium } = require('@playwright/test');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDirectory = process.env.EVIDENCE_DIR || 'jetway-visual-evidence';
const reportPath = `${evidenceDirectory}/source-kphx-jetway-report.json`;
const EXPECTED_JETWAYS = 108;
const EXPECTED_GLB_GEOMETRY = 'exact-uploaded-Airport_Jetway.glb-seven-source-meshes';
const EXPECTED_SCALE_AUTHORITY = 'exact-GLB-no-scale-WED-path-telescope-only';
const EXPECTED_GROUND = 'exact-kphx-1.75.1-wed-a1-apron-collision-authority';
const EXPECTED_PHOTO = 'inactive-obsolete-bgl-aerial-exact-kphx-source-active';

fs.mkdirSync(evidenceDirectory, { recursive: true });

async function selectByValue(page, ariaLabel, value) {
  await page.evaluate(({ ariaLabel, value }) => {
    const select = document.querySelector(`select[aria-label="${ariaLabel}"]`);
    if (!(select instanceof HTMLSelectElement)) throw new Error(`${ariaLabel} control is missing`);
    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, { ariaLabel, value });
}

async function captureCanvas(page, filename) {
  const output = `${evidenceDirectory}/${filename}`;
  const canvas = page.locator('canvas.trainerCanvas');
  const box = await canvas.boundingBox();
  if (!box || box.width < 300 || box.height < 300) throw new Error(`${filename} has no visible trainer canvas`);
  await page.screenshot({ path: output, type: 'png', clip: box, timeout: 30000 });
  const bytes = fs.statSync(output).size;
  if (bytes < 50000) throw new Error(`${filename} is unexpectedly small: ${bytes}`);
  return bytes;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') consoleErrors.push(message.text()); });
  page.on('requestfailed', (request) => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`));

  try {
    const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    if (!response?.ok()) throw new Error(`KPHX visual navigation failed: ${response?.status() || 'no response'}`);
    const launch = page.getByRole('button', { name: 'Drive tug / inspect airport' });
    await launch.waitFor({ state: 'visible', timeout: 30000 });
    await launch.click();

    await page.waitForFunction(({ count, geometry, scale, ground, photo }) => {
      const data = document.querySelector('canvas.trainerCanvas')?.dataset;
      return data?.inspectionMode === 'active'
        && data?.terminal4UploadedJetwayLoadState === 'ready'
        && Number(data?.terminal4UploadedJetwayCount) === count
        && Number(data?.terminal4UploadedJetwayVerifiedModelCount) === count
        && Number(data?.sourceJetwayCount) === count
        && Number(data?.terminal4JetwayCount) === count
        && data?.terminal4JetwaySourceGeometryMode === geometry
        && data?.terminal4JetwaySourceScaleAuthority === scale
        && data?.groundSource === ground
        && data?.photoGroundSource === photo;
    }, {
      count: EXPECTED_JETWAYS,
      geometry: EXPECTED_GLB_GEOMETRY,
      scale: EXPECTED_SCALE_AUTHORITY,
      ground: EXPECTED_GROUND,
      photo: EXPECTED_PHOTO,
    }, { timeout: 180000, polling: 100 });

    await page.waitForTimeout(1000);
    const canvas = page.locator('canvas.trainerCanvas');
    const data = await canvas.evaluate((element) => ({ ...element.dataset }));
    const failures = [];
    if (!String(data.environmentSource || '').includes('exact-user-drive-kphx-1.75.1')) failures.push(`environment authority=${data.environmentSource}`);
    if (!String(data.environmentSource || '').includes('WED-jetways')) failures.push(`WED jetway authority missing from environment=${data.environmentSource}`);
    if (data.terminal4UploadedJetwayLoadState !== 'ready') failures.push(`jetway load=${data.terminal4UploadedJetwayLoadState}`);
    if (Number(data.terminal4UploadedJetwayCount) !== EXPECTED_JETWAYS) failures.push(`jetway count=${data.terminal4UploadedJetwayCount}`);
    if (Number(data.terminal4UploadedJetwayVerifiedModelCount) !== EXPECTED_JETWAYS) failures.push(`verified count=${data.terminal4UploadedJetwayVerifiedModelCount}`);
    if (data.terminal4JetwaySourceGeometryMode !== EXPECTED_GLB_GEOMETRY) failures.push(`geometry=${data.terminal4JetwaySourceGeometryMode}`);
    if (data.terminal4JetwaySourceScaleAuthority !== EXPECTED_SCALE_AUTHORITY) failures.push(`scale=${data.terminal4JetwaySourceScaleAuthority}`);
    if (data.groundSource !== EXPECTED_GROUND) failures.push(`ground=${data.groundSource}`);
    if (data.photoGroundSource !== EXPECTED_PHOTO) failures.push(`photo=${data.photoGroundSource}`);
    if (!['parked-clear-of-aircraft', 'uploaded-model-ready', 'attached-to-aircraft-door'].includes(data.a1JetwayState)) failures.push(`A1 controller state=${data.a1JetwayState}`);
    if (!Number.isFinite(Number(data.a1JetwayDeployment))) failures.push(`A1 deployment=${data.a1JetwayDeployment}`);
    if (pageErrors.length) failures.push(`page errors=${JSON.stringify(pageErrors)}`);
    if (failedRequests.length) failures.push(`failed requests=${JSON.stringify(failedRequests.slice(-10))}`);
    if (consoleErrors.some((entry) => /failed|error|404|load/i.test(entry))) failures.push(`console errors=${JSON.stringify(consoleErrors.slice(-10))}`);
    if (failures.length) throw new Error(`Exact KPHX jetway browser contract failed: ${failures.join('; ')}`);

    const captures = {};
    await selectByValue(page, 'Camera view', 'chase');
    await page.waitForTimeout(1000);
    captures['a1-source-jetway-chase.png'] = await captureCanvas(page, 'a1-source-jetway-chase.png');
    await selectByValue(page, 'Camera view', 'overhead');
    await page.waitForTimeout(1000);
    captures['a1-source-jetway-overhead.png'] = await captureCanvas(page, 'a1-source-jetway-overhead.png');
    await selectByValue(page, 'Camera view', 'driver');
    await page.waitForTimeout(1000);
    captures['a1-source-jetway-driver.png'] = await captureCanvas(page, 'a1-source-jetway-driver.png');

    fs.writeFileSync(reportPath, `${JSON.stringify({
      capturedAtUtc: new Date().toISOString(),
      authority: 'exact-KPHX-1.75.1-WED-plus-exact-Airport_Jetway-GLB-browser-v1',
      jetwayCount: Number(data.terminal4UploadedJetwayCount),
      verifiedModelCount: Number(data.terminal4UploadedJetwayVerifiedModelCount),
      groundSource: data.groundSource,
      environmentSource: data.environmentSource,
      geometryAuthority: data.terminal4JetwaySourceGeometryMode,
      scaleAuthority: data.terminal4JetwaySourceScaleAuthority,
      a1State: data.a1JetwayState,
      a1Deployment: data.a1JetwayDeployment,
      captures,
      knownUnmaterializedExactDependency: 'lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac fixed-corridor facade is not bundled in the connected KPHX dependency set; this visual pass verifies the exact movable Airport_Jetway.glb layer only.',
      pageErrors,
      consoleErrors,
      failedRequests,
    }, null, 2)}\n`);
    console.log(`Verified exact KPHX movable jetway layer in browser: ${EXPECTED_JETWAYS} WED placements using exact Airport_Jetway.glb with no scaling; captures=${JSON.stringify(captures)}.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
