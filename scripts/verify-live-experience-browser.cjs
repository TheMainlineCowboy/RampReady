const { chromium } = require('playwright');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL;
const expectedSha = process.env.EXPECTED_SHA;
const evidenceDir = 'live-experience-evidence';
const modelSuffixes = ['/models/crj700-user.glb', '/models/crj700-mobile.glb'];
const criticalConsolePattern = /CRJ700 asset load failed|Unexpected CRJ700 dimensions|GLTFLoader|WebGL.*shader|VALIDATE_STATUS|ReferenceError|TypeError|SyntaxError/i;
const syntheticPointerCapturePattern = /Failed to execute '(?:set|release)PointerCapture'.*No active pointer with the given id/i;

fs.mkdirSync(evidenceDir, { recursive: true });

function attachDiagnostics(page) {
  const diagnostics = { consoleErrors: [], pageErrors: [], syntheticPointerErrors: [], failedRequests: [], modelResponses: [] };
  page.on('console', message => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
  });
  page.on('pageerror', error => {
    if (syntheticPointerCapturePattern.test(error.message)) diagnostics.syntheticPointerErrors.push(error.message);
    else diagnostics.pageErrors.push(error.message);
  });
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

async function setCameraView(page, value) {
  const result = await page.locator('.rr-view-select').evaluate((element, nextValue) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    element.value = nextValue;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    return {
      value: element.value,
      display: style.display,
      visibility: style.visibility,
      width: box.width,
      height: box.height,
    };
  }, value);
  if (result.value !== value) throw new Error(`Camera view did not accept ${value}: ${JSON.stringify(result)}`);
  await page.waitForFunction(expected => document.querySelector('.rr-view-select')?.value === expected, value, { timeout: 5000 });
  await page.waitForTimeout(700);
  return result;
}

async function inspectCompositedPng(page, payload) {
  return page.evaluate(async base64 => {
    const image = new Image();
    image.src = `data:image/png;base64,${base64}`;
    await image.decode();
    const sample = document.createElement('canvas');
    sample.width = 64;
    sample.height = 64;
    const context = sample.getContext('2d', { willReadFrequently: true });
    context.drawImage(image, 0, 0, sample.width, sample.height);
    const pixels = context.getImageData(0, 0, sample.width, sample.height).data;
    let minimum = 255;
    let maximum = 0;
    let nonBlack = 0;
    let sum = 0;
    let sumSquares = 0;
    const buckets = new Set();
    const count = pixels.length / 4;
    for (let index = 0; index < pixels.length; index += 4) {
      const luma = Math.round(0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
      minimum = Math.min(minimum, luma);
      maximum = Math.max(maximum, luma);
      if (luma > 12) nonBlack += 1;
      sum += luma;
      sumSquares += luma * luma;
      buckets.add(`${pixels[index] >> 4}:${pixels[index + 1] >> 4}:${pixels[index + 2] >> 4}`);
    }
    const mean = sum / count;
    const variance = Math.max(0, sumSquares / count - mean * mean);
    return {
      mean,
      standardDeviation: Math.sqrt(variance),
      nonBlackRatio: nonBlack / count,
      dynamicRange: maximum - minimum,
      uniqueColorBuckets: buckets.size,
    };
  }, payload.toString('base64'));
}

async function saveCanvasPng(page, canvas, filePath, minimumWidth, minimumHeight) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`${filePath} canvas has no rendered bounds`);
  const clip = {
    x: Math.max(0, Math.floor(box.x)),
    y: Math.max(0, Math.floor(box.y)),
    width: Math.floor(box.width),
    height: Math.floor(box.height),
  };
  const payload = await page.screenshot({ type: 'png', clip, animations: 'disabled', caret: 'hide' });
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!payload.subarray(0, 8).equals(signature)) throw new Error(`${filePath} is not a PNG`);
  if (payload.byteLength < 5000) throw new Error(`${filePath} is unexpectedly small: ${payload.byteLength}`);
  const width = payload.readUInt32BE(16);
  const height = payload.readUInt32BE(20);
  if (width < minimumWidth || height < minimumHeight) {
    throw new Error(`${filePath} dimensions ${width}x${height} are below ${minimumWidth}x${minimumHeight}`);
  }
  const pixelStats = await inspectCompositedPng(page, payload);
  if (pixelStats.nonBlackRatio < 0.3 || pixelStats.dynamicRange < 24 || pixelStats.standardDeviation < 6 || pixelStats.uniqueColorBuckets < 12) {
    throw new Error(`${filePath} is blank or visually flat: ${JSON.stringify(pixelStats)}`);
  }
  fs.writeFileSync(filePath, payload);
  return { width, height, byteLength: payload.byteLength, pixelStats };
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
  const view = page.locator('.rr-view-select');
  await view.waitFor({ state: 'visible', timeout: 10000 });
  const viewBounds = await view.boundingBox();
  if (!viewBounds || viewBounds.width < 90 || viewBounds.height < 36) throw new Error(`Desktop camera selector is not visibly usable: ${JSON.stringify(viewBounds)}`);
  const cameraDrag = await orbit(page, canvas, 180, -45);
  await page.addStyleTag({ content: '.rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}' });
  const chase = await saveCanvasPng(page, canvas, `${evidenceDir}/aircraft-chase.png`, 1000, 700);
  await orbit(page, canvas, 620, 0);
  const side = await saveCanvasPng(page, canvas, `${evidenceDir}/aircraft-side.png`, 1000, 700);
  const overheadView = await setCameraView(page, 'overhead');
  const overhead = await saveCanvasPng(page, canvas, `${evidenceDir}/aircraft-overhead.png`, 1000, 700);
  const source = await canvas.getAttribute('data-aircraft-source');
  rejectCriticalDiagnostics('Desktop', diagnostics);
  await page.close();
  return { source, cameraDrag, viewBounds, overheadView, diagnostics, images: { chase, side, overhead } };
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
      view: rect('.rr-view-select'),
      menu: rect('.rr-session-menu'),
    };
  });

  for (const name of ['canvas', 'hud', 'metrics', 'throttle', 'steer', 'slider', 'view', 'menu']) {
    if (!layout[name]) throw new Error(`Missing mobile layout element: ${name}`);
  }
  if (layout.canvas.width < 400 || layout.canvas.height < 890) throw new Error(`Canvas does not fill mobile viewport: ${JSON.stringify(layout.canvas)}`);
  for (const name of ['hud', 'metrics', 'throttle', 'steer', 'slider', 'view', 'menu']) {
    const box = layout[name];
    if (box.left < -1 || box.right > layout.viewport.width + 1 || box.top < -1 || box.bottom > layout.viewport.height + 1) {
      throw new Error(`${name} is outside mobile viewport: ${JSON.stringify(box)}`);
    }
  }
  if (layout.metrics.height > 58 || layout.metrics.bottom > layout.throttle.top + 2) throw new Error('Metrics overlay is not compactly stacked');
  if (Math.abs(layout.throttle.bottom - layout.steer.top) > 12) throw new Error('Throttle and steering decks are not stacked compactly');
  if (layout.slider.width < 120 || layout.slider.height < 40) throw new Error(`Throttle slider is not visibly usable: ${JSON.stringify(layout.slider)}`);
  if (layout.view.width < 90 || layout.view.height < 36) throw new Error(`Camera selector is not visibly usable: ${JSON.stringify(layout.view)}`);

  const slider = page.locator('.rr-power-slider');
  await slider.evaluate(element => {
    element.value = '55';
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
  if (await slider.inputValue() !== '55') throw new Error('Throttle slider did not accept input');

  const cameraDrag = await orbit(page, canvas, 120, -30);
  fs.writeFileSync(`${evidenceDir}/mobile-layout.json`, JSON.stringify(layout, null, 2));
  await page.addStyleTag({ content: '.rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}' });
  const image = await saveCanvasPng(page, canvas, `${evidenceDir}/mobile-canvas.png`, 400, 800);
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
