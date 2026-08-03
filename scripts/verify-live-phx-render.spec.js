import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const pageUrl = process.env.PAGE_URL;
const expectedSha = process.env.EXPECTED_SHA;
const evidenceDirectory = 'live-phx-render-evidence';

async function captureCanvasClip(page, bounds, outputPath) {
  const session = await page.context().newCDPSession(page);
  try {
    const result = await session.send('Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: false,
      clip: {
        x: bounds.x,
        y: bounds.y,
        width: bounds.width,
        height: bounds.height,
        scale: 1,
      },
    });
    const png = Buffer.from(result.data, 'base64');
    fs.writeFileSync(outputPath, png);
    return png.length;
  } finally {
    await session.detach();
  }
}

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
test.setTimeout(240000);

test('live RampReady renders native-resolution Sky Harbor ground and authored Terminal 4', async ({ page }) => {
  if (!pageUrl || !expectedSha) throw new Error('PAGE_URL and EXPECTED_SHA are required');
  fs.mkdirSync(evidenceDirectory, { recursive: true });

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const tileResponses = new Map();

  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => failedRequests.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`));
  page.on('response', response => {
    const url = response.url();
    if (url.includes('/models/kphx-photo/tiles/')) {
      tileResponses.set(new URL(url).pathname, { status: response.status(), ok: response.ok(), url });
    }
  });

  const response = await page.goto(`${pageUrl}?release=${expectedSha}`, { waitUntil: 'networkidle', timeout: 120000 });
  expect(response?.ok()).toBe(true);

  await page.getByRole('heading', { name: 'Choose pushback equipment' }).waitFor({ state: 'visible', timeout: 30000 });
  const lektro = page.getByRole('radio', { name: /Lektro 88/i });
  if (await lektro.getAttribute('aria-checked') !== 'true') await lektro.click();
  const start = page.getByRole('button', { name: 'Start training' });
  await expect(start).toBeEnabled();
  await start.click();

  const canvas = page.locator('canvas.trainerCanvas');
  await expect(canvas).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => {
    const element = document.querySelector('canvas.trainerCanvas');
    return element?.dataset.photoGroundSource === 'source-authored-phx-photo'
      && element?.dataset.photoTextureMode === 'tiled-native-source-resolution-v2'
      && element?.dataset.photoRuntimeTileCount === '21'
      && element?.dataset.photoDetailLevel === 'full-airport-source-aerial-tiled-1.2m-v2'
      && element?.dataset.environmentSource === 'authored-phx-terminal4-textured-source-jetways'
      && element?.dataset.groundSource === 'authored-kphx-v181-source-textured-nearfield'
      && element?.dataset.kphxDetailLevel === 'terminal4-authored-pavement-v5-source-ramp-stand-markings';
  }, null, { timeout: 90000 });

  await page.waitForFunction(() => {
    const element = document.querySelector('canvas.trainerCanvas');
    return element?.dataset.terminal4TextureCount
      && element.dataset.terminal4TextureCount !== 'loading'
      && element?.dataset.terminal4TexturedMaterialCount
      && element.dataset.terminal4TexturedMaterialCount !== 'loading'
      && element?.dataset.b15Anchors === 'ready';
  }, null, { timeout: 30000 });

  await page.waitForTimeout(2500);
  expect(tileResponses.size).toBe(21);
  expect([...tileResponses.values()].filter(entry => !entry.ok || entry.status !== 200)).toEqual([]);

  const runtime = await canvas.evaluate(element => ({ ...element.dataset }));
  const criticalErrors = consoleErrors.filter(message => /PHX|KPHX|Terminal 4|GLTFLoader|WebGL|ReferenceError|TypeError|SyntaxError/i.test(message));
  const criticalFailedRequests = failedRequests.filter(message => /kphx-photo|phx-terminal4|kphx-ground|assets\/.*\.js/i.test(message));
  expect(criticalErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(criticalFailedRequests).toEqual([]);

  await page.addStyleTag({ content: '.rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}' });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const bounds = await canvas.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds.width).toBeGreaterThanOrEqual(1000);
  expect(bounds.height).toBeGreaterThanOrEqual(700);

  const chasePath = `${evidenceDirectory}/sky-harbor-live.png`;
  const chaseBytes = await captureCanvasClip(page, bounds, chasePath);
  expect(chaseBytes).toBeGreaterThan(100000);

  const overheadSelection = await page.evaluate(() => {
    const selector = document.querySelector('.rr-view-select');
    if (!selector) throw new Error('Camera view selector is missing');
    selector.value = 'overhead';
    selector.dispatchEvent(new Event('input', { bubbles: true }));
    selector.dispatchEvent(new Event('change', { bubbles: true }));
    return selector.value;
  });
  expect(overheadSelection).toBe('overhead');
  await page.waitForTimeout(1000);
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const overheadPath = `${evidenceDirectory}/sky-harbor-overhead.png`;
  const overheadBytes = await captureCanvasClip(page, bounds, overheadPath);
  expect(overheadBytes).toBeGreaterThan(100000);

  const report = {
    releaseSha: expectedSha,
    pageUrl,
    capturedAtUtc: new Date().toISOString(),
    runtime,
    observedTileResponses: tileResponses.size,
    tileResponses: [...tileResponses.values()],
    screenshots: { chaseBytes, overheadBytes },
    consoleErrors,
    pageErrors,
    failedRequests,
  };
  fs.writeFileSync(`${evidenceDirectory}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Verified live simulator render: tiled PHX ground=${runtime.photoTextureMode}, near-field ground=${runtime.groundSource}, detail=${runtime.kphxDetailLevel}, runtime tiles=${runtime.photoRuntimeTileCount}, Terminal 4=${runtime.environmentSource}, chase=${chaseBytes} bytes, overhead=${overheadBytes} bytes.`);
});
