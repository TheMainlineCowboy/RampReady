const { chromium } = require('playwright');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDir = process.env.EVIDENCE_DIR || 'a1-terminal-joint-evidence';
fs.mkdirSync(evidenceDir, { recursive: true });

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function requestSubview(page, canvas, subview) {
  await page.evaluate(nextSubview => {
    const target = document.querySelector('canvas.trainerCanvas');
    if (!(target instanceof HTMLCanvasElement)) throw new Error('A1 evidence canvas is missing');
    target.dataset.a1EvidenceSubview = nextSubview;
  }, subview);
  await sleep(2500);
  const dataset = await canvas.evaluate(element => ({ ...element.dataset })).catch(() => ({}));
  await page.screenshot({ path: `${evidenceDir}/a1-${subview}-subview-diagnostic.png`, fullPage: false });
  return {
    requestedSubview: subview,
    dataset,
    acknowledgement: {
      subview: dataset.inspectionCameraEndpointSubview || null,
      subviewAuthority: dataset.inspectionCameraEndpointSubviewAuthority || null,
      cameraAuthority: dataset.inspectionCameraEndpointAuthority || null,
      lockAuthority: dataset.inspectionCameraEndpointLockAuthority || null,
      convergenceErrorMeters: dataset.inspectionCameraEndpointConvergenceErrorMeters || null,
      terminalProfileAuthority: dataset.inspectionCameraEndpointJointProfileAuthority || null,
      terminalClearSideAuthority: dataset.inspectionCameraEndpointJointClearSideAuthority || null,
      terminalT4WalkOccluded: dataset.inspectionCameraEndpointJointT4WalkOccluded || null,
      terminalApronOffsetMeters: dataset.inspectionCameraEndpointJointRenderedApronHalfPlaneOffsetMeters || null,
      terminalBranchImbalance: dataset.inspectionCameraEndpointJointBranchViewImbalance || null,
      bogieProfileAuthority: dataset.inspectionCameraEndpointBogieProfileAuthority || null,
      bogieApronOffsetMeters: dataset.inspectionCameraEndpointBogieApronHalfPlaneOffsetMeters || null,
      bogieGroundAuthority: dataset.terminal4UploadedJetwayBogieGroundContactAuthority || null,
      bogieGroundClearanceMeters: dataset.terminal4UploadedJetwayBogieGroundClearanceMeters || null,
    },
  };
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
    const subviews = [];
    for (const subview of ['terminal-joint', 'bogie-contact', 'full-assembly']) {
      subviews.push(await requestSubview(page, canvas, subview));
    }

    const diagnostic = {
      capturedAtUtc: new Date().toISOString(),
      before,
      subviews,
      consoleErrors,
      pageErrors,
    };
    fs.writeFileSync(`${evidenceDir}/a1-all-subviews-diagnostic.json`, JSON.stringify(diagnostic, null, 2));
    // Preserve the historical filename for workflow artifact consumers while making
    // the payload explicit that all three exact evidence subviews were inspected.
    fs.writeFileSync(`${evidenceDir}/a1-terminal-joint-subview-diagnostic.json`, JSON.stringify(diagnostic, null, 2));
    console.log(`A1 ALL-SUBVIEW DIAGNOSTIC: ${JSON.stringify({ acknowledgements: subviews.map(entry => entry.acknowledgement), consoleErrors, pageErrors })}`);
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
