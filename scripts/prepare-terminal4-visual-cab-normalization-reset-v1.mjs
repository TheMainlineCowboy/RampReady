import fs from 'node:fs';

const verifierPath = 'scripts/verify-terminal4-fleet-visual.cjs';
const normalizerPath = 'scripts/prepare-terminal4-visual-dataset-slice-v1.mjs';
const marker = '// terminal4-visual-physical-cab-surface-acceptance-v2\n';
const staleCentroidKey = "'inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters',";

let verifierSource = fs.readFileSync(verifierPath, 'utf8');

// prepare-a1-photo-visual-verifiers-v1 may leave the normalization marker in the
// verifier while later/generated branches still contain the old Cab-centroid
// diagnostic. The dataset normalizer is intentionally idempotent, but its marker
// previously caused it to skip the replacement pass. Remove only that marker so
// the existing strict physical Cab-surface normalization runs again immediately
// before evidence collection. No runtime or geometry source is touched.
verifierSource = verifierSource.replaceAll(marker, '');
fs.writeFileSync(verifierPath, verifierSource, 'utf8');

// The bounded dataset transfer itself used to request the retired centroid field.
// That reintroduced the obsolete token after the verifier had already been
// normalized, causing the normalizer's own fail-closed stale-token check to fire.
// The exact physical Cab surface fields are already in the same key list, so the
// centroid key is unnecessary for acceptance and is removed before the normalizer
// executes. This changes evidence plumbing only, never scene geometry.
let normalizerSource = fs.readFileSync(normalizerPath, 'utf8');
if (!normalizerSource.includes(staleCentroidKey)) {
  throw new Error('Terminal 4 visual dataset normalizer no longer contains the expected stale Cab centroid key');
}
normalizerSource = normalizerSource.replace(staleCentroidKey, '');
if (normalizerSource.includes(staleCentroidKey)) {
  throw new Error('Stale Cab centroid key survived bounded dataset key cleanup');
}
fs.writeFileSync(normalizerPath, normalizerSource, 'utf8');

console.log('Reset the Terminal 4 visual Cab-normalization marker and removed the retired Cab-centroid field from the bounded evidence key list so final acceptance uses only the exact physical Cab surface.');
