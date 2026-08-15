const { chromium } = require('@playwright/test');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDirectory = process.env.EVIDENCE_DIR || 'a14-corner-evidence';
const outputPath = `${evidenceDirectory}/a14-corner-overhead.png`;
const reportPath = `${evidenceDirectory}/report.json`;
const cameraAuthority = 'a12-a14-rotunda-corner-fixed-overhead-evidence-v1';
const cornerRegistrationPrefix = '[RampReady] Static A12/A14 final registration ';

fs.mkdirSync(evidenceDirectory, { recursive: true });

async function selectByLabel(page, ariaLabel, optionLabel) {
  await page.evaluate(({ ariaLabel, optionLabel }) => {
    const select = document.querySelector(`select[aria-label="${ariaLabel}"]`);
    if (!(select instanceof HTMLSelectElement)) throw new Error(`${ariaLabel} control is missing`);
    const option = [...select.options].find((entry) => entry.textContent?.trim() === optionLabel);
    if (!option) throw new Error(`${ariaLabel} option is missing: ${optionLabel}`);
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, { ariaLabel, optionLabel });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const cornerRegistrationMessages = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') consoleErrors.push(text);
    if (text.startsWith(cornerRegistrationPrefix)) {
      cornerRegistrationMessages.push(text);
      console.log(text);
    }
  });

  try {
    const response = await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 90000 });
    if (!response?.ok()) throw new Error(`A14 overhead navigation failed: ${response?.status() || 'no response'}`);

    const launch = page.getByRole('button', { name: 'Drive tug / inspect airport' });
    await launch.waitFor({ state: 'visible', timeout: 30000 });
    await launch.click();

    const deadline = Date.now() + 180000;
    let ready = null;
    while (Date.now() < deadline) {
      const canvas = page.locator('canvas.trainerCanvas');
      if (await canvas.count()) {
        const data = await canvas.evaluate((element) => ({ ...element.dataset }));
        const state = String(data.terminal4UploadedJetwayLoadState || '');
        if (data.inspectionMode === 'active'
          && state === 'ready'
          && data.terminal4UploadedJetwayCount === '58'
          && data.terminal4UploadedJetwayConnectorCount === '58') {
          ready = data;
          break;
        }
        if (/error|failed|failure/i.test(state) || pageErrors.length) {
          throw new Error(`A14 overhead fleet load failed: state=${state}; pageErrors=${JSON.stringify(pageErrors)}; consoleErrors=${JSON.stringify(consoleErrors.slice(-10))}`);
        }
      }
      await page.waitForTimeout(250);
    }
    if (!ready) throw new Error('A14 overhead fleet did not become ready in 180000 ms');
    if (!cornerRegistrationMessages.length) {
      throw new Error('A14 overhead fleet became ready without publishing final A12/A14 registration diagnostics');
    }

    await selectByLabel(page, 'Inspection location', 'A14 corner overhead');
    await page.waitForFunction((authority) => {
      const data = document.querySelector('canvas.trainerCanvas')?.dataset;
      return data?.inspectionPreset === 'a14CornerOverhead'
        && data?.inspectionCameraAuthority === authority;
    }, cameraAuthority, { timeout: 30000, polling: 100 });
    // Do NOT switch to the generic "overhead" camera mode here. That mode is
    // tug-follow and re-centers on the A14 stand. The dedicated preset's fixed
    // cameraPosition/cameraTarget is the actual corner-overhead evidence frame.
    await page.waitForTimeout(1500);

    const canvas = page.locator('canvas.trainerCanvas');
    const box = await canvas.boundingBox();
    if (!box || box.width <= 100 || box.height <= 100) throw new Error('A14 overhead canvas is not visibly rendered');
    // A WebGL canvas is continuously repainting, so locator.screenshot() waits
    // forever for element stability. Capture the same canvas rectangle from the
    // page viewport instead; this samples the live rendered frame immediately.
    const viewport = page.viewportSize();
    const clip = {
      x: Math.max(0, box.x),
      y: Math.max(0, box.y),
      width: Math.min(box.width, viewport.width - Math.max(0, box.x)),
      height: Math.min(box.height, viewport.height - Math.max(0, box.y)),
    };
    if (!(clip.width > 100 && clip.height > 100)) throw new Error(`A14 overhead clip is invalid: ${JSON.stringify(clip)}`);
    await page.screenshot({ path: outputPath, type: 'png', clip, timeout: 30000 });
    const bytes = fs.statSync(outputPath).size;
    if (bytes < 100000) throw new Error(`A14 overhead screenshot is unexpectedly small: ${bytes}`);

    const dataset = await canvas.evaluate((element) => ({ ...element.dataset }));
    const cornerRegistration = JSON.parse(cornerRegistrationMessages.at(-1).slice(cornerRegistrationPrefix.length));
    fs.writeFileSync(reportPath, `${JSON.stringify({
      capturedAtUtc: new Date().toISOString(),
      bytes,
      loadState: dataset.terminal4UploadedJetwayLoadState,
      jetwayCount: dataset.terminal4UploadedJetwayCount,
      connectorCount: dataset.terminal4UploadedJetwayConnectorCount,
      terminalConnectedCount: dataset.terminal4TerminalConnectedJetwayCount,
      staticGateCount: dataset.terminal4UploadedJetwayStaticArticulatedGateCount,
      staticAuthority: dataset.terminal4UploadedJetwayStaticOwnGateTargetAuthority,
      a14CornerAuthority: dataset.terminal4UploadedJetwayStaticA14CornerArmAuthority,
      a14CornerDegrees: dataset.terminal4UploadedJetwayStaticA14CornerArmArticulationDegrees,
      inspectionPreset: dataset.inspectionPreset,
      inspectionCameraAuthority: dataset.inspectionCameraAuthority,
      cornerRegistration,
      pageErrors,
      consoleErrors,
    }, null, 2)}\n`);
    console.log(`Captured fixed A12/A14 Rotunda-corner overhead: ${bytes} bytes; 58 exact jetways ready; articulation=${dataset.terminal4UploadedJetwayStaticA14CornerArmArticulationDegrees} degrees; camera=${dataset.inspectionCameraAuthority}.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
