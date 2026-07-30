const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

const pageUrl = process.env.PAGE_URL;
const expectedSha = process.env.EXPECTED_SHA;
const evidenceDirectory = 'live-phx-render-evidence';

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
test.setTimeout(240000);

function numericDataset(runtime, key) {
  const value = Number(runtime[key]);
  if (!Number.isFinite(value)) throw new Error(`Live PHX runtime dataset ${key} is not numeric: ${runtime[key]}`);
  return value;
}

test('live RampReady renders simulator-quality Sky Harbor and supports free-drive inspection', async ({ page }) => {
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
      && element?.dataset.groundSource === 'authored-kphx-v181-source-textured-nearfield';
  }, null, { timeout: 90000 });

  await page.waitForFunction(() => {
    const element = document.querySelector('canvas.trainerCanvas');
    return element?.dataset.terminal4TextureCount
      && element.dataset.terminal4TextureCount !== 'loading'
      && element?.dataset.terminal4TexturedMaterialCount
      && element.dataset.terminal4TexturedMaterialCount !== 'loading'
      && element?.dataset.terminal4A1JetwayWallDistance
      && element.dataset.terminal4A1JetwayWallDistance !== 'loading'
      && element?.dataset.terminal4TerminalConnectedJetwayCount
      && element.dataset.terminal4TerminalConnectedJetwayCount !== 'loading'
      && element?.dataset.terminal4SourceCutoutMaterialCount
      && element.dataset.terminal4SourceCutoutMaterialCount !== 'loading'
      && element?.dataset.groundMarkingContactMode === 'pavement-relative-millimeter-offset'
      && element?.dataset.b15Anchors === 'ready';
  }, null, { timeout: 30000 });

  await page.waitForTimeout(2500);
  expect(tileResponses.size).toBe(21);
  expect([...tileResponses.values()].filter(entry => !entry.ok || entry.status !== 200)).toEqual([]);

  const loadedRuntime = await canvas.evaluate(element => ({ ...element.dataset }));
  const a1WallDistance = numericDataset(loadedRuntime, 'terminal4A1JetwayWallDistance');
  const connectedJetways = numericDataset(loadedRuntime, 'terminal4TerminalConnectedJetwayCount');
  const cutoutMaterials = numericDataset(loadedRuntime, 'terminal4SourceCutoutMaterialCount');
  expect(a1WallDistance).toBeGreaterThan(0.05);
  expect(a1WallDistance).toBeLessThan(18);
  expect(connectedJetways).toBeGreaterThan(0);
  expect(cutoutMaterials).toBeGreaterThan(0);
  expect(loadedRuntime.groundMarkingContactMode).toBe('pavement-relative-millimeter-offset');

  // Prove the requested inspection feature is a real unrestricted drive state,
  // not a camera shortcut or a procedure stage masquerading as free drive.
  await page.locator('details.rr-session-menu summary').click();
  await page.getByRole('button', { name: 'Free-drive inspection' }).click();
  await page.waitForFunction(() => document.querySelector('canvas.trainerCanvas')?.dataset.inspectionMode === 'active');
  await expect(page.getByRole('heading', { name: 'Airport inspection mode' })).toBeVisible();

  const beforeDrive = await canvas.evaluate(element => ({
    x: Number(element.dataset.inspectionTugX),
    z: Number(element.dataset.inspectionTugZ),
  }));
  const power = page.locator('input[aria-label="Power"]');
  await power.evaluate(input => {
    input.value = '35';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForFunction(({ x, z }) => {
    const element = document.querySelector('canvas.trainerCanvas');
    const nextX = Number(element?.dataset.inspectionTugX);
    const nextZ = Number(element?.dataset.inspectionTugZ);
    return Number.isFinite(nextX) && Number.isFinite(nextZ) && Math.hypot(nextX - x, nextZ - z) > 0.35;
  }, beforeDrive, { timeout: 12000 });
  await power.evaluate(input => {
    input.value = '0';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const afterDrive = await canvas.evaluate(element => ({
    x: Number(element.dataset.inspectionTugX),
    z: Number(element.dataset.inspectionTugZ),
    speed: Number(element.dataset.inspectionSpeed),
  }));
  expect(Math.hypot(afterDrive.x - beforeDrive.x, afterDrive.z - beforeDrive.z)).toBeGreaterThan(0.35);

  await page.locator('details.rr-session-menu summary').click();
  await page.getByRole('button', { name: 'Return to training' }).click();
  await page.waitForFunction(() => document.querySelector('canvas.trainerCanvas')?.dataset.inspectionMode === 'training');
  await expect(page.getByRole('heading', { name: 'Complete visual equipment check' })).toBeVisible();

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

  const screenshotPath = `${evidenceDirectory}/sky-harbor-live.png`;
  await canvas.screenshot({ path: screenshotPath, type: 'png', animations: 'disabled' });
  const screenshotBytes = fs.statSync(screenshotPath).size;
  expect(screenshotBytes).toBeGreaterThan(100000);

  await page.locator('select.rr-view-select').selectOption('overhead');
  await page.waitForTimeout(1600);
  const overheadPath = `${evidenceDirectory}/sky-harbor-overhead.png`;
  await canvas.screenshot({ path: overheadPath, type: 'png', animations: 'disabled' });
  const overheadBytes = fs.statSync(overheadPath).size;
  expect(overheadBytes).toBeGreaterThan(100000);

  const report = {
    releaseSha: expectedSha,
    pageUrl,
    capturedAtUtc: new Date().toISOString(),
    runtime,
    observedTileResponses: tileResponses.size,
    tileResponses: [...tileResponses.values()],
    inspectionDrive: { before: beforeDrive, after: afterDrive },
    a1WallDistance,
    connectedJetways,
    cutoutMaterials,
    screenshotBytes,
    overheadBytes,
    consoleErrors,
    pageErrors,
    failedRequests,
  };
  fs.writeFileSync(`${evidenceDirectory}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Verified live simulator-quality PHX: inspection moved=${Math.hypot(afterDrive.x - beforeDrive.x, afterDrive.z - beforeDrive.z).toFixed(2)}m, A1 wall=${a1WallDistance.toFixed(2)}m, terminal-connected jetways=${connectedJetways}, source cutouts=${cutoutMaterials}, markings=${runtime.groundMarkingContactMode}.`);
});
