const { chromium } = require('@playwright/test');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDirectory = process.env.EVIDENCE_DIR || 'a14-corner-evidence';
const reportPath = `${evidenceDirectory}/report.json`;
const EXPECTED_JETWAYS = 108;

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

    await page.waitForFunction((count) => {
      const data = document.querySelector('canvas.trainerCanvas')?.dataset;
      return data?.inspectionMode === 'active'
        && data?.terminal4UploadedJetwayLoadState === 'ready'
        && Number(data?.terminal4UploadedJetwayCount) === count
        && Number(data?.sourceJetwayCount) === count
        && data?.terminal4JetwaySourceGeometryMode === 'exact-uploaded-Airport_Jetway.glb-seven-source-meshes'
        && data?.groundSource === 'exact-kphx-1.75.1-wed-a1-apron-collision-authority';
    }, EXPECTED_JETWAYS, { timeout: 180000, polling: 100 });

    const canvas = page.locator('canvas.trainerCanvas');
    await selectCamera(page, 'overhead');
    await page.waitForTimeout(1200);
    const overheadBytes = await capture(page, 'source-kphx-a1-overhead.png');
    await selectCamera(page, 'chase');
    await page.waitForTimeout(1200);
    const chaseBytes = await capture(page, 'source-kphx-a1-diagonal.png');
    const dataset = await canvas.evaluate((element) => ({ ...element.dataset }));

    const failures = [];
    if (!String(dataset.environmentSource || '').includes('WED-jetways')) failures.push(`environment=${dataset.environmentSource}`);
    if (dataset.terminal4JetwaySourceScaleAuthority !== 'exact-GLB-no-scale-WED-path-telescope-only') failures.push(`scale=${dataset.terminal4JetwaySourceScaleAuthority}`);
    if (Number(dataset.terminal4UploadedJetwayVerifiedModelCount) !== EXPECTED_JETWAYS) failures.push(`verified=${dataset.terminal4UploadedJetwayVerifiedModelCount}`);
    if (pageErrors.length) failures.push(`pageErrors=${JSON.stringify(pageErrors)}`);
    if (failedRequests.length) failures.push(`failedRequests=${JSON.stringify(failedRequests.slice(-10))}`);
    if (consoleErrors.some((entry) => /failed|error|404|load/i.test(entry))) failures.push(`consoleErrors=${JSON.stringify(consoleErrors.slice(-10))}`);
    if (failures.length) throw new Error(`KPHX source-overhead evidence failed: ${failures.join('; ')}`);

    fs.writeFileSync(reportPath, `${JSON.stringify({
      capturedAtUtc: new Date().toISOString(),
      authority: 'exact-KPHX-WED-A1-source-overhead-v1',
      jetwayCount: Number(dataset.terminal4UploadedJetwayCount),
      geometryAuthority: dataset.terminal4JetwaySourceGeometryMode,
      scaleAuthority: dataset.terminal4JetwaySourceScaleAuthority,
      overheadBytes,
      chaseBytes,
      note: 'This replaces the retired ADEX A14/A27 corner camera contract. Source-derived remote gate cameras will be added from WED ramp coordinates rather than carrying old hand-positioned camera presets forward.',
      pageErrors,
      consoleErrors,
      failedRequests,
    }, null, 2)}\n`);
    console.log(`Captured exact KPHX source-airport A1 overhead/diagonal evidence with ${EXPECTED_JETWAYS} WED-driven exact jetways.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
