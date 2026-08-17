import fs from 'node:fs';

const path = 'tests/browser/uploaded-jetway-articulation-v10.spec.js';
let source = fs.readFileSync(path, 'utf8');

const stale = 'const JETWAY_BOGIE_GROUND_AUTHORITY = "exact-authored-a1-lowest-geometry-ramp-contact-v2";';
const current = 'const JETWAY_BOGIE_GROUND_AUTHORITY = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";';
const staleCount = source.split(stale).length - 1;
const currentCount = source.split(current).length - 1;

if (staleCount === 1 && currentCount === 0) {
  source = source.replace(stale, current);
} else if (staleCount === 0 && currentCount === 1) {
  // Already migrated by an earlier production preparation stage.
} else {
  throw new Error(`Articulation bogie authority anchor changed (stale=${staleCount}, current=${currentCount})`);
}

if (source.includes('exact-authored-a1-lowest-geometry-ramp-contact-v2')) {
  throw new Error('Obsolete A1 lowest-geometry bogie authority survived articulation verifier preparation');
}

fs.writeFileSync(path, source);
console.log('Prepared articulation browser verifier for the final Tunnel-C ramp-contact authority.');
