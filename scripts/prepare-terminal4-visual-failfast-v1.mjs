import fs from "node:fs";

const verifierPath = "scripts/verify-terminal4-fleet-visual.cjs";
const marker = "terminal4-jetway-load-failfast-v1";
const sourcePoseVisualMarker = "terminal4-static-source-pose-visual-acceptance-v1";
const sourcePoseAuthority = "57-static-bgl-source-pose-real-wall-registration-v10";
const apronCameraMarker = "terminal4-a1-apron-side-subview-acceptance-v2-live-fields";
const apronSubviewAuthority = "source-measured-a1-apron-side-evidence-camera-v5-balanced-branches";
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
    const directActiveWait = `  await page.waitForFunction(() => document.querySelector('canvas.trainerCanvas')?.dataset?.inspectionMode === 'active', null, { timeout: 30000, polling: 100 });`;
    if (!source.includes(directActiveWait)) throw new Error(`${verifierPath}: fleet-ready wait anchor is missing; refusing to patch an unknown verifier`);
    source = source.replace(directActiveWait, `${directActiveWait}\n${failFastWait}`);
  }
}

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
  const maximumOwnGateHeadingError = finiteNumber(a1.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians);
  const maximumTerminalFacingDot = finiteNumber(a1.terminal4UploadedJetwayStaticMaximumTerminalFacingDot);
  if (maximumOwnGateHeadingError === null || maximumTerminalFacingDot === null) {
    geometryFailures.push(\`Static source-pose diagnostics are missing: heading=\${a1.terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians} terminalDot=\${a1.terminal4UploadedJetwayStaticMaximumTerminalFacingDot}\`);
  }`;
  if (!source.includes(oldHeadingChecks)) throw new Error(`${verifierPath}: retired static target-heading visual checks are missing`);
  source = source.replace(oldHeadingChecks, sourcePoseChecks);
}

if (!source.includes(apronCameraMarker)) {
  source = source.replace(
    /(?:\/\/ terminal4-a1-apron-side-subview-acceptance-v1\n)?const CURRENT_SUBVIEW_AUTHORITY = '[^']+';/,
    `// ${apronCameraMarker}\nconst CURRENT_SUBVIEW_AUTHORITY = '${apronSubviewAuthority}';`,
  );

  const originalSimple = `    return data?.inspectionCameraEndpointSubview === subview
      && [currentAuthority, legacyAuthority].includes(data?.inspectionCameraEndpointSubviewAuthority)
      && data?.inspectionCameraEndpointAuthority === cameraAuthority
      && data?.inspectionCameraEndpointLockAuthority === lockAuthority
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;`;
  const liveSubviewReady = `    const shared = data?.inspectionCameraEndpointSubview === subview
      && [currentAuthority, legacyAuthority].includes(data?.inspectionCameraEndpointSubviewAuthority)
      && data?.inspectionCameraEndpointAuthority === cameraAuthority
      && data?.inspectionCameraEndpointLockAuthority === lockAuthority
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;
    if (!shared) return false;
    if (subview === 'terminal-joint') {
      const apronOffset = Number(data?.inspectionCameraEndpointJointRenderedApronHalfPlaneOffsetMeters);
      const branchImbalance = Number(data?.inspectionCameraEndpointJointBranchViewImbalance);
      return data?.inspectionCameraEndpointJointProfileAuthority === '${terminalProfileAuthority}'
        && data?.inspectionCameraEndpointJointClearSideAuthority === '${terminalClearSideAuthority}'
        && data?.inspectionCameraEndpointJointT4WalkOccluded === 'false'
        && Number.isFinite(apronOffset) && apronOffset > 0.05
        && Number.isFinite(branchImbalance) && branchImbalance < 0.20;
    }
    if (subview === 'bogie-contact') {
      const bogieApronOffset = Number(data?.inspectionCameraEndpointBogieApronHalfPlaneOffsetMeters);
      const bogieClearance = Number(data?.terminal4UploadedJetwayBogieGroundClearanceMeters);
      return data?.inspectionCameraEndpointBogieProfileAuthority === '${bogieProfileAuthority}'
        && Number.isFinite(bogieApronOffset) && bogieApronOffset > 0.05
        && Number.isFinite(bogieClearance) && Math.abs(bogieClearance) <= 0.02;
    }
    return true;`;

  if (source.includes(originalSimple)) {
    source = source.replace(originalSimple, liveSubviewReady);
  } else {
    const existingV1Start = `    const shared = data?.inspectionCameraEndpointSubview === subview`;
    const start = source.indexOf(existingV1Start);
    if (start < 0) throw new Error(`${verifierPath}: A1 close-subview readiness anchor changed`);
    const endNeedle = `    return true;`;
    const end = source.indexOf(endNeedle, start);
    if (end < 0) throw new Error(`${verifierPath}: A1 close-subview readiness end anchor changed`);
    source = source.slice(0, start) + liveSubviewReady + source.slice(end + endNeedle.length);
  }
}

for (const required of [
  marker, sourcePoseVisualMarker, apronCameraMarker, sourcePoseAuthority, apronSubviewAuthority,
  `checkpoint('fleet-ready', {\n    loadState: fleetReadyDataset.terminal4UploadedJetwayLoadState,`,
  'inspectionCameraEndpointJointProfileAuthority', 'inspectionCameraEndpointJointClearSideAuthority',
  'inspectionCameraEndpointJointT4WalkOccluded', 'inspectionCameraEndpointJointRenderedApronHalfPlaneOffsetMeters',
  'inspectionCameraEndpointJointBranchViewImbalance', 'inspectionCameraEndpointBogieProfileAuthority',
  'inspectionCameraEndpointBogieApronHalfPlaneOffsetMeters',
]) {
  if (!source.includes(required)) throw new Error(`${verifierPath}: visual fail-fast migration is missing ${required}`);
}
for (const stale of [
  'inspectionCameraEndpointTerminalProfileAuthority', 'inspectionCameraTerminalClearSideAuthority',
  'inspectionCameraTerminalMirroredToApron', 'inspectionCameraEndpointTerminalWalkClear',
  'inspectionCameraBogieProfileAuthority', 'inspectionCameraBogieMirroredToApron',
  'inspectionCameraBogieContactClearanceMeters',
]) {
  if (source.includes(stale)) throw new Error(`${verifierPath}: stale A1 subview telemetry alias remains: ${stale}`);
}

fs.writeFileSync(verifierPath, source, "utf8");
console.log(`Prepared ${marker} + ${sourcePoseVisualMarker} + ${apronCameraMarker}: visual evidence fails fast on loader errors, preserves the fleet-first checkpoint contract, judges the static fleet under final source-pose authority, and accepts A1 close cameras only from the live v5 apron-side browser telemetry.`);
