const { chromium } = require('playwright');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDir = process.env.EVIDENCE_DIR || 'a1-terminal-joint-evidence';
fs.mkdirSync(evidenceDir, { recursive: true });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.stack || error.message || String(error)));

  try {
    const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    if (!response?.ok()) throw new Error(`navigation failed: ${response?.status() || 'no response'}`);

    const launch = page.getByRole('button', { name: 'Drive tug / inspect airport' });
    await launch.waitFor({ state: 'visible', timeout: 30000 });
    await launch.click();

    const canvas = page.locator('canvas.trainerCanvas');
    await canvas.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(() => {
      const data = document.querySelector('canvas.trainerCanvas')?.dataset;
      return data?.inspectionMode === 'active'
        && data?.terminal4UploadedJetwayLoadState === 'ready'
        && data?.terminal4UploadedJetwayCount === '58';
    }, null, { timeout: 120000, polling: 100 });

    const location = page.getByRole('combobox', { name: 'Inspection location' });
    await location.waitFor({ state: 'visible', timeout: 30000 });
    await location.selectOption({ label: 'A1 terminal connection' });
    await page.waitForFunction(() => {
      const data = document.querySelector('canvas.trainerCanvas')?.dataset;
      return data?.inspectionPreset === 'a1Connection'
        && data?.a1JetwayDeployment === '1.000'
        && data?.a1JetwayState === 'attached-to-aircraft-door';
    }, null, { timeout: 30000, polling: 100 });

    await page.addStyleTag({ content: '.rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}' });
    const before = await canvas.evaluate(element => ({ ...element.dataset }));

    await page.evaluate(() => {
      const target = document.querySelector('canvas.trainerCanvas');
      if (!(target instanceof HTMLCanvasElement)) throw new Error('A1 evidence canvas is missing');
      target.dataset.a1EvidenceSubview = 'terminal-joint';
    });

    await sleep(2500);
    const after = await canvas.evaluate(element => ({ ...element.dataset })).catch(() => ({}));
    await page.screenshot({ path: `${evidenceDir}/a1-terminal-joint-subview-diagnostic.png`, fullPage: false });

    const diagnostic = {
      capturedAtUtc: new Date().toISOString(),
      requestedSubview: 'terminal-joint',
      before,
      after,
      consoleErrors,
      pageErrors,
      acknowledgement: {
        subview: after.inspectionCameraEndpointSubview || null,
        subviewAuthority: after.inspectionCameraEndpointSubviewAuthority || null,
        cameraAuthority: after.inspectionCameraEndpointAuthority || null,
        lockAuthority: after.inspectionCameraEndpointLockAuthority || null,
        convergenceErrorMeters: after.inspectionCameraEndpointConvergenceErrorMeters || null,
      },
    };
    fs.writeFileSync(`${evidenceDir}/a1-terminal-joint-subview-diagnostic.json`, JSON.stringify(diagnostic, null, 2));
    console.log(`A1 SUBVIEW DIAGNOSTIC: ${JSON.stringify({ acknowledgement: diagnostic.acknowledgement, consoleErrors, pageErrors })}`);
  } catch (error) {
    await page.screenshot({ path: `${evidenceDir}/a1-terminal-joint-subview-diagnostic-fatal.png`, fullPage: false }).catch(() => {});
    fs.writeFileSync(`${evidenceDir}/a1-terminal-joint-subview-diagnostic-fatal.json`, JSON.stringify({
      capturedAtUtc: new Date().toISOString(),
      error: error?.stack || error?.message || String(error),
      consoleErrors,
      pageErrors,
    }, null, 2));
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
