const { chromium } = require('@playwright/test');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDirectory = process.env.EVIDENCE_DIR || 'jetway-visual-evidence';
const reportPath = `${evidenceDirectory}/source-kphx-jetway-report.json`;
const EXPECTED_AIRPORT_WED_FACADES = 108;
const EXPECTED_TERMINAL4_JETWAYS = 76;
const EXPECTED_GLB_GEOMETRY = 'exact-uploaded-airport-jetway-glb-562e3144-wed-placement-v1';
const EXPECTED_SCALE_AUTHORITY = 'exact-supplied-glb-unit-scale-no-outward-stretch';
const EXPECTED_GROUND = 'exact-kphx-1.75.1-wed-a1-apron-collision-authority';
const EXPECTED_PHOTO = 'inactive-obsolete-bgl-aerial-exact-kphx-source-active';
const EXPECTED_READY = 'exact-kphx-1.75.1-wed-terminal4-jetways-plus-supplied-glb-v1';

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

    await page.waitForFunction(({ t4Count, airportCount, geometry, scale, ground, photo, ready }) => {
      const data = document.querySelector('canvas.trainerCanvas')?.dataset;
      return data?.inspectionMode === 'active'
        && data?.terminal4UploadedJetwayLoadState === 'ready'
        && Number(data?.terminal4UploadedJetwayCount) === t4Count
        && Number(data?.terminal4UploadedJetwayVerifiedModelCount) === t4Count
        && Number(data?.sourceJetwayCount) === airportCount
        && data?.terminal4UploadedJetwayReadyAuthority === ready
        && data?.terminal4JetwaySourceGeometryMode === geometry
        && data?.terminal4JetwaySourceScaleAuthority === scale
        && data?.groundSource === ground
        && data?.photoGroundSource === photo;
    }, {
      t4Count: EXPECTED_TERMINAL4_JETWAYS,
      airportCount: EXPECTED_AIRPORT_WED_FACADES,
      geometry: EXPECTED_GLB_GEOMETRY,
      scale: EXPECTED_SCALE_AUTHORITY,
      ground: EXPECTED_GROUND,
      photo: EXPECTED_PHOTO,
      ready: EXPECTED_READY,
    }, { timeout: 180000, polling: 100 });

    await page.waitForTimeout(1000);
    const canvas = page.locator('canvas.trainerCanvas');
    const data = await canvas.evaluate((element) => ({ ...element.dataset }));
    const failures = [];
    if (!String(data.environmentSource || '').includes('exact-user-drive-kphx-1.75.1')) failures.push(`environment authority=${data.environmentSource}`);
    if (!String(data.environmentSource || '').includes('WED-terminal4-jetways')) failures.push(`Terminal 4 WED authority missing from environment=${data.environmentSource}`);
    if (data.terminal4UploadedJetwayLoadState !== 'ready') failures.push(`jetway load=${data.terminal4UploadedJetwayLoadState}`);
    if (Number(data.terminal4UploadedJetwayCount) !== EXPECTED_TERMINAL4_JETWAYS) failures.push(`T4 jetway count=${data.terminal4UploadedJetwayCount}`);
    if (Number(data.terminal4UploadedJetwayVerifiedModelCount) !== EXPECTED_TERMINAL4_JETWAYS) failures.push(`T4 verified count=${data.terminal4UploadedJetwayVerifiedModelCount}`);
    if (Number(data.sourceJetwayCount) !== EXPECTED_AIRPORT_WED_FACADES) failures.push(`airport WED facade count=${data.sourceJetwayCount}`);
    if (Number(data.terminal4UploadedJetwayConnectorCount) !== 0) failures.push(`fixed-corridor connector count must remain fail-closed until source facade ingest: ${data.terminal4UploadedJetwayConnectorCount}`);
    if (data.terminal4UploadedJetwayReadyAuthority !== EXPECTED_READY) failures.push(`ready authority=${data.terminal4UploadedJetwayReadyAuthority}`);
    if (data.terminal4JetwaySourceGeometryMode !== EXPECTED_GLB_GEOMETRY) failures.push(`geometry=${data.terminal4JetwaySourceGeometryMode}`);
    if (data.terminal4JetwaySourceScaleAuthority !== EXPECTED_SCALE_AUTHORITY) failures.push(`scale=${data.terminal4JetwaySourceScaleAuthority}`);
    if (data.groundSource !== EXPECTED_GROUND) failures.push(`ground=${data.groundSource}`);
    if (data.photoGroundSource !== EXPECTED_PHOTO) failures.push(`photo=${data.photoGroundSource}`);
    if (!['parked-clear-of-aircraft', 'uploaded-model-ready', 'attached-to-aircraft-door'].includes(data.a1JetwayState)) failures.push(`A1 controller state=${data.a1JetwayState}`);
    if (!Number.isFinite(Number(data.a1JetwayDeployment))) failures.push(`A1 deployment=${data.a1JetwayDeployment}`);
    if (pageErrors.length) failures.push(`page errors=${JSON.stringify(pageErrors)}`);
    if (failedRequests.length) failures.push(`failed requests=${JSON.stringify(failedRequests.slice(-10))}`);
    if (consoleErrors.some((entry) => /failed|error|404|load/i.test(entry))) failures.push(`console errors=${JSON.stringify(consoleErrors.slice(-10))}`);
    if (failures.length) throw new Error(`Exact KPHX Terminal 4 movable-jetway browser contract failed: ${failures.join('; ')}`);

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
      authority: 'exact-KPHX-1.75.1-Terminal4-WED-plus-exact-Airport_Jetway-GLB-browser-v2',
      airportWideWedFacadeCount: Number(data.sourceJetwayCount),
      terminal4AssociatedJetwayCount: Number(data.terminal4UploadedJetwayCount),
      verifiedModelCount: Number(data.terminal4UploadedJetwayVerifiedModelCount),
      connectorCount: Number(data.terminal4UploadedJetwayConnectorCount),
      groundSource: data.groundSource,
      environmentSource: data.environmentSource,
      geometryAuthority: data.terminal4JetwaySourceGeometryMode,
      scaleAuthority: data.terminal4JetwaySourceScaleAuthority,
      a1State: data.a1JetwayState,
      a1Deployment: data.a1JetwayDeployment,
      captures,
      fixedCorridorStatus: 'FAIL-CLOSED: native lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac fixed-corridor facade is not yet materialized; connector count intentionally remains zero.',
      terminal3JetwayStatus: 'SAM sam.xml owns F1-F12 separately; those 12 are not included in the 76 Terminal 4 supplied-GLB instances.',
      pageErrors,
      consoleErrors,
      failedRequests,
    }, null, 2)}\n`);
    console.log(`Verified exact KPHX Terminal 4 movable jetway layer in browser: ${EXPECTED_TERMINAL4_JETWAYS} exact WED associations from ${EXPECTED_AIRPORT_WED_FACADES} airport-wide facades using exact Airport_Jetway.glb with no outward stretch.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
