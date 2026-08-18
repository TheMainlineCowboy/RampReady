import fs from 'node:fs';

const path = 'scripts/verify-terminal4-fleet-visual.cjs';
let source = fs.readFileSync(path, 'utf8');
const SERVICE_STAIR_AUTHORITY = 'exact-supplied-tunnel-c-service-stair-live-rendered-crj-clearance-v4';
const LAUNCH_NORMALIZATION_MARKER = 'terminal4-visual-current-inspection-launch-v1';

const keys = [
  'inspectionMode',
  'terminal4UploadedJetwayLoadState',
  'terminal4UploadedJetwayCount',
  'terminal4UploadedJetwayConnectorCount',
  'terminal4UploadedJetwayA1VisualAcceptanceAuthority',
  'terminal4UploadedJetwayA1AssemblyPartCount',
  'terminal4UploadedJetwayA1IsolatedNodeRotationCount',
  'terminal4UploadedJetwayBogieGroundClearanceMeters',
  'terminal4UploadedJetwayA1ServiceStairClearanceAuthority',
  'terminal4UploadedJetwayA1ServiceStairTriangleCount',
  'terminal4UploadedJetwayA1ServiceStairSwingDegrees',
  'terminal4UploadedJetwayA1ServiceStairBeforeFuselagePenetrationMeters',
  'terminal4UploadedJetwayA1ServiceStairFuselagePenetrationMeters',
  'terminal4UploadedJetwayA1ServiceStairOutboardClearanceMeters',
  'terminal4UploadedJetwayA1ServiceStairBoxSeparationMeters',
  'terminal4UploadedJetwayA1ServiceStairMeasuredFuselageBandPointCount',
  'terminal4UploadedJetwayA1ServiceStairFuselageMeshName',
  'terminal4UploadedJetwayA1ServiceStairServiceSideSign',
  'inspectionAircraftFixedSourceGateAuthority',
  'inspectionAircraftLiveVisibleContactAuthority',
  'a1JetwayDeployment',
  'a1JetwayState',
  'inspectionAircraftLiveVisibleCabWorldX',
  'inspectionAircraftLiveVisibleCabWorldY',
  'inspectionAircraftLiveVisibleCabWorldZ',
  'inspectionAircraftLiveVisibleDoorWorldX',
  'inspectionAircraftLiveVisibleDoorWorldY',
  'inspectionAircraftLiveVisibleDoorWorldZ',
  'inspectionAircraftLiveVisibleCabVertexCount',
  'inspectionAircraftLiveVisibleCabEndpointVertexCount',
  'inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters',
  'inspectionAircraftDoorVerticalErrorMeters',
  'inspectionAircraftCabDoorContactPlaneCovered',
  'inspectionAircraftCabDoorLaterallyCovered',
  'inspectionAircraftCabDoorVerticallyCovered',
  'inspectionAircraftCabDoorFacingVertexCount',
  'inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters',
  'inspectionAircraftCabDoorMinimumNormalMeters',
  'inspectionAircraftCabDoorMaximumNormalMeters',
  'inspectionAircraftCabDoorMinimumLateralMeters',
  'inspectionAircraftCabDoorMaximumLateralMeters',
  'inspectionAircraftCabDoorMinimumHeightMeters',
  'inspectionAircraftCabDoorMaximumHeightMeters',
  'inspectionAircraftJetwayAuthoredBogieGroundPreserved',
  'terminal4TerminalConnectedJetwayCount',
  'terminal4UploadedJetwayStaticOwnGateTargetAuthority',
  'terminal4UploadedJetwayStaticOwnGateTargetCount',
  'terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians',
  'terminal4UploadedJetwayStaticMaximumTerminalFacingDot',
];

const sliced = `await page.evaluate((keys) => { const element = document.querySelector('canvas.trainerCanvas'); if (!(element instanceof HTMLCanvasElement)) throw new Error('Three.js canvas is missing'); return Object.fromEntries(keys.map((key) => [key, element.dataset[key]])); }, ${JSON.stringify(keys)})`;

const fullDatasetTransferPatterns = [
  /await\s+page\.locator\(\s*['"]canvas\.trainerCanvas['"]\s*\)\.evaluate\(\s*\(?\s*element\s*\)?\s*=>\s*\(\s*\{\s*\.\.\.element\.dataset\s*\}\s*\)\s*\)/g,
  /await\s+canvas\.evaluate\(\s*\(?\s*element\s*\)?\s*=>\s*\(\s*\{\s*\.\.\.element\.dataset\s*\}\s*\)\s*\)/g,
];

let occurrences = 0;
for (const pattern of fullDatasetTransferPatterns) {
  source = source.replace(pattern, () => {
    occurrences += 1;
    return sliced;
  });
}

if (occurrences < 1) {
  throw new Error('Expected at least 1 full canvas dataset transfer, found 0');
}

const survivingFullDatasetTransfer = [
  /page\.locator\(\s*['"]canvas\.trainerCanvas['"]\s*\)\.evaluate\([^;]*\.\.\.element\.dataset/s,
  /canvas\.evaluate\([^;]*\.\.\.element\.dataset/s,
].find((pattern) => pattern.test(source));
if (survivingFullDatasetTransfer) {
  throw new Error(`A locator-based Terminal 4 full canvas dataset transfer survived bounded evidence preparation: ${survivingFullDatasetTransfer}`);
}

// Some legacy evidence-generation paths wait for the Three.js canvas before
// entering inspection mode. The current app does not mount that canvas until the
// user launches "Drive tug / inspect airport", so that ordering is a guaranteed
// timeout. Normalize the final generated verifier after every other preparer.
if (!source.includes(LAUNCH_NORMALIZATION_MARKER)) {
  const legacyPreCanvasWait = `  await page.waitForSelector('canvas.trainerCanvas', { state: 'visible', timeout: 60000 });`;
  if (source.includes(legacyPreCanvasWait)) {
    const currentLaunch = `  // ${LAUNCH_NORMALIZATION_MARKER}\n  const inspectionLaunch = page.getByRole('button', { name: 'Drive tug / inspect airport' });\n  await inspectionLaunch.waitFor({ state: 'visible', timeout: 30000 });\n  await inspectionLaunch.click();\n  await page.waitForSelector('canvas.trainerCanvas', { state: 'visible', timeout: 60000 });`;
    source = source.replace(legacyPreCanvasWait, currentLaunch);
    // Retire the old post-canvas button path if this generated variant has it.
    source = source.replace(
      `  const inspectionButton = page.getByRole('button', { name: 'Free-drive inspection' });\n  if (await inspectionButton.count()) await inspectionButton.click();\n`,
      '',
    );
  } else {
    const currentLaunchNeedle = `const inspectionLaunch = page.getByRole('button', { name: 'Drive tug / inspect airport' });`;
    if (!source.includes(currentLaunchNeedle)) {
      throw new Error('Terminal 4 visual verifier has neither current inspection launch nor recognized legacy pre-canvas launch');
    }
    source = source.replace(currentLaunchNeedle, `// ${LAUNCH_NORMALIZATION_MARKER}\n  ${currentLaunchNeedle}`);
  }
}

// Inspection mode normally owns A1's parked/retracted state. The photo evidence
// verifier needs the same controller held in its physically attached deployment
// long enough for the live Cab/door monitor and screenshots to observe one
// stable frame. Re-issue the existing evidence-only attach bridge on a bounded
// timer during A1 capture, then release it before representative fleet views.
const attachWaitAnchor = `  // Critical acceptance boundary: measure the actual visible CRJ door against\n  // the actual final Cab while A1 is physically in its attached deployment.`;
const directAttachAnchor = `  if (typeof (await page.evaluate(() => window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__)) === 'undefined') {`;
const persistentAttachBlock = `  await page.evaluate(() => {\n    const attach = window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__;\n    if (typeof attach !== 'function') throw new Error('A1 attached visual-evidence bridge is missing');\n    if (window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__) {\n      clearInterval(window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__);\n    }\n    const keepAttached = () => {\n      const state = attach();\n      if (state === 'not-ready') return false;\n      return true;\n    };\n    if (!keepAttached()) throw new Error('A1 attached visual-evidence bridge ran before the supplied jetway controller was ready');\n    window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__ = setInterval(keepAttached, 12);\n  });`;
if (!source.includes('__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__')) {
  if (source.includes(attachWaitAnchor)) {
    source = source.replace(attachWaitAnchor, `${persistentAttachBlock}\n\n${attachWaitAnchor}`);
  } else if (source.includes(directAttachAnchor)) {
    source = source.replace(directAttachAnchor, `${persistentAttachBlock}\n\n${directAttachAnchor}`);
  } else {
    throw new Error('A1 attached-evidence capture anchor is missing');
  }
}

// The old browser acceptance proved the Cab and bogie but never measured the
// visible service stair against the actual rendered CRJ. Require the live post-
// calibration solve and exact source-triangle count before any A1 screenshot.
const cabSurfaceAnchor = `  const cabDoorFacingVertexCount = finiteNumber(a1.inspectionAircraftCabDoorFacingVertexCount);`;
const legacyVerticalAnchor = `  const verticalError = finiteNumber(a1.inspectionAircraftDoorVerticalErrorMeters);`;
const serviceStairAcceptancePrefix = `  const serviceStairPenetration = finiteNumber(a1.terminal4UploadedJetwayA1ServiceStairFuselagePenetrationMeters);\n  const serviceStairSwingDegrees = finiteNumber(a1.terminal4UploadedJetwayA1ServiceStairSwingDegrees);\n  const serviceStairOutboardClearance = finiteNumber(a1.terminal4UploadedJetwayA1ServiceStairOutboardClearanceMeters);\n  if (a1.terminal4UploadedJetwayA1ServiceStairClearanceAuthority !== '${SERVICE_STAIR_AUTHORITY}') {\n    geometryFailures.push(\`A1 live service-stair authority is wrong: \${a1.terminal4UploadedJetwayA1ServiceStairClearanceAuthority}\`);\n  }\n  if (a1.terminal4UploadedJetwayA1ServiceStairTriangleCount !== '2352') {\n    geometryFailures.push(\`A1 exact service-stair triangle selection changed: \${a1.terminal4UploadedJetwayA1ServiceStairTriangleCount}\`);\n  }\n  if (serviceStairPenetration === null || serviceStairPenetration > 0.001) {\n    geometryFailures.push(\`A1 service stair penetrates the live rendered CRJ envelope: \${a1.terminal4UploadedJetwayA1ServiceStairFuselagePenetrationMeters} m\`);\n  }\n  if (serviceStairSwingDegrees === null || Math.abs(serviceStairSwingDegrees) > 88) {\n    geometryFailures.push(\`A1 service-stair swing is invalid: \${a1.terminal4UploadedJetwayA1ServiceStairSwingDegrees} deg\`);\n  }\n  if (serviceStairOutboardClearance === null || serviceStairOutboardClearance < -0.001) {\n    geometryFailures.push(\`A1 service stair has no outboard clearance: \${a1.terminal4UploadedJetwayA1ServiceStairOutboardClearanceMeters} m\`);\n  }`;
if (!source.includes(SERVICE_STAIR_AUTHORITY)) {
  if (source.includes(cabSurfaceAnchor)) {
    source = source.replace(cabSurfaceAnchor, `${serviceStairAcceptancePrefix}\n\n${cabSurfaceAnchor}`);
  } else if (source.includes(legacyVerticalAnchor)) {
    source = source.replace(legacyVerticalAnchor, `${serviceStairAcceptancePrefix}\n\n${legacyVerticalAnchor}`);
  } else {
    throw new Error('A1 service-stair visual acceptance anchor is missing');
  }
}

const fleetLoopAnchor = `  for (const [preset, label, filename, cameraView] of fleetViews) {`;
const releaseAttachBlock = `  await page.evaluate(() => {\n    if (window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__) {\n      clearInterval(window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__);\n      delete window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__;\n    }\n  });\n\n${fleetLoopAnchor}`;
if (!source.includes('delete window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__')) {
  if (!source.includes(fleetLoopAnchor)) throw new Error('Fleet-view release anchor is missing');
  source = source.replace(fleetLoopAnchor, releaseAttachBlock);
}

for (const required of [
  LAUNCH_NORMALIZATION_MARKER,
  "getByRole('button', { name: 'Drive tug / inspect airport' })",
  'inspectionMode',
  'terminal4UploadedJetwayLoadState',
  'terminal4UploadedJetwayCount',
  'terminal4UploadedJetwayConnectorCount',
  'inspectionAircraftCabDoorContactPlaneCovered',
  'inspectionAircraftCabDoorLaterallyCovered',
  'inspectionAircraftCabDoorVerticallyCovered',
  'inspectionAircraftCabDoorMinimumHeightMeters',
  'inspectionAircraftCabDoorMaximumHeightMeters',
  'terminal4UploadedJetwayA1ServiceStairClearanceAuthority',
  'terminal4UploadedJetwayA1ServiceStairFuselagePenetrationMeters',
  SERVICE_STAIR_AUTHORITY,
  '__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__',
  'setInterval(keepAttached, 12)',
  'delete window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__',
]) {
  if (!source.includes(required)) throw new Error(`Bounded Terminal 4 visual evidence is missing ${required}`);
}

const preCanvasIndex = source.indexOf("waitForSelector('canvas.trainerCanvas'");
const launchClickIndex = source.indexOf('await inspectionLaunch.click()');
if (preCanvasIndex >= 0 && (launchClickIndex < 0 || launchClickIndex > preCanvasIndex)) {
  throw new Error('Terminal 4 visual verifier still waits for the canvas before launching inspection mode');
}

fs.writeFileSync(path, source);
console.log(`Bounded every Terminal 4 visual dataset transfer to ${keys.length} readiness/acceptance fields across ${occurrences} direct page-context reads, restored the current inspection launch before any canvas wait, held A1 attached through capture, retained exact final Cab-surface telemetry, and made live exact service-stair/CRJ clearance a fail-closed visual gate.`);
