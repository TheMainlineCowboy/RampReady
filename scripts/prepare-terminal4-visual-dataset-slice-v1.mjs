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
const sliced = `await page.locator('canvas.trainerCanvas').evaluate((element, keys) => Object.fromEntries(keys.map((key) => [key, element.dataset[key]])), ${JSON.stringify(keys)})`;

const occurrences = source.split(legacy).length - 1;
if (occurrences !== 2) {
  throw new Error(`Expected exactly 2 full canvas dataset transfers, found ${occurrences}`);
}
source = source.split(legacy).join(sliced);
fs.writeFileSync(path, source);
console.log(`Bounded Terminal 4 visual dataset transfer to ${keys.length} acceptance fields across ${occurrences} reads.`);
