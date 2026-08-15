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

// The shipping A1 close cameras now stay on the apron half-plane. The fleet
// evidence runner used to wait forever for the retired v3/bisector handshake,
// even though the production camera had already published the stronger v4
// through-axis/apron-side telemetry. Migrate the harness itself so a terminal
// joint is accepted only when the rendered camera is on the apron side, was not
// mirrored, has no T4_WALK obstruction and keeps both branches visible. The
// bogie close-up must use its own apron-side profile and clearance as well.
if (!source.includes(apronCameraMarker)) {
  source = source
    .replace(
      `const CURRENT_SUBVIEW_AUTHORITY = 'source-measured-a1-terminal-joint-camera-v3';`,
      `// ${apronCameraMarker}\nconst CURRENT_SUBVIEW_AUTHORITY = '${apronSubviewAuthority}';`,
    )
    .replace(
      `const LEGACY_SUBVIEW_AUTHORITY = 'exact-a1-terminal-joint-and-bogie-contact-subviews-v2';`,
      `const LEGACY_SUBVIEW_AUTHORITY = 'source-measured-a1-terminal-joint-camera-v3';`,
    )
    .replace(
      `const LOCK_AUTHORITY = 'exact-a1-evidence-camera-direct-lock-v1';`,
      `const LOCK_AUTHORITY = 'exact-a1-evidence-camera-direct-lock-v1';\nconst TERMINAL_PROFILE_AUTHORITY = '${terminalProfileAuthority}';\nconst TERMINAL_CLEAR_SIDE_AUTHORITY = '${terminalClearSideAuthority}';\nconst BOGIE_PROFILE_AUTHORITY = '${bogieProfileAuthority}';\nconst MAX_BRANCH_VIEW_COSINE = 0.82;\nconst MAX_BRANCH_VIEW_IMBALANCE = 0.20;\nconst MIN_TERMINAL_APRON_HALF_PLANE_METERS = 2.5;\nconst MIN_BOGIE_APRON_HALF_PLANE_METERS = 1.5;`,
    );

  const oldSubviewWait = `  await page.waitForFunction(({ subview, currentAuthority, legacyAuthority, cameraAuthority, lockAuthority }) => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    return data?.inspectionCameraEndpointSubview === subview
      && [currentAuthority, legacyAuthority].includes(data?.inspectionCameraEndpointSubviewAuthority)
      && data?.inspectionCameraEndpointAuthority === cameraAuthority
      && data?.inspectionCameraEndpointLockAuthority === lockAuthority
      && Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) <= 0.001;
  }, {
    subview,
    currentAuthority: CURRENT_SUBVIEW_AUTHORITY,
    legacyAuthority: LEGACY_SUBVIEW_AUTHORITY,
    cameraAuthority: CAMERA_AUTHORITY,
    lockAuthority: LOCK_AUTHORITY,
  }, { timeout: 30000, polling: 100 });`;

  const apronSubviewWait = `  await page.waitForFunction(({ subview, currentAuthority, cameraAuthority, lockAuthority, terminalProfileAuthority, terminalClearSideAuthority, bogieProfileAuthority, maxBranchViewCosine, maxBranchViewImbalance, minTerminalApronOffset, minBogieApronOffset }) => {
    const data = document.querySelector('canvas.trainerCanvas')?.dataset;
    if (data?.inspectionCameraEndpointSubview !== subview
      || data?.inspectionCameraEndpointSubviewAuthority !== currentAuthority
      || data?.inspectionCameraEndpointAuthority !== cameraAuthority
      || data?.inspectionCameraEndpointLockAuthority !== lockAuthority
      || Math.abs(Number(data?.inspectionCameraEndpointConvergenceErrorMeters)) > 0.001) return false;
    if (subview === 'terminal-joint') {
      const wallView = Number(data?.inspectionCameraEndpointJointWallViewCosine);
      const tunnelView = Number(data?.inspectionCameraEndpointJointTunnelAViewCosine);
      const imbalance = Number(data?.inspectionCameraEndpointJointBranchViewImbalance);
      const apronOffset = Number(data?.inspectionCameraEndpointJointRenderedApronHalfPlaneOffsetMeters);
      return data?.inspectionCameraEndpointJointProfileAuthority === terminalProfileAuthority
        && data?.inspectionCameraEndpointJointClearSideAuthority === terminalClearSideAuthority
        && data?.inspectionCameraEndpointJointClearSideFlipped === 'false'
        && data?.inspectionCameraEndpointJointT4WalkOccluded === 'false'
        && Number.isFinite(apronOffset) && apronOffset > minTerminalApronOffset
        && Number.isFinite(wallView) && wallView < maxBranchViewCosine
        && Number.isFinite(tunnelView) && tunnelView < maxBranchViewCosine
        && Number.isFinite(imbalance) && imbalance < maxBranchViewImbalance;
    }
    if (subview === 'bogie-contact') {
      const apronOffset = Number(data?.inspectionCameraEndpointBogieApronHalfPlaneOffsetMeters);
      return data?.inspectionCameraEndpointBogieProfileAuthority === bogieProfileAuthority
        && Number.isFinite(apronOffset) && apronOffset > minBogieApronOffset;
    }
    return true;
  }, {
    subview,
    currentAuthority: CURRENT_SUBVIEW_AUTHORITY,
    cameraAuthority: CAMERA_AUTHORITY,
    lockAuthority: LOCK_AUTHORITY,
    terminalProfileAuthority: TERMINAL_PROFILE_AUTHORITY,
    terminalClearSideAuthority: TERMINAL_CLEAR_SIDE_AUTHORITY,
    bogieProfileAuthority: BOGIE_PROFILE_AUTHORITY,
    maxBranchViewCosine: MAX_BRANCH_VIEW_COSINE,
    maxBranchViewImbalance: MAX_BRANCH_VIEW_IMBALANCE,
    minTerminalApronOffset: MIN_TERMINAL_APRON_HALF_PLANE_METERS,
    minBogieApronOffset: MIN_BOGIE_APRON_HALF_PLANE_METERS,
  }, { timeout: 30000, polling: 100 });`;

  if (!source.includes(oldSubviewWait)) {
    throw new Error(`${verifierPath}: retired A1 subview handshake is missing; refusing to silently weaken visual evidence`);
  }
  source = source.replace(oldSubviewWait, apronSubviewWait);
}

for (const required of [
  marker,
  sourcePoseVisualMarker,
  apronCameraMarker,
  `const STATIC_OWN_GATE_AUTHORITY = '${sourcePoseAuthority}';`,
  `const CURRENT_SUBVIEW_AUTHORITY = '${apronSubviewAuthority}';`,
  `const TERMINAL_PROFILE_AUTHORITY = '${terminalProfileAuthority}';`,
  `const TERMINAL_CLEAR_SIDE_AUTHORITY = '${terminalClearSideAuthority}';`,
  `const BOGIE_PROFILE_AUTHORITY = '${bogieProfileAuthority}';`,
  "checkpoint('fleet-load-error'",
  "checkpoint('fleet-ready-timeout'",
  "consoleErrors=${JSON.stringify(consoleErrors.slice(-20))}",
  "Terminal 4 jetway fleet loader failed before visual readiness",
  "pageErrors.length > 0",
  "Static source-pose diagnostics are missing",
  "inspectionCameraEndpointJointClearSideFlipped === 'false'",
  "inspectionCameraEndpointJointRenderedApronHalfPlaneOffsetMeters",
  "inspectionCameraEndpointBogieApronHalfPlaneOffsetMeters",
]) {
  if (!source.includes(required)) throw new Error(`${verifierPath}: fail-fast/source-pose/apron-camera visual diagnostic is missing ${required}`);
}
for (const forbidden of [
  "57-static-own-gate-target-real-wall-compact-registration-v9",
  "maximumOwnGateHeadingError > MAXIMUM_STATIC_OWN_GATE_HEADING_ERROR_RADIANS",
  "maximumTerminalFacingDot > MAXIMUM_STATIC_TERMINAL_FACING_DOT",
  "exact-a1-terminal-joint-and-bogie-contact-subviews-v2",
]) {
  if (source.includes(forbidden)) throw new Error(`${verifierPath}: retired target-driven/camera visual acceptance survived: ${forbidden}`);
}

fs.writeFileSync(verifierPath, source, "utf8");
console.log("Prepared Terminal 4 visual evidence to fail immediately with the actual browser loader error, validate the 57 static bridges under decoded KPHX source-pose authority, and require the current apron-side A1 terminal/bogie camera telemetry before any screenshot is accepted.");