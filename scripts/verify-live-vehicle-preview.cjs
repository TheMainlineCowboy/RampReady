const { chromium } = require('playwright');
const fs = require('node:fs');

const PAGE_URL = process.env.PAGE_URL || 'https://themainlinecowboy.github.io/RampReady/';
const EXPECTED_SHA = process.env.EXPECTED_SHA || '';
const OUT = 'vehicle-preview-evidence';
fs.mkdirSync(OUT, { recursive: true });

const VEHICLES = [
  { id: 'lektro-88', radio: /LEKTRO 88 sit-down pushback/i, source: 'Aircraft_Tug_REVISED_V3.obj+mtl', file: 'lektro-88-chase.png' },
  { id: 'standup-tug', radio: /Stand-up pushback/i, source: 'Aircraft_Standup_REVISED_V3.3mf', file: 'standup-tug-chase.png' },
  { id: 'manager-kubota', source: 'RTVManagersKubota.3mf', file: 'manager-kubota-chase.png', manager: true },
];

function diagnostics(page) {
  const d = { consoleErrors: [], pageErrors: [], failedRequests: [], modelResponses: [] };
  page.on('console', m => { if (m.type() === 'error') d.consoleErrors.push(m.text()); });
  page.on('pageerror', e => d.pageErrors.push(e.message));
  page.on('requestfailed', r => d.failedRequests.push(`${r.method()} ${r.url()} :: ${r.failure()?.errorText || 'unknown'}`));
  page.on('response', r => {
    const p = new URL(r.url()).pathname;
    if (/\/models\/(?:lektro-88|standup-tug|manager-kubota)\.glb$/.test(p)) d.modelResponses.push({ url: r.url(), status: r.status(), ok: r.ok() });
  });
  return d;
}

async function captureCanvas(page, canvas, path) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const box = await canvas.boundingBox();
  if (!box || box.width < 900 || box.height < 600) throw new Error(`${path}: invalid canvas bounds ${JSON.stringify(box)}`);
  const session = await page.context().newCDPSession(page);
  try {
    const r = await session.send('Page.captureScreenshot', {
      format: 'png', fromSurface: true, captureBeyondViewport: false,
      clip: { x: Math.max(0, Math.floor(box.x)), y: Math.max(0, Math.floor(box.y)), width: Math.floor(box.width), height: Math.floor(box.height), scale: 1 },
    });
    const png = Buffer.from(r.data, 'base64');
    if (png.length < 10000 || png.readUInt32BE(16) < 900 || png.readUInt32BE(20) < 600) throw new Error(`${path}: screenshot is too small`);
    fs.writeFileSync(path, png);
    return { bytes: png.length, width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
  } finally { await session.detach(); }
}

async function waitRuntime(page, expectedId, expectedSource) {
  const canvas = page.locator('canvas.trainerCanvas');
  await canvas.waitFor({ state: 'visible', timeout: 45000 });
  await page.waitForFunction(({ id, source }) => {
    const c = document.querySelector('canvas.trainerCanvas');
    return c?.dataset.equipmentId === id && c?.dataset.tugSource === source;
  }, { id: expectedId, source: expectedSource }, { timeout: 90000 });
  await page.waitForFunction(() => {
    const c = document.querySelector('canvas.trainerCanvas');
    return c && c.dataset.environmentSource && c.dataset.environmentSource !== 'loading-authored-phx-terminal4-textured'
      && c.dataset.environmentSource !== 'load-error'
      && c.dataset.groundSource && !/^loading|load-error$/.test(c.dataset.groundSource)
      && c.dataset.photoGroundSource && !/^loading|load-error$/.test(c.dataset.photoGroundSource)
      && c.dataset.terminal4UploadedJetwayLoadState === 'ready';
  }, null, { timeout: 120000 });
  return canvas;
}

async function enterFreeDrive(page) {
  const toggle = page.getByRole('button', { name: /Free-drive inspection/i });
  if (await toggle.count()) await toggle.click();
  await page.waitForFunction(() => document.querySelector('canvas.trainerCanvas')?.dataset.inspectionMode === 'active', null, { timeout: 10000 });
  const location = page.getByRole('combobox', { name: 'Inspection location' });
  await location.selectOption('a14');
  await page.waitForFunction(() => document.querySelector('canvas.trainerCanvas')?.dataset.inspectionPreset === 'a14', null, { timeout: 10000 });
}

async function steerForEvidence(page) {
  await page.keyboard.down('a');
  await page.keyboard.down('w');
  await page.waitForTimeout(1700);
  await page.keyboard.up('w');
  await page.waitForTimeout(1100);
  await page.keyboard.up('a');
  await page.waitForTimeout(500);
}

async function orbitForEvidence(page) {
  await page.evaluate(() => {
    const canvas = document.querySelector('canvas.trainerCanvas');
    const box = canvas.getBoundingClientRect();
    const x = box.left + box.width * 0.52;
    const y = box.top + box.height * 0.50;
    const down = { bubbles: true, cancelable: true, pointerId: 77, pointerType: 'mouse', button: 0, buttons: 1, clientX: x, clientY: y };
    canvas.dispatchEvent(new PointerEvent('pointerdown', down));
    window.dispatchEvent(new PointerEvent('pointermove', { ...down, clientX: x + 220, clientY: y - 35 }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...down, clientX: x + 220, clientY: y - 35, buttons: 0 }));
  });
  await page.waitForTimeout(700);
}

async function launchVehicle(browser, spec) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const d = diagnostics(page);
  const response = await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (!response?.ok()) throw new Error(`${spec.id}: navigation HTTP ${response?.status()}`);
  await page.getByRole('heading', { name: 'Choose pushback equipment' }).waitFor({ state: 'visible', timeout: 30000 });

  if (spec.manager) {
    await page.getByRole('button', { name: /Drive tug \/ inspect airport — Manager Kubota/i }).click();
  } else {
    const radio = page.getByRole('radio', { name: spec.radio });
    if (await radio.getAttribute('aria-checked') !== 'true') await radio.click();
    await page.getByRole('button', { name: 'Start training' }).click();
  }

  const canvas = await waitRuntime(page, spec.id, spec.source);
  if (!spec.manager) await enterFreeDrive(page);
  else {
    await page.waitForFunction(() => document.querySelector('canvas.trainerCanvas')?.dataset.inspectionMode === 'active', null, { timeout: 10000 });
    const location = page.getByRole('combobox', { name: 'Inspection location' });
    await location.selectOption('a14');
    await page.waitForFunction(() => document.querySelector('canvas.trainerCanvas')?.dataset.inspectionPreset === 'a14', null, { timeout: 10000 });
  }

  await steerForEvidence(page);
  await orbitForEvidence(page);
  await page.addStyleTag({ content: '.rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}' });
  const image = await captureCanvas(page, canvas, `${OUT}/${spec.file}`);
  const data = await canvas.evaluate(c => ({
    equipmentId: c.dataset.equipmentId,
    tugSource: c.dataset.tugSource,
    steeringMode: c.dataset.steeringMode,
    inspectionMode: c.dataset.inspectionMode,
    inspectionPreset: c.dataset.inspectionPreset,
    environmentSource: c.dataset.environmentSource,
    groundSource: c.dataset.groundSource,
    photoGroundSource: c.dataset.photoGroundSource,
    terminal4UploadedJetwayLoadState: c.dataset.terminal4UploadedJetwayLoadState,
    terminal4UploadedJetwayCount: c.dataset.terminal4UploadedJetwayCount,
    terminal4UploadedJetwayConnectorCount: c.dataset.terminal4UploadedJetwayConnectorCount,
    terminal4UploadedJetwayVerifiedModelCount: c.dataset.terminal4UploadedJetwayVerifiedModelCount,
    cameraYaw: c.dataset.cameraYaw,
  }));

  const relevantFailures = d.failedRequests.filter(x => /models\/(?:lektro-88|standup-tug|manager-kubota)\.glb|assets\/.*\.js/i.test(x));
  const criticalConsole = d.consoleErrors.filter(x => /Equipment model failed to load|PHX Terminal 4 failed to load|GLTFLoader|ReferenceError|TypeError|SyntaxError/i.test(x));
  if (relevantFailures.length || d.pageErrors.length || criticalConsole.length) {
    throw new Error(`${spec.id}: runtime diagnostics failed: ${JSON.stringify({ relevantFailures, pageErrors: d.pageErrors, criticalConsole })}`);
  }
  if (!d.modelResponses.some(x => x.ok && x.status === 200 && x.url.endsWith(`/models/${spec.id}.glb`))) {
    throw new Error(`${spec.id}: no successful exact model response observed: ${JSON.stringify(d.modelResponses)}`);
  }
  if (data.terminal4UploadedJetwayLoadState !== 'ready' || data.terminal4UploadedJetwayCount !== '58' || data.terminal4UploadedJetwayVerifiedModelCount !== '58') {
    throw new Error(`${spec.id}: Terminal 4 readiness telemetry invalid: ${JSON.stringify(data)}`);
  }
  await page.close();
  return { ...data, image, diagnostics: d };
}

async function captureTerminal(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const d = diagnostics(page);
  const response = await page.goto(PAGE_URL, { waitUntil: 'domcontentloaded', timeout: 90000 });
  if (!response?.ok()) throw new Error(`terminal: navigation HTTP ${response?.status()}`);
  await page.getByRole('button', { name: /Drive tug \/ inspect airport — Manager Kubota/i }).click();
  const canvas = await waitRuntime(page, 'manager-kubota', 'RTVManagersKubota.3mf');
  const location = page.getByRole('combobox', { name: 'Inspection location' });
  await location.selectOption('a1Connection');
  await page.waitForFunction(() => document.querySelector('canvas.trainerCanvas')?.dataset.inspectionPreset === 'a1Connection', null, { timeout: 10000 });
  await page.waitForTimeout(1600);
  await page.addStyleTag({ content: '.rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}' });
  const image = await captureCanvas(page, canvas, `${OUT}/terminal4-a1-connection.png`);
  const data = await canvas.evaluate(c => ({
    environmentSource: c.dataset.environmentSource,
    terminal4UploadedJetwayLoadState: c.dataset.terminal4UploadedJetwayLoadState,
    terminal4UploadedJetwayCount: c.dataset.terminal4UploadedJetwayCount,
    terminal4UploadedJetwayConnectorCount: c.dataset.terminal4UploadedJetwayConnectorCount,
    terminal4UploadedJetwayVerifiedModelCount: c.dataset.terminal4UploadedJetwayVerifiedModelCount,
    terminal4A1PortalSealAuthority: c.dataset.terminal4A1PortalSealAuthority,
    inspectionPreset: c.dataset.inspectionPreset,
  }));
  const criticalConsole = d.consoleErrors.filter(x => /PHX Terminal 4 failed to load|GLTFLoader|ReferenceError|TypeError|SyntaxError/i.test(x));
  if (d.pageErrors.length || criticalConsole.length || data.environmentSource === 'load-error') {
    throw new Error(`terminal: browser diagnostics failed ${JSON.stringify({ data, pageErrors: d.pageErrors, criticalConsole })}`);
  }
  await page.close();
  return { ...data, image, diagnostics: d };
}

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  try {
    const result = { expectedSha: EXPECTED_SHA, pageUrl: PAGE_URL, vehicles: {}, terminal: null };
    for (const spec of VEHICLES) result.vehicles[spec.id] = await launchVehicle(browser, spec);
    result.terminal = await captureTerminal(browser);
    fs.writeFileSync(`${OUT}/summary.json`, JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ status: 'verified', expectedSha: EXPECTED_SHA, vehicles: Object.fromEntries(Object.entries(result.vehicles).map(([k,v]) => [k, { tugSource: v.tugSource, image: v.image }])), terminal: { environmentSource: result.terminal.environmentSource, image: result.terminal.image } }, null, 2));
  } catch (error) {
    fs.writeFileSync(`${OUT}/error.txt`, `${error.stack || error}\n`);
    console.error(error);
    process.exitCode = 1;
  } finally { await browser.close(); }
})();
