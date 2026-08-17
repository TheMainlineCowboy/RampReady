import fs from 'node:fs';

const path = 'tests/browser/uploaded-jetway-articulation-v10.spec.js';
let source = fs.readFileSync(path, 'utf8');

const staleBogie = 'const JETWAY_BOGIE_GROUND_AUTHORITY = "exact-authored-a1-lowest-geometry-ramp-contact-v2";';
const currentBogie = 'const JETWAY_BOGIE_GROUND_AUTHORITY = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";';
const staleBogieCount = source.split(staleBogie).length - 1;
const currentBogieCount = source.split(currentBogie).length - 1;

if (staleBogieCount === 1 && currentBogieCount === 0) {
  source = source.replace(staleBogie, currentBogie);
} else if (staleBogieCount === 0 && currentBogieCount === 1) {
  // Already migrated by an earlier production preparation stage.
} else {
  throw new Error(`Articulation bogie authority anchor changed (stale=${staleBogieCount}, current=${currentBogieCount})`);
}

// Final static registration has advanced beyond the earlier compact v9 label.
// The live final fleet preserves the decoded BGL/source pose as provenance while
// registering each short static connector to the real Terminal 4 wall. Keep the
// 57-gate count, own-gate/contact checks and short 0.55 m connector bounds intact;
// update only the browser's authority token so it validates the final runtime
// rather than demanding an obsolete intermediate label.
const staticAuthorityPatterns = [
  'const STATIC_SOURCE_PLACEMENT_AUTHORITY = "57-static-own-gate-target-real-wall-compact-registration-v9";',
  'const STATIC_SOURCE_PLACEMENT_AUTHORITY = "57-static-exact-bgl-source-placement-no-facade-relocation-v1";',
];
const currentStaticAuthority = 'const STATIC_SOURCE_PLACEMENT_AUTHORITY = "57-static-bgl-source-pose-real-wall-registration-v10";';
let staticMatches = 0;
for (const stale of staticAuthorityPatterns) {
  const count = source.split(stale).length - 1;
  if (count > 1) throw new Error(`Articulation static authority anchor duplicated: ${stale}`);
  if (count === 1) {
    source = source.replace(stale, currentStaticAuthority);
    staticMatches += 1;
  }
}
const currentStaticCount = source.split(currentStaticAuthority).length - 1;
if (!((staticMatches === 1 && currentStaticCount === 1) || (staticMatches === 0 && currentStaticCount === 1))) {
  throw new Error(`Articulation static authority anchor changed (migrated=${staticMatches}, current=${currentStaticCount})`);
}

if (source.includes('exact-authored-a1-lowest-geometry-ramp-contact-v2')) {
  throw new Error('Obsolete A1 lowest-geometry bogie authority survived articulation verifier preparation');
}
if (source.includes('57-static-own-gate-target-real-wall-compact-registration-v9')) {
  throw new Error('Obsolete static compact v9 authority survived articulation verifier preparation');
}

fs.writeFileSync(path, source);
console.log('Prepared articulation browser verifier for final Tunnel-C ramp contact and final v10 static real-wall/source-pose authority; all 57 static connector/own-gate checks remain fail-closed.');
