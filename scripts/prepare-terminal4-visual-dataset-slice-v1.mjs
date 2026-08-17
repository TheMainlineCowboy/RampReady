import fs from 'node:fs';

const path = 'scripts/verify-terminal4-fleet-visual.cjs';
let source = fs.readFileSync(path, 'utf8');

const keys = [
  'terminal4UploadedJetwayA1VisualAcceptanceAuthority',
  'terminal4UploadedJetwayA1AssemblyPartCount',
  'terminal4UploadedJetwayA1IsolatedNodeRotationCount',
  'terminal4UploadedJetwayBogieGroundClearanceMeters',
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
  'inspectionAircraftJetwayAuthoredBogieGroundPreserved',
  'terminal4TerminalConnectedJetwayCount',
  'terminal4UploadedJetwayStaticOwnGateTargetAuthority',
  'terminal4UploadedJetwayStaticOwnGateTargetCount',
  'terminal4UploadedJetwayStaticMaximumOwnGateHeadingErrorRadians',
  'terminal4UploadedJetwayStaticMaximumTerminalFacingDot',
];

const sliced = `await page.evaluate((keys) => { const element = document.querySelector('canvas.trainerCanvas'); if (!(element instanceof HTMLCanvasElement)) throw new Error('Three.js canvas is missing'); return Object.fromEntries(keys.map((key) => [key, element.dataset[key]])); }, ${JSON.stringify(keys)})`;

// Generated visual verifiers have used both a direct locator and a cached
// `canvas` locator for full dataset transfers. Match the semantic operation
// rather than one exact formatting string so a whitespace/refactor change
// cannot silently reintroduce Playwright locator/actionability overhead.
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

// Inspection mode normally owns A1's parked/retracted state. The photo evidence
// verifier needs the same controller held in its physically attached deployment
// long enough for the live Cab/door monitor and screenshots to observe one
// stable frame. Re-issue the existing evidence-only attach bridge on a bounded
// timer during A1 capture, then release it before representative fleet views.
// This changes no geometry and does not alter normal inspection behavior.
const attachWaitAnchor = `  // Critical acceptance boundary: measure the actual visible CRJ door against\n  // the actual final Cab while A1 is physically in its attached deployment.`;
const persistentAttachBlock = `  await page.evaluate(() => {\n    const attach = window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__;\n    if (typeof attach !== 'function') throw new Error('A1 attached visual-evidence bridge is missing');\n    if (window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__) {\n      clearInterval(window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__);\n    }\n    const keepAttached = () => {\n      const state = attach();\n      if (state === 'not-ready') return false;\n      return true;\n    };\n    if (!keepAttached()) throw new Error('A1 attached visual-evidence bridge ran before the supplied jetway controller was ready');\n    window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__ = setInterval(keepAttached, 12);\n  });\n\n${attachWaitAnchor}`;
if (!source.includes('__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__')) {
  if (!source.includes(attachWaitAnchor)) throw new Error('A1 attached-evidence capture anchor is missing');
  source = source.replace(attachWaitAnchor, persistentAttachBlock);
}

const fleetLoopAnchor = `  for (const [preset, label, filename, cameraView] of fleetViews) {`;
const releaseAttachBlock = `  await page.evaluate(() => {\n    if (window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__) {\n      clearInterval(window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__);\n      delete window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__;\n    }\n  });\n\n${fleetLoopAnchor}`;
if (!source.includes('delete window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__')) {
  if (!source.includes(fleetLoopAnchor)) throw new Error('Fleet-view release anchor is missing');
  source = source.replace(fleetLoopAnchor, releaseAttachBlock);
}

for (const required of [
  '__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__',
  'setInterval(keepAttached, 12)',
  'delete window.__RAMPREADY_VISUAL_EVIDENCE_A1_ATTACH_TIMER__',
]) {
  if (!source.includes(required)) throw new Error(`Persistent A1 visual attachment is missing ${required}`);
}

fs.writeFileSync(path, source);
console.log(`Bounded every Terminal 4 visual dataset transfer to ${keys.length} acceptance fields across ${occurrences} direct page-context reads and held the existing evidence-only A1 controller attachment through the A1 capture window.`);
