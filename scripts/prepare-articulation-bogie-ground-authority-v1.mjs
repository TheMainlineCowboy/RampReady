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

const staticAuthorityPatterns = [
  'const STATIC_SOURCE_PLACEMENT_AUTHORITY = "57-static-own-gate-target-real-wall-compact-registration-v9";',
  'const STATIC_SOURCE_PLACEMENT_AUTHORITY = "57-static-exact-bgl-source-placement-no-facade-relocation-v1";',
];
const splitStaticAuthorities = 'const STATIC_SOURCE_PLACEMENT_AUTHORITY = "57-static-own-gate-target-real-wall-compact-registration-v9";\nconst STATIC_RUNTIME_PLACEMENT_AUTHORITY = "57-static-bgl-source-pose-real-wall-registration-v10";';
if (!source.includes(splitStaticAuthorities)) {
  let staticMatches = 0;
  for (const stale of staticAuthorityPatterns) {
    const count = source.split(stale).length - 1;
    if (count > 1) throw new Error(`Articulation static authority anchor duplicated: ${stale}`);
    if (count === 1) {
      source = source.replace(stale, splitStaticAuthorities);
      staticMatches += 1;
    }
  }
  if (staticMatches !== 1) throw new Error(`Articulation static authority source anchor changed (migrated=${staticMatches})`);
}

const runtimeAssertionOld = 'expect(runtime.terminal4UploadedJetwayStaticOwnGateTargetAuthority).toBe(STATIC_SOURCE_PLACEMENT_AUTHORITY);';
const runtimeAssertionNew = 'expect(runtime.terminal4UploadedJetwayStaticOwnGateTargetAuthority).toBe(STATIC_RUNTIME_PLACEMENT_AUTHORITY);';
if (source.includes(runtimeAssertionOld)) {
  source = source.replace(runtimeAssertionOld, runtimeAssertionNew);
} else if (!source.includes(runtimeAssertionNew)) {
  throw new Error('Articulation final static runtime authority assertion anchor changed');
}

if (source.includes('exact-authored-a1-lowest-geometry-ramp-contact-v2')) {
  throw new Error('Obsolete A1 lowest-geometry bogie authority survived articulation verifier preparation');
}
if (!source.includes('57-static-own-gate-target-real-wall-compact-registration-v9')) {
  throw new Error('Intermediate v9 static source-preparer authority disappeared from articulation source-integrity verification');
}
if (!source.includes('57-static-bgl-source-pose-real-wall-registration-v10')) {
  throw new Error('Final v10 static browser runtime authority is missing from articulation verification');
}
if (!source.includes(runtimeAssertionNew)) {
  throw new Error('Final static runtime authority is not bound to the v10 browser assertion');
}

fs.writeFileSync(path, source);
console.log('Prepared articulation browser verifier for final Tunnel-C ramp contact, retained the v9 static source-preparer contract, and bound final browser telemetry to v10 static real-wall/source-pose authority; all 57 static connector/own-gate checks remain fail-closed.');
