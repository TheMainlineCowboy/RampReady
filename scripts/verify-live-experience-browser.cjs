const { chromium } = require('playwright');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL;
const expectedSha = process.env.EXPECTED_SHA;
const evidenceDir = 'live-experience-evidence';
const modelSuffixes = ['/models/crj700-user.glb', '/models/crj700-mobile.glb'];
const criticalConsolePattern = /CRJ700 asset load failed|Unexpected CRJ700 dimensions|GLTFLoader|WebGL.*shader|VALIDATE_STATUS|ReferenceError|TypeError|SyntaxError/i;

fs.mkdirSync(evidenceDir, { recursive: true });

function attachDiagnostics(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], failedRequests: [], modelResponses: [] };
  page.on('console', message => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
  page.on('requestfailed', request => diagnostics.failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`));
  page.on('response', response => {
    const pathname = new URL(response.url()).pathname;
    if (modelSuffixes.some(suffix => pathname.endsWith(suffix))) {
      diagnostics.modelResponses.push({ url: response.url(), status: response.status(), ok: response.ok() });
    }
  });
  return diagnostics;
}

async function launchTraining(page) {
  await page.getByRole('heading', { name: 'Choose pushback equipment' }).waitFor({ state: 'visible', timeout: 30000 });
  const radios = page.getByRole('radio');
  if (await radios.count() !== 2) throw new Error(`Expected two equipment choices, found ${await radios.count()}`);
  const lektro = page.getByRole('radio', { name: /Lektro 88/i });
  const standup = page.getByRole('radio', { name: /Stand-up pushback/i });
  const launch = page.getByRole('button', { name: 'Start training' });

  if (await lektro.getAttribute('aria-checked') !== 'true') await lektro.click();
  if (await launch.isDisabled()) throw new Error('Lektro runtime is not launchable');
  await standup.click();
  if (!(await launch.isDisabled())) throw new Error('Stand-up model is launchable without its runtime GLB');
  await lektro.click();
  if (await launch.isDisabled()) throw new Error('Lektro launch did not re-enable');
  await launch.click();

  const canvas = page.locator('canvas.trainerCanvas');
  await canvas.waitFor({ state: 'visible', timeout: 30000 });
  await page.waitForFunction(() => {
    const element = document.querySelector('canvas.trainerCanvas');
    return element?.dataset.equipmentId === 'lektro-88'
      && element?.dataset.aircraftSource
      && element.dataset.aircraftSource !== 'loading';
  }, null, { timeout: 45000 });
  return canvas;
}

async function orbit(page, canvas, dx, dy = 0) {
  const before = Number(await canvas.getAttribute('data-camera-yaw'));
  await page.evaluate(({ dx, dy }) => {
    const canvas = document.querySelector('canvas.trainerCanvas');
    if (!canvas) throw new Error('Three.js canvas is missing');
    const box = canvas.getBoundingClientRect();
    const x = box.left + box.width * 0.55;
    const y = box.top + box.height * 0.52;
    const held = { bubbles: true, cancelable: true, pointerId: 71, pointerType: 'mouse', button: 0, buttons: 1 };
    canvas.dispatchEvent(new PointerEvent('pointerdown', { ...held, clientX: x, clientY: y }));
    window.dispatchEvent(new PointerEvent('pointermove', { ...held, clientX: x + dx, clientY: y + dy }));
    window.dispatchEvent(new PointerEvent('pointerup', { ...held, clientX: x + dx, clientY: y + dy, buttons: 0 }));
  }, { dx, dy });
  await page.waitForTimeout(400);
  const after = Number(await canvas.getAttribute('data-camera-yaw'));
  if (!Number.isFinite(before) || !Number.isFinite(after) || Math.abs(after - before) < 0.25) {
    throw new Error(`Camera orbit did not respond: ${before} -> ${after}`);
  }
  return { before, after };
}

async function saveCanvasPng(page, canvas, filePath, minimumWidth, minimumHeight) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const dataUrl = await canvas.evaluate(element => element.toDataURL('image/png'));
  const markerIndex = dataUrl.indexOf('base64,');
  if (markerIndex < 0) throw new Error(`${filePath} did not return a PNG data URL`);
  const payload = Buffer.from(dataUrl.slice(markerIndex + 7), 'base64');
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!payload.subarray(0, 8).equals(signature)) throw new Error(`${filePath} is not a PNG`);
  if (payload.byteLength < 5000) throw new Error(`${filePath} is unexpectedly small: ${payload.byteLength}`);
  const width = payload.readUInt32BE(16);
  const height = payload.readUInt32BE(20);
  if (width < minimumWidth || height < minimumHeight) {
    throw new Error(`${filePath} dimensions ${width}x${height} are below ${minimumWidth}x${minimumHeight}`);
  }
  fs.writeFileSync(filePath, payload);
  return { width, height, byteLength: payload.byteLength };
}

function rejectCriticalDiagnostics(label, diagnostics) {
  const criticalConsoleErrors = diagnostics.consoleErrors.filter(message => criticalConsolePattern.test(message));
  if (criticalConsoleErrors.length) throw new Error(`${label} critical console errors: ${criticalConsoleErrors.join(' | ')}`);
  if (diagnostics.pageErrors.length) throw new Error(`${label} page errors: ${diagnostics.pageErrors.join(' | ')}`);
  const criticalFailedRequests = diagnostics.failedRequests.filter(message => /crj700-(?:user|mobile)\.glb|assets\/.*\.js/i.test(message));
  if (criticalFailedRequests.length) throw new Error(`${label} critical failed requests: ${criticalFailedRequests.join(' | ')}`);
  if (!diagnostics.modelResponses.some(entry => entry.ok && entry.status === 200)) {
    throw new Error(`${label} observed no successful aircraft GLB response`);
  }
}

async function verifyDesktop(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const diagnostics = attachDiagnostics(page);
  const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 90000 });
  if (!response?.ok()) throw new Error(`Desktop navigation failed: ${response?.status() || 'no response'}`);
  const canvas = await launchTraining(page);
  await page.waitForTimeout(1800);
  const cameraDrag = await orbit(page, canvas, 180, -45);
  await page.addStyleTag({ content: '.rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}' });
  const chase = await saveCanvasPng(page, canvas, `${evidenceDir}/aircraft-chase.png`, 1000, 700);
  await orbit(page, canvas, 620, 0);
  const side = await saveCanvasPng(page, canvas, `${evidenceDir}/aircraft-side.png`, 1000, 700);
  await page.selectOption('.rr-view-select', 'overhead');
  await page.waitForTimeout(500);
  const overhead = await saveCanvasPng(page, canvas, `${evidenceDir}/aircraft-overhead.png`, 1000, 700);
  const source = await canvas.getAttribute('data-aircraft-source');
  rejectCriticalDiagnostics('Desktop', diagnostics);
  await page.close();
  return { source, cameraDrag, diagnostics, images: { chase, side, overhead } };
}

async function verifyMobile(browser) {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true });
  const diagnostics = attachDiagnostics(page);
  const response = await page.goto(pageUrl, { waitUntil: 'networkidle', timeout: 90000 });
  if (!response?.ok()) throw new Error(`Mobile navigation failed: ${response?.status() || 'no response'}`);
  const canvas = await launchTraining(page);
  await page.waitForTimeout(1400);
  const layout = await page.evaluate(() => {
    const rect = selector => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height };
    };
    return {
      viewport: { width: innerWidth, height: innerHeight },
      canvas: rect('canvas.trainerCanvas'),
      hud: rect('.rr-hud'),
      metrics: rect('.rr-metrics'),
      throttle: rect('.rr-throttle'),
      steer: rect('.rr-steer'),
      slider: rect('.rr-power-slider'),
      menu: rect('.rr-session-menu'),
    };
  });

  for (const name of ['canvas', 'hud', 'metrics', 'throttle', 'steer', 'slider', 'menu']) {
    if (!layout[name]) throw new Error(`Missing mobile layout element: ${name}`);
  }
  if (layout.canvas.width < 400 || layout.canvas.height < 890) throw new Error(`Canvas does not fill mobile viewport: ${JSON.stringify(layout.canvas)}`);
  for (const name of ['hud', 'metrics', 'throttle', 'steer', 'slider', 'menu']) {
    const box = layout[name];
    if (box.left < -1 || box.right > layout.viewport.width + 1 || box.top < -1 || box.bottom > layout.viewport.height + 1) {
      throw new Error(`${name} is outside mobile viewport: ${JSON.stringify(box)}`);
    }
  }
  if (layout.metrics.height > 58 || layout.metrics.bottom > layout.throttle.top + 2) throw new Error('Metrics overlay is not compactly stacked');
  if (Math.abs(layout.throttle.bottom - layout.steer.top) > 12) throw new Error('Throttle and steering decks are not stacked compactly');
  if (layout.slider.width < 120 || layout.slider.height < 40) throw new Error(`Throttle slider is not visibly usable: ${JSON.stringify(layout.slider)}`);

  const slider = page.locator('.rr-power-slider');
  await slider.evaluate(element => {
    element.value = '55';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  if (await slider.inputValue() !== '55') throw new Error('Throttle slider did not accept input');

  const cameraDrag = await orbit(page, canvas, 120, -30);
  const image = await saveCanvasPng(page, canvas, `${evidenceDir}/mobile-canvas.png`, 400, 800);
  fs.writeFileSync(`${evidenceDir}/mobile-layout.json`, JSON.stringify(layout, null, 2));
  rejectCriticalDiagnostics('Mobile', diagnostics);
  await page.close();
  return { layout, cameraDrag, diagnostics, image };
}

(async () => {
  if (!pageUrl || !expectedSha) throw new Error('PAGE_URL and EXPECTED_SHA are required');
  const browser = await chromium.launch({ headless: true });
  try {
    const desktop = await verifyDesktop(browser);
    const mobile = await verifyMobile(browser);
    fs.writeFileSync(`${evidenceDir}/report.json`, JSON.stringify({ expectedSha, pageUrl, capturedAtUtc: new Date().toISOString(), desktop, mobile }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => {
  fs.writeFileSync(`${evidenceDir}/error.txt`, `${error.stack || error}\n`);
  console.error(error);
  process.exit(1);
});
