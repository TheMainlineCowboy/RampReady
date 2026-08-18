import fs from 'node:fs';

const verifierPath = 'scripts/verify-terminal4-fleet-visual.cjs';
const normalizerPath = 'scripts/prepare-terminal4-visual-dataset-slice-v1.mjs';
const marker = '// terminal4-visual-physical-cab-surface-acceptance-v2\n';
const staleTransferKey = 'inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters';

let verifierSource = fs.readFileSync(verifierPath, 'utf8');

// prepare-a1-photo-visual-verifiers-v1 may leave the normalization marker in the
// verifier while later/generated branches still contain the old Cab-centroid
// diagnostic. Remove only that marker so the existing strict physical-Cab
// normalization reruns immediately before evidence collection.
verifierSource = verifierSource.replaceAll(marker, '');
fs.writeFileSync(verifierPath, verifierSource, 'utf8');

// Remove the retired centroid field only from the bounded transfer list. The
// normalizer intentionally retains replacement/check literals for this key
// elsewhere so stale centroid acceptance still fails closed. Match the keys
// array structurally rather than depending on line wrapping or neighboring keys.
let normalizerSource = fs.readFileSync(normalizerPath, 'utf8');
const keysStart = normalizerSource.indexOf('const keys = [');
if (keysStart < 0) throw new Error('Terminal 4 visual bounded keys array is missing');
const keysEnd = normalizerSource.indexOf('\n];', keysStart);
if (keysEnd < 0) throw new Error('Terminal 4 visual bounded keys array terminator is missing');
let keysBlock = normalizerSource.slice(keysStart, keysEnd + 3);
const keyPattern = new RegExp(`\\s*['\"]${staleTransferKey}['\"],?`, 'g');
const matches = keysBlock.match(keyPattern) || [];
if (matches.length > 1) {
  throw new Error(`Retired Cab centroid transfer key appears ${matches.length} times in bounded keys array`);
}
if (matches.length === 1) {
  keysBlock = keysBlock.replace(keyPattern, '');
  normalizerSource = normalizerSource.slice(0, keysStart) + keysBlock + normalizerSource.slice(keysEnd + 3);
}
if (keysBlock.includes(staleTransferKey)) {
  throw new Error('Retired Cab centroid field still exists in the bounded dataset transfer list');
}
for (const requiredPhysicalKey of [
  'inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters',
  'inspectionAircraftCabDoorContactPlaneCovered',
  'inspectionAircraftCabDoorLaterallyCovered',
  'inspectionAircraftCabDoorVerticallyCovered',
]) {
  if (!keysBlock.includes(requiredPhysicalKey)) {
    throw new Error(`Terminal 4 visual bounded keys lost physical Cab field ${requiredPhysicalKey}`);
  }
}
fs.writeFileSync(normalizerPath, normalizerSource, 'utf8');

console.log('Reset the Terminal 4 visual Cab-normalization marker and removed only the retired Cab-centroid transfer key from the bounded keys array; exact physical Cab surface and stale-token fail-closed guards remain intact.');
