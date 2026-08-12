import fs from "node:fs";

const verifierPath = "scripts/verify-terminal4-fleet-visual.cjs";
const marker = "terminal4-jetway-load-failfast-v1";
let source = fs.readFileSync(verifierPath, "utf8");

if (!source.includes(marker)) {
  const oldWait = `  await page.waitForFunction(() => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    return data?.inspectionMode === 'active'
      && data?.terminal4UploadedJetwayLoadState === 'ready'
      && data?.terminal4UploadedJetwayCount === '58'
      && data?.terminal4UploadedJetwayConnectorCount === '58';
  }, null, { timeout: 180000, polling: 100 });
  checkpoint('fleet-ready');`;

  const failFastWait = `  // ${marker}
  // Do not burn the full readiness timeout after the loader has already failed.
  // Poll from Node so page errors and console errors can terminate the run with
  // the exact dataset that caused the visual scene to stop becoming ready.
  const fleetReadyDeadline = Date.now() + 180000;
  let fleetReadyDataset = null;
  while (Date.now() < fleetReadyDeadline) {
    const canvas = page.locator('canvas.trainerCanvas');
    if (await canvas.count()) {
      const data = await canvas.evaluate((element) => ({ ...element.dataset }));
      const loadState = String(data.terminal4UploadedJetwayLoadState || '');
      const isReady = data.inspectionMode === 'active'
        && loadState === 'ready'
        && data.terminal4UploadedJetwayCount === '58'
        && data.terminal4UploadedJetwayConnectorCount === '58';
      if (isReady) {
        fleetReadyDataset = data;
        break;
      }
      if (/error|failed|failure/i.test(loadState) || pageErrors.length > 0) {
        checkpoint('fleet-load-error', {
          loadState,
          dataset: data,
          pageErrors,
          consoleErrors: consoleErrors.slice(-20),
          failedRequests: failedRequests.slice(-20),
        });
        throw new Error(\`Terminal 4 jetway fleet loader failed before visual readiness: state=\${loadState || 'unset'}; pageErrors=\${JSON.stringify(pageErrors)}; dataset=\${JSON.stringify(data)}\`);
      }
    }
    await page.waitForTimeout(250);
  }
  if (!fleetReadyDataset) {
    const data = await page.locator('canvas.trainerCanvas').count()
      ? await page.locator('canvas.trainerCanvas').evaluate((element) => ({ ...element.dataset }))
      : {};
    checkpoint('fleet-ready-timeout', {
      dataset: data,
      pageErrors,
      consoleErrors: consoleErrors.slice(-20),
      failedRequests: failedRequests.slice(-20),
    });
    throw new Error(\`Terminal 4 jetway fleet did not become ready in 180000 ms: pageErrors=\${JSON.stringify(pageErrors)}; consoleErrors=\${JSON.stringify(consoleErrors.slice(-20))}; dataset=\${JSON.stringify(data)}\`);
  }
  checkpoint('fleet-ready', {
    loadState: fleetReadyDataset.terminal4UploadedJetwayLoadState,
    selectedA1Material: fleetReadyDataset.terminal4UploadedJetwayA1SelectedMaterialReference || null,
  });`;

  if (!source.includes(oldWait)) {
    throw new Error(`${verifierPath}: fleet-ready wait anchor is missing; refusing to patch an unknown verifier`);
  }
  source = source.replace(oldWait, failFastWait);
}

for (const required of [
  marker,
  "checkpoint('fleet-load-error'",
  "checkpoint('fleet-ready-timeout'",
  "Terminal 4 jetway fleet loader failed before visual readiness",
  "pageErrors.length > 0",
]) {
  if (!source.includes(required)) throw new Error(`${verifierPath}: fail-fast visual diagnostic is missing ${required}`);
}

fs.writeFileSync(verifierPath, source, "utf8");
console.log("Prepared Terminal 4 visual verifier to fail immediately on loader/page errors with the full canvas dataset instead of silently waiting three minutes.");
