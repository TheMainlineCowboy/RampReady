import fs from "node:fs";

const verifierPath = "scripts/verify-terminal4-fleet-visual.cjs";
const marker = "terminal4-jetway-load-failfast-v1";
const sourcePoseVisualMarker = "terminal4-static-source-pose-visual-acceptance-v1";
const sourcePoseAuthority = "57-static-bgl-source-pose-real-wall-registration-v10";
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
        throw new Error(\`Terminal 4 jetway fleet loader failed before visual readiness: state=\${loadState || 'unset'}; pageErrors=\${JSON.stringify(pageErrors)}; consoleErrors=\${JSON.stringify(consoleErrors.slice(-20))}; failedRequests=\${JSON.stringify(failedRequests.slice(-20))}; dataset=\${JSON.stringify(data)}\`);
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

// The static fleet now keeps the KPHX BGL pivot and heading. Do not let the
// visual evidence runner resurrect the retired rule that rotated every bridge
// toward a training-aircraft target. The production registration itself hard-
// fails if any rigid parent escapes sourceYaw; this visual pass should judge the
// rendered fleet and source-pose authority rather than CRJ-target coincidence.
if (!source.includes(sourcePoseVisualMarker)) {
  source = source.replace(
    `const STATIC_OWN_GATE_AUTHORITY = '57-static-own-gate-target-real-wall-compact-registration-v9';`,
    `// ${sourcePoseVisualMarker}\nconst STATIC_OWN_GATE_AUTHORITY = '${sourcePoseAuthority}';`,
  );

  const oldHeadingChecks = `  const maximumOwnGateHeadingError = finiteNumber(a1.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians);
  if (maximumOwnGateHeadingError === null
    || maximumOwnGateHeadingError > MAXIMUM_STATIC_OWN_GATE_HEADING_ERROR_RADIANS) {
    geometryFailures.push(\`Static maximum own-gate heading error is invalid: \${a1.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians}\`);
  }
  const maximumTerminalFacingDot = finiteNumber(a1.terminal4UploadedJetwayStaticMaximumTerminalFacingDot);
  if (maximumTerminalFacingDot === null || maximumTerminalFacingDot > MAXIMUM_STATIC_TERMINAL_FACING_DOT) {
    geometryFailures.push(\`Static fleet contains a bridge aimed back toward the terminal: max dot=\${a1.terminal4UploadedJetwayStaticMaximumTerminalFacingDot}\`);
  }`;
  const sourcePoseChecks = `  // ${sourcePoseVisualMarker}
  // Own-gate CRJ heading error and the old target-derived terminal-facing dot
  // are diagnostics only under source-pose ownership. Crossing/attachment is
  // judged from the screenshots and a dedicated fleet intersection guard.
  const maximumOwnGateHeadingError = finiteNumber(a1.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians);
  const maximumTerminalFacingDot = finiteNumber(a1.terminal4UploadedJetwayStaticMaximumTerminalFacingDot);
  if (maximumOwnGateHeadingError === null || maximumTerminalFacingDot === null) {
    geometryFailures.push(\`Static source-pose diagnostics are missing: heading=\${a1.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians} terminalDot=\${a1.terminal4UploadedJetwayStaticMaximumTerminalFacingDot}\`);
  }`;
  if (!source.includes(oldHeadingChecks)) {
    throw new Error(`${verifierPath}: retired static target-heading visual checks are missing`);
  }
  source = source.replace(oldHeadingChecks, sourcePoseChecks);
}

for (const required of [
  marker,
  sourcePoseVisualMarker,
  `const STATIC_OWN_GATE_AUTHORITY = '${sourcePoseAuthority}';`,
  "checkpoint('fleet-load-error'",
  "checkpoint('fleet-ready-timeout'",
  "consoleErrors=${JSON.stringify(consoleErrors.slice(-20))}",
  "Terminal 4 jetway fleet loader failed before visual readiness",
  "pageErrors.length > 0",
  "Static source-pose diagnostics are missing",
]) {
  if (!source.includes(required)) throw new Error(`${verifierPath}: fail-fast/source-pose visual diagnostic is missing ${required}`);
}
for (const forbidden of [
  "57-static-own-gate-target-real-wall-compact-registration-v9",
  "maximumOwnGateHeadingError > MAXIMUM_STATIC_OWN_GATE_HEADING_ERROR_RADIANS",
  "maximumTerminalFacingDot > MAXIMUM_STATIC_TERMINAL_FACING_DOT",
]) {
  if (source.includes(forbidden)) throw new Error(`${verifierPath}: retired target-driven visual acceptance survived: ${forbidden}`);
}

fs.writeFileSync(verifierPath, source, "utf8");
console.log("Prepared Terminal 4 visual evidence to fail immediately with the actual browser loader error and to validate the 57 static bridges under decoded KPHX source-pose authority instead of retired CRJ-target heading ownership.");