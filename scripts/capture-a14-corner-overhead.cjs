const { chromium } = require('@playwright/test');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL || 'http://127.0.0.1:4173/RampReady/';
const evidenceDirectory = process.env.EVIDENCE_DIR || 'a14-corner-evidence';
const reportPath = `${evidenceDirectory}/report.json`;
const cornerRegistrationPrefix = '[RampReady] Static A12/A14 final registration ';
const cornerViews = Object.freeze([
  {
    label: 'A14 corner overhead',
    preset: 'a14CornerOverhead',
    authority: 'a12-a14-rotunda-corner-fixed-overhead-evidence-v1',
    filename: 'a14-corner-overhead.png',
  },
  {
    label: 'A27/A29 corner overhead',
    preset: 'a27CornerOverhead',
    authority: 'a27-a29-rotunda-corner-fixed-overhead-evidence-v1',
    filename: 'a27-a29-corner-overhead.png',
  },
]);

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

async function captureLiveCanvas(page, canvas, outputPath) {
  const box = await canvas.boundingBox();
  if (!box || box.width <= 100 || box.height <= 100) throw new Error(`${outputPath} canvas is not visibly rendered`);
  const viewport = page.viewportSize();
  const clip = {
    x: Math.max(0, box.x),
    y: Math.max(0, box.y),
    width: Math.min(box.width, viewport.width - Math.max(0, box.x)),
    height: Math.min(box.height, viewport.height - Math.max(0, box.y)),
  };
  if (!(clip.width > 100 && clip.height > 100)) throw new Error(`${outputPath} clip is invalid: ${JSON.stringify(clip)}`);
  await page.screenshot({ path: outputPath, type: 'png', clip, timeout: 30000 });
  const bytes = fs.statSync(outputPath).size;
  if (bytes < 100000) throw new Error(`${outputPath} screenshot is unexpectedly small: ${bytes}`);
  return bytes;
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
    if (!response?.ok()) throw new Error(`Static corner overhead navigation failed: ${response?.status() || 'no response'}`);

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
          throw new Error(`Static corner fleet load failed: state=${state}; pageErrors=${JSON.stringify(pageErrors)}; consoleErrors=${JSON.stringify(consoleErrors.slice(-10))}`);
        }
      }
      await page.waitForTimeout(250);
    }
    if (!ready) throw new Error('Static corner fleet did not become ready in 180000 ms');
    if (!cornerRegistrationMessages.length) {
      throw new Error('Static corner fleet became ready without publishing final corner registration diagnostics');
    }

    const canvas = page.locator('canvas.trainerCanvas');
    const captures = {};
    const cameraEvidence = {};
    for (const view of cornerViews) {
      await selectByLabel(page, 'Inspection location', view.label);
      await page.waitForFunction(({ preset, authority }) => {
        const data = document.querySelector('canvas.trainerCanvas')?.dataset;
        return data?.inspectionPreset === preset
          && data?.inspectionCameraAuthority === authority;
      }, { preset: view.preset, authority: view.authority }, { timeout: 30000, polling: 100 });
      // Never switch to the generic tug-follow Overhead view here. Each corner
      // preset owns an exact fixed cameraPosition/cameraTarget.
      await page.waitForTimeout(1500);
      const outputPath = `${evidenceDirectory}/${view.filename}`;
      captures[view.filename] = await captureLiveCanvas(page, canvas, outputPath);
      const data = await canvas.evaluate((element) => ({ ...element.dataset }));
      cameraEvidence[view.preset] = {
        label: view.label,
        authority: data.inspectionCameraAuthority,
        bytes: captures[view.filename],
      };
    }

    const dataset = await canvas.evaluate((element) => ({ ...element.dataset }));
    const cornerRegistration = JSON.parse(cornerRegistrationMessages.at(-1).slice(cornerRegistrationPrefix.length));
    fs.writeFileSync(reportPath, `${JSON.stringify({
      capturedAtUtc: new Date().toISOString(),
      captures,
      loadState: dataset.terminal4UploadedJetwayLoadState,
      jetwayCount: dataset.terminal4UploadedJetwayCount,
      connectorCount: dataset.terminal4UploadedJetwayConnectorCount,
      terminalConnectedCount: dataset.terminal4TerminalConnectedJetwayCount,
      staticGateCount: dataset.terminal4UploadedJetwayStaticArticulatedGateCount,
      staticAuthority: dataset.terminal4UploadedJetwayStaticOwnGateTargetAuthority,
      a14CornerAuthority: dataset.terminal4UploadedJetwayStaticA14CornerArmAuthority,
      a14CornerDegrees: dataset.terminal4UploadedJetwayStaticA14CornerArmArticulationDegrees,
      cameraEvidence,
      cornerRegistration,
      pageErrors,
      consoleErrors,
    }, null, 2)}\n`);
    console.log(`Captured both fixed static-corner overheads: A12/A14=${captures['a14-corner-overhead.png']} bytes, A27/A29=${captures['a27-a29-corner-overhead.png']} bytes; 58 exact jetways ready.`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});
