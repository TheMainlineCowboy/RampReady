import fs from 'node:fs';

const path = 'scripts/verify-terminal4-fleet-visual.cjs';
let source = fs.readFileSync(path, 'utf8');

const legacy = "await page.locator('canvas.trainerCanvas').evaluate((element) => ({ ...element.dataset }))";
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

const occurrences = source.split(legacy).length - 1;
if (occurrences < 1) {
  throw new Error(`Expected at least 1 full canvas dataset transfer, found ${occurrences}`);
}
source = source.split(legacy).join(sliced);
if (source.includes(legacy) || source.includes("page.locator('canvas.trainerCanvas').evaluate")) {
  throw new Error('A locator-based Terminal 4 canvas dataset transfer survived bounded evidence preparation');
}
fs.writeFileSync(path, source);
console.log(`Bounded every Terminal 4 visual dataset transfer to ${keys.length} acceptance fields across ${occurrences} direct page-context reads.`);
