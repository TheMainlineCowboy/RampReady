import fs from 'node:fs';

const path = 'scripts/verify-terminal4-fleet-visual.cjs';
let source = fs.readFileSync(path, 'utf8');
const SERVICE_STAIR_AUTHORITY = 'exact-supplied-tunnel-c-service-stair-live-rendered-crj-clearance-v4';
const LAUNCH_NORMALIZATION_MARKER = 'terminal4-visual-current-inspection-launch-v1';
const ATTACH_PROBE_MARKER = 'terminal4-visual-serializable-a1-attach-probe-v1';

const keys = [
  'inspectionMode', 'terminal4UploadedJetwayLoadState', 'terminal4UploadedJetwayCount',
  'terminal4UploadedJetwayConnectorCount', 'terminal4UploadedJetwayA1VisualAcceptanceAuthority',
  'terminal4UploadedJetwayA1AssemblyPartCount', 'terminal4UploadedJetwayA1IsolatedNodeRotationCount',
  'terminal4UploadedJetwayBogieGroundClearanceMeters', 'terminal4UploadedJetwayA1ServiceStairClearanceAuthority',
  'terminal4UploadedJetwayA1ServiceStairTriangleCount', 'terminal4UploadedJetwayA1ServiceStairSwingDegrees',
  'terminal4UploadedJetwayA1ServiceStairBeforeFuselagePenetrationMeters',
  'terminal4UploadedJetwayA1ServiceStairFuselagePenetrationMeters',
  'terminal4UploadedJetwayA1ServiceStairOutboardClearanceMeters',
  'terminal4UploadedJetwayA1ServiceStairBoxSeparationMeters',
  'terminal4UploadedJetwayA1ServiceStairMeasuredFuselageBandPointCount',
  'terminal4UploadedJetwayA1ServiceStairFuselageMeshName', 'terminal4UploadedJetwayA1ServiceStairServiceSideSign',
  'inspectionAircraftFixedSourceGateAuthority', 'inspectionAircraftLiveVisibleContactAuthority',
  'a1JetwayDeployment', 'a1JetwayState', 'inspectionAircraftLiveVisibleCabWorldX',
  'inspectionAircraftLiveVisibleCabWorldY', 'inspectionAircraftLiveVisibleCabWorldZ',
  'inspectionAircraftLiveVisibleDoorWorldX', 'inspectionAircraftLiveVisibleDoorWorldY',
  'inspectionAircraftLiveVisibleDoorWorldZ', 'inspectionAircraftLiveVisibleCabVertexCount',
  'inspectionAircraftLiveVisibleCabEndpointVertexCount', 'inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters',
  'inspectionAircraftDoorVerticalErrorMeters', 'inspectionAircraftCabDoorContactPlaneCovered',
  'inspectionAircraftCabDoorLaterallyCovered', 'inspectionAircraftCabDoorVerticallyCovered',
  'inspectionAircraftCabDoorFacingVertexCount', 'inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters',
  'inspectionAircraftCabDoorMinimumNormalMeters', 'inspectionAircraftCabDoorMaximumNormalMeters',
  'inspectionAircraftCabDoorMinimumLateralMeters', 'inspectionAircraftCabDoorMaximumLateralMeters',
  'inspectionAircraftCabDoorMinimumHeightMeters', 'inspectionAircraftCabDoorMaximumHeightMeters',
  'inspectionAircraftJetwayAuthoredBogieGroundPreserved', 'terminal4TerminalConnectedJetwayCount',
  'terminal4UploadedJetwayStaticOwnGateTargetAuthority', 'terminal4UploadedJetwayStaticOwnGateTargetCount',
  'terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians', 'terminal4UploadedJetwayStaticMaximumTerminalFacingDot',
];

const sliced = `await page.evaluate((keys) => { const element = document.querySelector('canvas.trainerCanvas'); if (!(element instanceof HTMLCanvasElement)) throw new Error('Three.js canvas is missing'); return Object.fromEntries(keys.map((key) => [key, element.dataset[key]])); }, ${JSON.stringify(keys)})`;
const fullDatasetTransferPatterns = [
  /await\s+page\.locator\(\s*['"]canvas\.trainerCanvas['"]\s*\)\.evaluate\(\s*\(?\s*element\s*\)?\s*=>\s*\(\s*\{\s*\.\.\.element\.dataset\s*\}\s*\)\s*\)/g,
  /await\s+canvas\.evaluate\(\s*\(?\s*element\s*\)?\s*=>\s*\(\s*\{\s*\.\.\.element\.dataset\s*\}\s*\)\s*\)/g,
];
let occurrences = 0;
for (const pattern of fullDatasetTransferPatterns) {
  source = source.replace(pattern, () => { occurrences += 1; return sliced; });
}
if (occurrences < 1) throw new Error('Expected at least 1 full canvas dataset transfer, found 0');
const survivingFullDatasetTransfer = [
  /page\.locator\(\s*['"]canvas\.trainerCanvas['"]\s*\)\.evaluate\([^;]*\.\.\.element\.dataset/s,
  /canvas\.evaluate\([^;]*\.\.\.element\.dataset/s,
].find((pattern) => pattern.test(source));
if (survivingFullDatasetTransfer) throw new Error(`A locator-based Terminal 4 full canvas dataset transfer survived bounded evidence preparation: ${survivingFullDatasetTransfer}`);

// The current app mounts the Three.js canvas only after this launcher is used.
if (!source.includes(LAUNCH_NORMALIZATION_MARKER)) {
  const legacyPreCanvasWait = `  await page.waitForSelector('canvas.trainerCanvas', { state: 'visible', timeout: 60000 });`;
  if (source.includes(legacyPreCanvasWait)) {
    source = source.replace(legacyPreCanvasWait, `  // ${LAUNCH_NORMALIZATION_MARKER}\n  const inspectionLaunch = page.getByRole('button', { name: 'Drive tug / inspect airport' });\n  await inspectionLaunch.waitFor({ state: 'visible', timeout: 30000 });\n  await inspectionLaunch.click();\n  await page.waitForSelector('canvas.trainerCanvas', { state: 'visible', timeout: 60000 });`);
    source = source.replace(`  const inspectionButton = page.getByRole('button', { name: 'Free-drive inspection' });\n  if (await inspectionButton.count()) await inspectionButton.click();\n`, '');
  } else {
    const currentLaunchNeedle = `const inspectionLaunch = page.getByRole('button', { name: 'Drive tug / inspect airport' });`;
    if (!source.includes(currentLaunchNeedle)) throw new Error('Terminal 4 visual verifier has neither current inspection launch nor recognized legacy pre-canvas launch');
    source = source.replace(currentLaunchNeedle, `// ${LAUNCH_NORMALIZATION_MARKER}\n  ${currentLaunchNeedle}`);
  }
}

// Playwright cannot serialize a function returned from page.evaluate. The old
// probe therefore reported undefined even when the bridge existed and had just
// been called successfully. Return a boolean from browser context instead.
const unserializableProbe = `  if (typeof (await page.evaluate(() => window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__)) === 'undefined') {\n    throw new Error('A1 attached visual-evidence bridge is missing');\n  }`;
const serializableProbe = `  // ${ATTACH_PROBE_MARKER}\n  const hasA1AttachBridge = await page.evaluate(() => typeof window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__ === 'function');\n  if (!hasA1AttachBridge) {\n    throw new Error('A1 attached visual-evidence bridge is missing');\n  }`;
if (source.includes(unserializableProbe)) source = source.replace(unserializableProbe, serializableProbe);
else if (!source.includes(ATTACH_PROBE_MARKER) && source.includes("window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__")) {
  // No legacy probe is required in verifier variants that call the function
  // directly. Mark the final source after proving the callable token is present.
  source = source.replace(
    `  const attachedEvidenceState = await page.evaluate(() => {`,
    `  // ${ATTACH_PROBE_MARKER}\n  const attachedEvidenceState = await page.evaluate(() => {`,
  );
}

const attachWaitAnchor = `  // Critical acceptance boundary: measure the actual visible CRJ door against\n  // the actual final Cab while A1 is physically in its attached deployment.`;
const directAttachAnchor = source.includes(serializableProbe)
  ? `  // ${ATTACH_PROBE_MARKER}`
  : `  const attachedEvidenceState = await page.evaluate(() => {`;
const persistentAttachBlock = `  await page.evaluate(() => {\n    const attach = window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__;\n    if (typeof attach !== 'function') throw new Error('A1 attached visual-evidence bridge is missing');\n    if (window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__) clearInterval(window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__);\n    const keepAttached = () => { const state = attach(); return state !== 'not-ready'; };\n    if (!keepAttached()) throw new Error('A1 attached visual-evidence bridge ran before the supplied jetway controller was ready');\n    window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__ = setInterval(keepAttached, 12);\n  });`;
if (!source.includes('__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__')) {
  if (source.includes(attachWaitAnchor)) source = source.replace(attachWaitAnchor, `${persistentAttachBlock}\n\n${attachWaitAnchor}`);
  else if (source.includes(directAttachAnchor)) source = source.replace(directAttachAnchor, `${persistentAttachBlock}\n\n${directAttachAnchor}`);
  else throw new Error('A1 attached-evidence capture anchor is missing');
}

const cabSurfaceAnchor = `  const cabDoorFacingVertexCount = finiteNumber(a1.inspectionAircraftCabDoorFacingVertexCount);`;
const legacyVerticalAnchor = `  const verticalError = finiteNumber(a1.inspectionAircraftDoorVerticalErrorMeters);`;
const serviceStairAcceptancePrefix = `  const serviceStairPenetration = finiteNumber(a1.terminal4UploadedJetwayA1ServiceStairFuselagePenetrationMeters);\n  const serviceStairSwingDegrees = finiteNumber(a1.terminal4UploadedJetwayA1ServiceStairSwingDegrees);\n  const serviceStairOutboardClearance = finiteNumber(a1.terminal4UploadedJetwayA1ServiceStairOutboardClearanceMeters);\n  if (a1.terminal4UploadedJetwayA1ServiceStairClearanceAuthority !== '${SERVICE_STAIR_AUTHORITY}') geometryFailures.push(\`A1 live service-stair authority is wrong: \${a1.terminal4UploadedJetwayA1ServiceStairClearanceAuthority}\`);\n  if (a1.terminal4UploadedJetwayA1ServiceStairTriangleCount !== '2352') geometryFailures.push(\`A1 exact service-stair triangle selection changed: \${a1.terminal4UploadedJetwayA1ServiceStairTriangleCount}\`);\n  if (serviceStairPenetration === null || serviceStairPenetration > 0.001) geometryFailures.push(\`A1 service stair penetrates the live rendered CRJ envelope: \${a1.terminal4UploadedJetwayA1ServiceStairFuselagePenetrationMeters} m\`);\n  if (serviceStairSwingDegrees === null || Math.abs(serviceStairSwingDegrees) > 88) geometryFailures.push(\`A1 service-stair swing is invalid: \${a1.terminal4UploadedJetwayA1ServiceStairSwingDegrees} deg\`);\n  if (serviceStairOutboardClearance === null || serviceStairOutboardClearance < -0.001) geometryFailures.push(\`A1 service stair has no outboard clearance: \${a1.terminal4UploadedJetwayA1ServiceStairOutboardClearanceMeters} m\`);`;
if (!source.includes(SERVICE_STAIR_AUTHORITY)) {
  if (source.includes(cabSurfaceAnchor)) source = source.replace(cabSurfaceAnchor, `${serviceStairAcceptancePrefix}\n\n${cabSurfaceAnchor}`);
  else if (source.includes(legacyVerticalAnchor)) source = source.replace(legacyVerticalAnchor, `${serviceStairAcceptancePrefix}\n\n${legacyVerticalAnchor}`);
  else throw new Error('A1 service-stair visual acceptance anchor is missing');
}

const fleetLoopAnchor = `  for (const [preset, label, filename, cameraView] of fleetViews) {`;
if (!source.includes('delete window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__')) {
  if (!source.includes(fleetLoopAnchor)) throw new Error('Fleet-view release anchor is missing');
  source = source.replace(fleetLoopAnchor, `  await page.evaluate(() => {\n    if (window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__) {\n      clearInterval(window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__);\n      delete window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__;\n    }\n  });\n\n${fleetLoopAnchor}`);
}

for (const required of [
  LAUNCH_NORMALIZATION_MARKER, ATTACH_PROBE_MARKER,
  "getByRole('button', { name: 'Drive tug / inspect airport' })",
  'inspectionMode', 'terminal4UploadedJetwayLoadState', 'terminal4UploadedJetwayCount', 'terminal4UploadedJetwayConnectorCount',
  'inspectionAircraftCabDoorContactPlaneCovered', 'inspectionAircraftCabDoorLaterallyCovered',
  'inspectionAircraftCabDoorVerticallyCovered', 'inspectionAircraftCabDoorMinimumHeightMeters',
  'inspectionAircraftCabDoorMaximumHeightMeters', 'terminal4UploadedJetwayA1ServiceStairClearanceAuthority',
  'terminal4UploadedJetwayA1ServiceStairFuselagePenetrationMeters', SERVICE_STAIR_AUTHORITY,
  '__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__', 'setInterval(keepAttached, 12)',
  'delete window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__',
]) if (!source.includes(required)) throw new Error(`Bounded Terminal 4 visual evidence is missing ${required}`);
if (source.includes("typeof (await page.evaluate(() => window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__))")) {
  throw new Error('Unserializable A1 attach function probe survived visual evidence preparation');
}
const preCanvasIndex = source.indexOf("waitForSelector('canvas.trainerCanvas'");
const launchClickIndex = source.indexOf('await inspectionLaunch.click()');
if (preCanvasIndex >= 0 && (launchClickIndex < 0 || launchClickIndex > preCanvasIndex)) throw new Error('Terminal 4 visual verifier still waits for the canvas before launching inspection mode');

fs.writeFileSync(path, source);
console.log(`Bounded every Terminal 4 visual dataset transfer to ${keys.length} readiness/acceptance fields across ${occurrences} direct page-context reads, restored the current inspection launch, converted the A1 attach probe to a serializable browser boolean, held A1 attached through capture, retained exact final Cab-surface telemetry, and kept live exact service-stair/CRJ clearance fail-closed.`);
