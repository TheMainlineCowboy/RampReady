const { chromium } = require('@playwright/test');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDirectory = process.env.EVIDENCE_DIR || 'a14-corner-evidence';
const reportPath = `${evidenceDirectory}/report.json`;
const EXPECTED_TERMINAL4_JETWAYS = 76;
const EXPECTED_AIRPORT_WED_FACADES = 108;

fs.mkdirSync(evidenceDirectory, { recursive: true });

async function selectCamera(page, value) {
  await page.evaluate((next) => {
    const select = document.querySelector('select[aria-label="Camera view"]');
    if (!(select instanceof HTMLSelectElement)) throw new Error('Camera view control is missing');
    select.value = next;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}

async function capture(page, filename) {
  const output = `${evidenceDirectory}/${filename}`;
  const canvas = page.locator('canvas.trainerCanvas');
  const box = await canvas.boundingBox();
  if (!box || box.width < 300 || box.height < 300) throw new Error(`${filename} canvas is not visibly rendered`);
  await page.screenshot({ path: output, type: 'png', clip: box, timeout: 30000 });
  const bytes = fs.statSync(output).size;
  if (bytes < 50000) throw new Error(`${filename} screenshot is unexpectedly small: ${bytes}`);
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
    if (!response?.ok()) throw new Error(`KPHX source-overhead navigation failed: ${response?.status() || 'no response'}`);
    const launch = page.getByRole('button', { name: 'Drive tug / inspect airport' });
    await launch.waitFor({ state: 'visible', timeout: 30000 });
    await launch.click();

    await page.waitForFunction(({ t4Count, airportCount }) => {
      const data = document.querySelector('canvas.trainerCanvas')?.dataset;
      return data?.inspectionMode === 'active'
        && data?.terminal4UploadedJetwayLoadState === 'ready'
        && Number(data?.terminal4UploadedJetwayCount) === t4Count
        && Number(data?.sourceJetwayCount) === airportCount
        && data?.terminal4UploadedJetwayReadyAuthority === 'exact-kphx-1.75.1-wed-terminal4-jetways-plus-supplied-glb-v1'
        && data?.terminal4JetwaySourceGeometryMode === 'exact-uploaded-airport-jetway-glb-562e3144-wed-placement-v1'
        && data?.terminal4JetwaySourceScaleAuthority === 'exact-supplied-glb-unit-scale-no-outward-stretch'
        && data?.groundSource === 'exact-kphx-1.75.1-wed-a1-apron-collision-authority';
    }, { t4Count: EXPECTED_TERMINAL4_JETWAYS, airportCount: EXPECTED_AIRPORT_WED_FACADES }, { timeout: 180000, polling: 100 });

    const canvas = page.locator('canvas.trainerCanvas');
    await selectCamera(page, 'overhead');
    await page.waitForTimeout(1200);
    const overheadBytes = await capture(page, 'source-kphx-a1-overhead.png');
    await selectCamera(page, 'chase');
    await page.waitForTimeout(1200);
    const chaseBytes = await capture(page, 'source-kphx-a1-diagonal.png');
    const dataset = await canvas.evaluate((element) => ({ ...element.dataset }));

    const failures = [];
    if (!String(dataset.environmentSource || '').includes('WED-terminal4-jetways')) failures.push(`environment=${dataset.environmentSource}`);
    if (Number(dataset.terminal4UploadedJetwayVerifiedModelCount) !== EXPECTED_TERMINAL4_JETWAYS) failures.push(`verified=${dataset.terminal4UploadedJetwayVerifiedModelCount}`);
    if (Number(dataset.terminal4UploadedJetwayConnectorCount) !== 0) failures.push(`fixed-corridor connector count must be zero until native facade ingest: ${dataset.terminal4UploadedJetwayConnectorCount}`);
    if (pageErrors.length) failures.push(`pageErrors=${JSON.stringify(pageErrors)}`);
    if (failedRequests.length) failures.push(`failedRequests=${JSON.stringify(failedRequests.slice(-10))}`);
    if (consoleErrors.some((entry) => /failed|error|404|load/i.test(entry))) failures.push(`consoleErrors=${JSON.stringify(consoleErrors.slice(-10))}`);
    if (failures.length) throw new Error(`KPHX source-overhead evidence failed: ${failures.join('; ')}`);

    fs.writeFileSync(reportPath, `${JSON.stringify({
      capturedAtUtc: new Date().toISOString(),
      authority: 'exact-KPHX-WED-A1-source-overhead-v2',
      airportWideWedFacadeCount: Number(dataset.sourceJetwayCount),
      terminal4AssociatedJetwayCount: Number(dataset.terminal4UploadedJetwayCount),
      connectorCount: Number(dataset.terminal4UploadedJetwayConnectorCount),
      geometryAuthority: dataset.terminal4JetwaySourceGeometryMode,
      scaleAuthority: dataset.terminal4JetwaySourceScaleAuthority,
      overheadBytes,
      chaseBytes,
      note: 'This replaces the retired ADEX A14/A27 camera contract. Remote gate cameras will be derived from exact WED ramp positions. Native fixed-corridor facade remains fail-closed until its exact resource is materialized.',
      pageErrors,
      consoleErrors,
      failedRequests,
    }, null, 2)}\n`);
    console.log(`Captured exact KPHX source-airport A1 overhead/diagonal evidence with ${EXPECTED_TERMINAL4_JETWAYS} Terminal 4 WED-associated exact jetways from ${EXPECTED_AIRPORT_WED_FACADES} airport-wide facades.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
