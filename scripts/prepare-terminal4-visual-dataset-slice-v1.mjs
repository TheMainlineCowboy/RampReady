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

fs.writeFileSync(path, source);
console.log(`Bounded every Terminal 4 visual dataset transfer to ${keys.length} acceptance fields across ${occurrences} direct page-context reads.`);
