import fs from 'node:fs';

const verifierPath = 'scripts/verify-terminal4-fleet-visual.cjs';
const normalizerPath = 'scripts/prepare-terminal4-visual-dataset-slice-v1.mjs';
const marker = '// terminal4-visual-physical-cab-surface-acceptance-v2\n';
const staleKeySequence = `  'inspectionAircraftLiveVisibleCabVertexCount',\n  'inspectionAircraftLiveVisibleCabEndpointVertexCount', 'inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters',\n  'inspectionAircraftDoorVerticalErrorMeters', 'inspectionAircraftCabDoorContactPlaneCovered',`;
const physicalKeySequence = `  'inspectionAircraftLiveVisibleCabVertexCount',\n  'inspectionAircraftLiveVisibleCabEndpointVertexCount',\n  'inspectionAircraftDoorVerticalErrorMeters', 'inspectionAircraftCabDoorContactPlaneCovered',`;

let verifierSource = fs.readFileSync(verifierPath, 'utf8');

// prepare-a1-photo-visual-verifiers-v1 may leave the normalization marker in the
// verifier while later/generated branches still contain the old Cab-centroid
// diagnostic. Remove only that marker so the existing strict physical-Cab
// normalization reruns immediately before evidence collection.
verifierSource = verifierSource.replaceAll(marker, '');
fs.writeFileSync(verifierPath, verifierSource, 'utf8');

// Remove the retired centroid field from the bounded transfer list specifically.
// Do not remove the normalizer's replacement/check literals: those are the guards
// that ensure no stale centroid acceptance survives in the verifier itself.
let normalizerSource = fs.readFileSync(normalizerPath, 'utf8');
if (normalizerSource.includes(staleKeySequence)) {
  normalizerSource = normalizerSource.replace(staleKeySequence, physicalKeySequence);
} else if (!normalizerSource.includes(physicalKeySequence)) {
  throw new Error('Terminal 4 visual bounded key-list anchor changed before Cab centroid cleanup');
}
if (normalizerSource.includes(staleKeySequence)) {
  throw new Error('Retired Cab centroid field still exists in the bounded dataset transfer list');
}
fs.writeFileSync(normalizerPath, normalizerSource, 'utf8');

console.log('Reset the Terminal 4 visual Cab-normalization marker and removed only the retired Cab-centroid transfer key; the exact physical Cab surface and stale-token fail-closed guards remain intact.');
