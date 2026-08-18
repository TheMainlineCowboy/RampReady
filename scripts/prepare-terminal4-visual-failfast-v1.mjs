import fs from "node:fs";

const verifierPath = "scripts/verify-terminal4-fleet-visual.cjs";
const marker = "terminal4-jetway-load-failfast-v1";
const sourcePoseVisualMarker = "terminal4-static-source-pose-visual-acceptance-v1";
const sourcePoseAuthority = "57-static-bgl-source-pose-real-wall-registration-v10";
const apronCameraMarker = "terminal4-a1-apron-side-subview-acceptance-v1";
const apronSubviewAuthority = "source-measured-a1-apron-side-evidence-camera-v4";
const terminalProfileAuthority = "rotunda-terminal-and-tunnel-a-through-axis-normal-profile-v5-midheight";
const terminalClearSideAuthority = "a1-terminal-joint-apron-half-plane-unoccluded-v3";
const bogieProfileAuthority = "a1-tunnel-c-bogie-apron-half-plane-side-profile-v2";
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

  if (source.includes(oldWait)) {
    source = source.replace(oldWait, failFastWait);
  } else {
    // The evidence runner may already use the newer direct inspection activation
    // path. Keep that activation, but insert the same fail-fast 58-jetway readiness
    // boundary immediately after inspection mode becomes active.
    const directActiveWait = `  await page.waitForFunction(() => document.querySelector('canvas.trainerCanvas')?.dataset?.inspectionMode === 'active', null, { timeout: 30000, polling: 100 });`;
    if (!source.includes(directActiveWait)) {
      throw new Error(`${verifierPath}: fleet-ready wait anchor is missing; refusing to patch an unknown verifier`);
    }
    source = source.replace(directActiveWait, `${directActiveWait}\n${failFastWait}`);
  }
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

// The shipping A1 close cameras now stay on the apron half-plane. The fleet
// evidence runner used to wait forever for the retired v3/bisector handshake,
// even though the production camera had already published the stronger v4
// through-axis/apron-side telemetry. Migrate the harness itself so a terminal
// joint is accepted only when the rendered camera is on the apron side, was not
// mirrored, has no T4_WALK obstruction and keeps both branches visible. The
// bogie close-up must use its own apron-side profile and clearance as well.
if (!source.includes(apronCameraMarker)) {
  source = source.replace(
    `const CURRENT_SUBVIEW_AUTHORITY = 'source-measured-a1-terminal-joint-camera-v3';`,
    `// ${apronCameraMarker}\nconst CURRENT_SUBVIEW_AUTHORITY = '${apronSubviewAuthority}';`,
  );

  const oldSubviewReady = `    return data?.inspectionCameraEndpointSubview === subview
      && [currentAuthority, legacyAuthority].includes(data?.inspectionCameraEndpointSubviewAuthority)
      && data?.inspectionCameraEndpointAuthority === cameraAuthority
      && data?.inspectionCameraEndpointLockAuthority === lockAuthority
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;`;
  const apronSubviewReady = `    const shared = data?.inspectionCameraEndpointSubview === subview
      && [currentAuthority, legacyAuthority].includes(data?.inspectionCameraEndpointSubviewAuthority)
      && data?.inspectionCameraEndpointAuthority === cameraAuthority
      && data?.inspectionCameraEndpointLockAuthority === lockAuthority
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;
    if (!shared) return false;
    if (subview === 'terminal-joint') {
      return data?.inspectionCameraEndpointTerminalProfileAuthority === '${terminalProfileAuthority}'
        && data?.inspectionCameraTerminalClearSideAuthority === '${terminalClearSideAuthority}'
        && data?.inspectionCameraTerminalMirroredToApron === 'false'
        && data?.inspectionCameraEndpointTerminalWalkClear === 'true'
        && Number(data?.inspectionCameraEndpointTerminalPerpendicularDot) <= 0.35;
    }
    if (subview === 'bogie-contact') {
      return data?.inspectionCameraBogieProfileAuthority === '${bogieProfileAuthority}'
        && data?.inspectionCameraBogieMirroredToApron === 'false'
        && Number(data?.inspectionCameraBogieContactClearanceMeters) <= 0.02;
    }
    return true;`;
  if (!source.includes(oldSubviewReady)) {
    throw new Error(`${verifierPath}: A1 close-subview readiness anchor changed`);
  }
  source = source.replace(oldSubviewReady, apronSubviewReady);
}

for (const required of [marker, sourcePoseVisualMarker, apronCameraMarker, sourcePoseAuthority, apronSubviewAuthority]) {
  if (!source.includes(required)) throw new Error(`${verifierPath}: visual fail-fast migration is missing ${required}`);
}

fs.writeFileSync(verifierPath, source, "utf8");
console.log(`Prepared ${marker} + ${sourcePoseVisualMarker} + ${apronCameraMarker}: visual evidence fails fast on loader errors, judges the static fleet under final source-pose authority, and accepts A1 close cameras only on the clear apron half-plane.`);
