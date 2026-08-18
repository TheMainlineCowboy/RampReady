import fs from 'node:fs';

const path = 'scripts/verify-terminal4-fleet-visual.cjs';
const marker = '// terminal4-visual-physical-cab-surface-acceptance-v2\n';
let source = fs.readFileSync(path, 'utf8');

// prepare-a1-photo-visual-verifiers-v1 may leave the normalization marker in the
// verifier while later/generated branches still contain the old Cab-centroid
// diagnostic. The dataset normalizer is intentionally idempotent, but its marker
// previously caused it to skip the replacement pass. Remove only that marker so
// the existing strict physical Cab-surface normalization runs again immediately
// before evidence collection. No runtime or geometry source is touched.
source = source.replaceAll(marker, '');
fs.writeFileSync(path, source, 'utf8');
console.log('Reset the Terminal 4 visual Cab-normalization marker so the final evidence pass re-normalizes every generated branch to the exact physical Cab surface.');
