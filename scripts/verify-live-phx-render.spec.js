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
      clip: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height, scale: 1 },
    });
    const png = Buffer.from(result.data, 'base64');
    fs.writeFileSync(outputPath, png);
    return png.length;
  } finally {
    await session.detach();
  }
}

test.use({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
test.setTimeout(720000);

test('live RampReady serves the exact locked KPHX runtime', async ({ page }) => {
  if (!pageUrl || !expectedSha) throw new Error('PAGE_URL and EXPECTED_SHA are required');
  fs.mkdirSync(evidenceDirectory, { recursive: true });

  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('requestfailed', request => failedRequests.push(
    `${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`
  ));

  const response = await page.goto(`${pageUrl}?release=${expectedSha}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  expect(response?.ok()).toBe(true);

  await page.getByRole('heading', { name: 'Choose RampReady equipment' }).waitFor({
    state: 'visible',
    timeout: 30000,
  });
  const lektro = page.getByRole('radio', { name: /Lektro 88/i });
  if (await lektro.getAttribute('aria-checked') !== 'true') await lektro.click();
  const start = page.getByRole('button', { name: 'Start training' });
  await expect(start).toBeEnabled();
  await start.click();

  const canvas = page.locator('canvas.trainerCanvas');
  await expect(canvas).toBeVisible({ timeout: 30000 });

  await page.waitForFunction(() => {
    const d = document.querySelector('canvas.trainerCanvas')?.dataset || {};
    return d.kphxExactLiveT4 === 'ready'
      && d.kphxExactLiveT4BuildingCount === '2'
      && d.kphxExactLiveT4JetwayCount === '76'
      && d.kphxExactLiveT4JetwayOpenEdgeCount === '261'
      && d.kphxExactLiveOldAirportJetwayGlbUsed === 'false'
      && d.kphxExactLiveProceduralTerminalMassing === 'false'
      && d.kphxExactLiveLegacyFsxTerminal === 'false'
      && d.terminal4ExactJetwayTextureActive === 'true'
      && d.tugSource === 'lektro-ap88-tvo914-r187a'
      && d.rigProfile === 'lektro-ap88-tvo914-r187a'
      && d.rigWheelbaseMeters === '2.33934'
      && d.rigTurningRadiusMeters === '4.572'
      && d.rigFreeMaxSpeedMps === '4.02336'
      && d.rigTowMaxSpeedMps === '1.78816'
      && d.rigVisualMaxSteerDegrees === '84.000'
      && d.tugModelForwardCorrectionDegrees === '180'
      && d.kphxSurfaceReady === 'true'
      && d.kphxSurfacePolygonCount === '27'
      && d.kphxSurfaceFailureCount === '0'
      && d.kphxA1ZdpSurfaceReady === 'true'
      && d.kphxA1ZdpSurfacePolygonCount === '14'
      && d.kphxA1ZdpMarkingsReady === 'true'
      && d.kphxA1ZdpMarkingLineMeshCount === '26'
      && d.kphxA1ZdpMarkingTextureDecodeCount === '4'
      && d.kphxA1ZdpMarkingFailureCount === '0'
      && d.photoGroundSource === 'not-used-exact-kphx-1.75.1-only';
  }, null, { timeout: 180000 });

  await expect(page.locator('.rr-runtime-loading')).toHaveCount(0, { timeout: 30000 });

  await page.waitForTimeout(1500);
  const initialA1Runtime = await canvas.evaluate(element => ({ ...element.dataset }));
  console.log('A1_INITIAL_RUNTIME_DATASET=' + JSON.stringify({
    deployment: initialA1Runtime.a1JetwayDeployment,
    state: initialA1Runtime.a1JetwayState,
    doorContactReady: initialA1Runtime.a1JetwayDoorContactReady,
    doorContactGapMeters: initialA1Runtime.a1JetwayDoorContactGapMeters,
    doorContactHitObject: initialA1Runtime.a1JetwayDoorContactHitObject,
    connectedLatMeters: initialA1Runtime.a1JetwayConnectedLatMeters,
    connectedVertMeters: initialA1Runtime.a1JetwayConnectedVertMeters,
    sourcePoseMaxMatrixDelta: initialA1Runtime.a1JetwaySourcePoseMaxMatrixDelta,
    supportBottomDeltaMeters: initialA1Runtime.a1JetwaySupportBottomDeltaMeters,
    cabinJointGapMeters: initialA1Runtime.a1JetwayCabinJointGapMeters,
    fixedWallMotionMaxMeters: initialA1Runtime.a1JetwayFixedWallMotionMaxMeters,
    fixedWallRotationMaxRadians: initialA1Runtime.a1JetwayFixedWallRotationMaxRadians,
  }));

  await page.waitForFunction(() => {
    const d = document.querySelector('canvas.trainerCanvas')?.dataset || {};
    const gap = Number(d.a1JetwayDoorContactGapMeters);
    const lat = Number(d.a1XPlaneAutoGateLatMeters);
    const vert = Number(d.a1XPlaneAutoGateVertMeters);
    return d.a1AircraftDockingAuthority === 'a1-wed-104804-node-104811-plus-xplane-crj-acf-autogate-door-v1'
      && d.a1AircraftSourceAcf === 'CRJ9NG/crj900NG.acf'
      && d.a1JetwayAircraftSourceAcf === 'CRJ9NG/crj900NG.acf'
      && d.a1JetwayCabinEndWedNodeId === '104811'
      && d.a1JetwayDoorContactReady === 'true'
      && Number.isFinite(gap)
      && gap <= 0.08
      && Number.isFinite(lat)
      && Math.abs(lat - 6.1284) <= 0.001
      && Number.isFinite(vert)
      && Math.abs(vert - (-1.9158528682264)) <= 0.002;
  }, null, { timeout: 60000, polling: 100 });

  const runtime = await canvas.evaluate(element => ({ ...element.dataset }));
  expect(runtime.a1JetwayDoorContactReady).toBe('true');
  expect(Number(runtime.a1JetwayDoorContactGapMeters)).toBeLessThanOrEqual(0.08);
  expect(runtime.a1JetwayDoorContactHitObject).not.toBe('no-visible-cabin-hit');
  expect(runtime.a1JetwayAircraftSourceAcf).toBe('CRJ9NG/crj900NG.acf');
  expect(runtime.a1JetwayCabinEndWedNodeId).toBe('104811');
  expect(Number(runtime.a1XPlaneAutoGateLatMeters)).toBeCloseTo(6.1284, 3);
  expect(Number(runtime.a1XPlaneAutoGateVertMeters)).toBeCloseTo(-1.9158528682264, 3);
  expect(runtime.a1JetwaySupportTrianglePartitionExact).toBe('true');
  expect(Math.abs(Number(runtime.a1JetwaySupportBottomDeltaMeters))).toBeLessThanOrEqual(0.02);
  const criticalErrors = consoleErrors.filter(message =>
    /PHX|KPHX|Terminal 4|GLTFLoader|WebGL|ReferenceError|TypeError|SyntaxError/i.test(message)
  );
  const criticalFailedRequests = failedRequests.filter(message =>
    /kphx-full-airport|models\/kphx\/|models\/lektro-88|assets\/.*\.js/i.test(message)
  );
  expect(criticalErrors).toEqual([]);
  expect(pageErrors).toEqual([]);
  expect(criticalFailedRequests).toEqual([]);

  await page.addStyleTag({
    content: '.rr-hud,.rr-metrics,.rr-score-float,.rr-guidance,.rr-diagnostics,.rr-steer,.rr-throttle{display:none!important}',
  });
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const bounds = await page.evaluate(() => {
    const element = document.querySelector('canvas.trainerCanvas');
    if (!(element instanceof HTMLCanvasElement)) throw new Error('Three.js canvas is missing before live capture');
    const rect = element.getBoundingClientRect();
    return {
      x: Math.max(0, rect.left),
      y: Math.max(0, rect.top),
      width: Math.min(window.innerWidth, rect.width),
      height: Math.min(window.innerHeight, rect.height),
    };
  });
  expect(bounds.width).toBeGreaterThanOrEqual(1000);
  expect(bounds.height).toBeGreaterThanOrEqual(700);

  const attachedPath = `${evidenceDirectory}/exact-kphx-live.png`;
  const attachedBytes = await captureCanvasClip(page, bounds, attachedPath);
  expect(attachedBytes).toBeGreaterThan(100000);

  await page.evaluate(() => {
    const ready = [...document.querySelectorAll('button')]
      .find(button => button.textContent?.trim() === 'Ready');
    if (!(ready instanceof HTMLButtonElement)) throw new Error('A1 Ready button missing');
    ready.click();
  });

  await page.waitForFunction(() => {
    const d = document.querySelector('canvas.trainerCanvas')?.dataset || {};
    const deployment = Number(d.a1JetwayDeployment);
    return d.a1JetwayState === 'autogate-disengaging'
      && Number.isFinite(deployment)
      && deployment <= 0.55
      && deployment >= 0.45;
  }, null, { timeout: 14000, polling: 50 });

  const midRuntime = await canvas.evaluate(element => ({ ...element.dataset }));
  expect(midRuntime.a1JetwaySupportTrianglePartitionExact).toBe('true');
  expect(Math.abs(Number(midRuntime.a1JetwaySupportBottomDeltaMeters))).toBeLessThanOrEqual(0.02);
  expect(Number(midRuntime.a1JetwayCabinJointGapMeters)).toBeLessThanOrEqual(0.08);
  expect(Number(midRuntime.a1JetwayFixedWallMotionMaxMeters)).toBeLessThanOrEqual(0.001);
  const midBytes = await captureCanvasClip(
    page,
    bounds,
    `${evidenceDirectory}/exact-kphx-mid-disengage.png`,
  );
  expect(midBytes).toBeGreaterThan(100000);

  await page.waitForFunction(() => {
    const d = document.querySelector('canvas.trainerCanvas')?.dataset || {};
    return d.a1JetwayState === 'parked-clear-of-aircraft'
      && Number(d.a1JetwayDeployment) <= 0.005;
  }, null, { timeout: 12000, polling: 50 });

  const parkedRuntime = await canvas.evaluate(element => ({ ...element.dataset }));
  expect(parkedRuntime.a1JetwaySupportTrianglePartitionExact).toBe('true');
  expect(Number(parkedRuntime.a1JetwayCabinJointGapMeters)).toBeLessThanOrEqual(0.08);
  expect(Math.abs(Number(parkedRuntime.a1JetwaySupportBottomDeltaMeters))).toBeLessThanOrEqual(0.02);
  const parkedBytes = await captureCanvasClip(
    page,
    bounds,
    `${evidenceDirectory}/exact-kphx-parked.png`,
  );
  expect(parkedBytes).toBeGreaterThan(100000);

  const report = {
    releaseSha: expectedSha,
    pageUrl,
    capturedAtUtc: new Date().toISOString(),
    runtime,
    midRuntime,
    parkedRuntime,
    screenshotBytes: {
      attached: attachedBytes,
      mid: midBytes,
      parked: parkedBytes,
    },
    consoleErrors,
    pageErrors,
    failedRequests,
  };
  fs.writeFileSync(`${evidenceDirectory}/report.json`, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({
    status: 'PASS',
    releaseSha: expectedSha,
    buildings: runtime.kphxExactLiveT4BuildingCount,
    jetways: runtime.kphxExactLiveT4JetwayCount,
    authoredOpenEdges: runtime.kphxExactLiveT4JetwayOpenEdgeCount,
    lektro: runtime.tugSource,
    pavementPolygons: runtime.kphxSurfacePolygonCount,
    a1MarkingMeshes: runtime.kphxA1ZdpMarkingLineMeshCount,
    oldAirportJetwayGlbUsed: runtime.kphxExactLiveOldAirportJetwayGlbUsed,
    supportBottomDeltaMid: midRuntime.a1JetwaySupportBottomDeltaMeters,
    supportBottomDeltaParked: parkedRuntime.a1JetwaySupportBottomDeltaMeters,
    sourcePoseMaxMatrixDeltaParked: parkedRuntime.a1JetwaySourcePoseMaxMatrixDelta,
    screenshotBytes: {
      attached: attachedBytes,
      mid: midBytes,
      parked: parkedBytes,
    },
  }, null, 2));
});


test('live RampReady serves exact manager Kubota free-drive inspection', async ({ page }) => {
  if (!pageUrl || !expectedSha) throw new Error('PAGE_URL and EXPECTED_SHA are required');

  await page.goto(`${pageUrl}?release=${expectedSha}&vehicle=manager-kubota`, {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });

  await page.getByRole('heading', { name: 'Choose RampReady equipment' }).waitFor({
    state: 'visible',
    timeout: 30000,
  });

  const kubota = page.getByRole('radio', { name: /Manager Kubota RTV/i });
  await kubota.click();
  const training = page.getByRole('button', { name: 'Start training' });
  const inspection = page.getByRole('button', { name: 'Drive vehicle / inspect airport' });
  expect(await training.isDisabled()).toBe(true);
  expect(await inspection.isDisabled()).toBe(false);
  await inspection.click();

  const canvas = page.locator('canvas.trainerCanvas');
  await expect(canvas).toBeVisible({ timeout: 30000 });
  await page.waitForFunction(() => {
    const d = document.querySelector('canvas.trainerCanvas')?.dataset || {};
    return d.tugSource === 'manager-kubota-exact'
      && d.rigProfile === 'manager-kubota-exact'
      && d.steeringMode === 'front'
      && d.rigWheelbaseMeters === '1.94'
      && d.rigFreeMaxSpeedMps === '9.2'
      && d.rigKinematicMaxSteerDegrees === '33.232'
      && d.tugModelForwardCorrectionDegrees === '0'
      && d.kphxExactLiveT4 === 'ready'
      && d.kphxSurfaceReady === 'true'
      && d.kphxA1ZdpMarkingsReady === 'true';
  }, null, { timeout: 180000 });

  const shell = page.locator('.rr-shell');
  expect(await shell.getAttribute('data-equipment-id')).toBe('manager-kubota');
  expect(await shell.getAttribute('data-inspection-mode')).toBe('active');
  await expect(page.locator('.rr-runtime-loading')).toHaveCount(0, { timeout: 30000 });

  const startZ = Number(await canvas.getAttribute('data-inspection-tug-z'));
  await page.keyboard.down('w');
  await page.waitForTimeout(1400);
  const movingState = await canvas.evaluate(element => ({ ...element.dataset }));
  await page.keyboard.up('w');
  const endZ = Number(movingState.inspectionTugZ);
  const movementMeters = Math.abs(endZ - startZ);
  expect(movementMeters).toBeGreaterThan(0.5);

  const runtime = await canvas.evaluate(element => ({ ...element.dataset }));
  await page.screenshot({
    path: `${evidenceDirectory}/exact-manager-kubota-live.png`,
    fullPage: true,
  });
  fs.writeFileSync(`${evidenceDirectory}/manager-kubota-report.json`, `${JSON.stringify({
    releaseSha: expectedSha,
    pageUrl,
    capturedAtUtc: new Date().toISOString(),
    inspectionOnly: true,
    movementMeters,
    runtime,
  }, null, 2)}\n`);

  console.log(JSON.stringify({
    status: 'PASS',
    releaseSha: expectedSha,
    managerKubota: runtime.tugSource,
    inspectionOnly: true,
    steeringMode: runtime.steeringMode,
    movementMeters,
  }, null, 2));
});
