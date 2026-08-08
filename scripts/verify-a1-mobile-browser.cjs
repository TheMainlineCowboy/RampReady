const { chromium } = require('playwright');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDir = process.env.EVIDENCE_DIR || 'a1-terminal-joint-evidence';
const MOBILE_VIEWPORT = Object.freeze({ width: 448, height: 998 });

fs.mkdirSync(evidenceDir, { recursive: true });

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

  const inspectionLocation = page.getByRole('combobox', { name: 'Inspection location' });
  await inspectionLocation.waitFor({ state: 'visible', timeout: 30000 });
  await inspectionLocation.selectOption({ label: 'A1 terminal connection' });

  const cameraView = page.getByRole('combobox', { name: 'Camera view' });
  await cameraView.waitFor({ state: 'visible', timeout: 30000 });
  await cameraView.selectOption('chase');

  await page.waitForFunction(() => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    return data?.inspectionPreset === 'a1Connection'
      && data?.a1JetwayDeployment === '1.000'
      && data?.a1JetwayState === 'attached-to-aircraft-door';
  }, null, { timeout: 30000, polling: 100 });

  await page.waitForTimeout(1500);
  const telemetry = await canvas.evaluate(element => ({ ...element.dataset }));
  const box = await canvas.boundingBox();
  if (!box || box.width < 400 || box.height < 850) {
    throw new Error(`A1 mobile canvas is not filling the Pixel-class viewport: ${JSON.stringify(box)}`);
  }

  await page.screenshot({
    path: `${evidenceDir}/a1-mobile-pixel8pro-chase.png`,
    fullPage: false,
  });
  await canvas.screenshot({ path: `${evidenceDir}/a1-mobile-pixel8pro-canvas.png` });

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
  console.log(`A1 MOBILE PIXEL EVIDENCE READY: ${MOBILE_VIEWPORT.width}x${MOBILE_VIEWPORT.height}`);
})().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
