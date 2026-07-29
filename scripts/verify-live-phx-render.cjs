const { chromium } = require('playwright');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL;
const expectedSha = process.env.EXPECTED_SHA;
if (!pageUrl || !expectedSha) throw new Error('PAGE_URL and EXPECTED_SHA are required');

const evidenceDirectory = 'live-phx-render-evidence';
fs.mkdirSync(evidenceDirectory, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
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

  try {
    const response = await page.goto(`${pageUrl}?release=${expectedSha}`, { waitUntil: 'networkidle', timeout: 120000 });
    if (!response?.ok()) throw new Error(`RampReady navigation failed: ${response?.status() || 'no response'}`);

    await page.getByRole('heading', { name: 'Choose pushback equipment' }).waitFor({ state: 'visible', timeout: 30000 });
    const lektro = page.getByRole('radio', { name: /Lektro 88/i });
    if (await lektro.getAttribute('aria-checked') !== 'true') await lektro.click();
    const start = page.getByRole('button', { name: 'Start training' });
    if (await start.isDisabled()) throw new Error('Lektro scenario is not launchable');
    await start.click();

    const canvas = page.locator('canvas.trainerCanvas');
    await canvas.waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForFunction(() => {
      const element = document.querySelector('canvas.trainerCanvas');
      return element?.dataset.photoGroundSource === 'source-authored-phx-photo'
        && element?.dataset.photoTextureMode === 'tiled-native-source-resolution-v2'
        && element?.dataset.photoRuntimeTileCount === '21'
        && element?.dataset.photoDetailLevel === 'full-airport-source-aerial-tiled-1.2m-v2'
        && element?.dataset.environmentSource === 'authored-phx-terminal4-textured-source-jetways'
        && element?.dataset.groundSource === 'authored-kphx-v181-source-textured';
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
    if (tileResponses.size !== 21) throw new Error(`Browser observed ${tileResponses.size} PHX ground tile responses, expected 21`);
    const badTiles = [...tileResponses.values()].filter(entry => !entry.ok || entry.status !== 200);
    if (badTiles.length) throw new Error(`PHX tile responses failed: ${JSON.stringify(badTiles)}`);

    const runtime = await canvas.evaluate(element => ({ ...element.dataset }));
    const criticalErrors = consoleErrors.filter(message => /PHX|KPHX|Terminal 4|GLTFLoader|WebGL|ReferenceError|TypeError|SyntaxError/i.test(message));
    const criticalFailedRequests = failedRequests.filter(message => /kphx-photo|phx-terminal4|kphx-ground|assets\/.*\.js/i.test(message));
    if (criticalErrors.length) throw new Error(`Critical browser console errors: ${criticalErrors.join(' | ')}`);
    if (pageErrors.length) throw new Error(`Browser page errors: ${pageErrors.join(' | ')}`);
    if (criticalFailedRequests.length) throw new Error(`Critical browser request failures: ${criticalFailedRequests.join(' | ')}`);

    await page.addStyleTag({ content: '.rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}' });
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const bounds = await canvas.boundingBox();
    if (!bounds || bounds.width < 1000 || bounds.height < 700) throw new Error(`Trainer canvas is too small: ${JSON.stringify(bounds)}`);
    const screenshotPath = `${evidenceDirectory}/sky-harbor-live.png`;
    await canvas.screenshot({ path: screenshotPath, type: 'png', animations: 'disabled' });
    const screenshotBytes = fs.statSync(screenshotPath).size;
    if (screenshotBytes < 100000) throw new Error(`Sky Harbor render screenshot is unexpectedly small: ${screenshotBytes}`);

    const report = {
      releaseSha: expectedSha,
      pageUrl,
      capturedAtUtc: new Date().toISOString(),
      runtime,
      observedTileResponses: tileResponses.size,
      tileResponses: [...tileResponses.values()],
      screenshotBytes,
      consoleErrors,
      pageErrors,
      failedRequests,
    };
    fs.writeFileSync(`${evidenceDirectory}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
    console.log(`Verified live simulator render: tiled PHX ground=${runtime.photoTextureMode}, runtime tiles=${runtime.photoRuntimeTileCount}, Terminal 4=${runtime.environmentSource}, screenshot=${screenshotBytes} bytes.`);
  } finally {
    await browser.close();
  }
})().catch(error => {
  fs.writeFileSync(`${evidenceDirectory}/error.txt`, `${error.stack || error}\n`);
  console.error(error);
  process.exit(1);
});
