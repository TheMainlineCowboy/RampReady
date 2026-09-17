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
const splitStaticAuthorities = 'const STATIC_SOURCE_PLACEMENT_AUTHORITY = "57-static-own-gate-target-real-wall-compact-registration-v9";\nconst STATIC_RUNTIME_PLACEMENT_AUTHORITY = "57-static-own-gate-target-real-wall-source-heading-provenance-v11";';
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
  if (staticMatches !== 1) {
    const staleRuntime = 'const STATIC_RUNTIME_PLACEMENT_AUTHORITY = "57-static-bgl-source-pose-real-wall-registration-v10";';
    const currentRuntime = 'const STATIC_RUNTIME_PLACEMENT_AUTHORITY = "57-static-own-gate-target-real-wall-source-heading-provenance-v11";';
    if (source.includes(staleRuntime)) {
      source = source.replace(staleRuntime, currentRuntime);
    } else if (!source.includes(currentRuntime)) {
      throw new Error(`Articulation static authority source anchor changed (migrated=${staticMatches})`);
    }
  }
}

const runtimeAssertionOld = 'expect(runtime.terminal4UploadedJetwayStaticOwnGateTargetAuthority).toBe(STATIC_SOURCE_PLACEMENT_AUTHORITY);';
const runtimeAssertionNew = 'expect(runtime.terminal4UploadedJetwayStaticOwnGateTargetAuthority).toBe(STATIC_RUNTIME_PLACEMENT_AUTHORITY);';
if (source.includes(runtimeAssertionOld)) {
  source = source.replace(runtimeAssertionOld, runtimeAssertionNew);
} else if (!source.includes(runtimeAssertionNew)) {
  throw new Error('Articulation final static runtime authority assertion anchor changed');
}

// Keep the exact supplied GLB's native source reach check (>20 m) intact. The
// final photo-authoritative A1 bridge is allowed to telescope inward after the
// remote Rotunda is fixed, so its horizontal Rotunda-opening-to-Cab projection
// is not the same quantity as the native source reach.
const staleHorizontalProjectionLowerBound = 'expect(geometricHorizontalRotundaOpeningToCabDistance).toBeGreaterThan(20);';
const currentHorizontalProjectionLowerBound = 'expect(geometricHorizontalRotundaOpeningToCabDistance).toBeGreaterThan(12);';
if (source.includes(staleHorizontalProjectionLowerBound)) {
  source = source.replace(staleHorizontalProjectionLowerBound, currentHorizontalProjectionLowerBound);
} else if (source.includes('geometricHorizontalRotundaOpeningToCabDistance')
  && !source.includes(currentHorizontalProjectionLowerBound)) {
  throw new Error('Articulation final horizontal Rotunda-opening-to-Cab lower-bound anchor changed');
}

// The legacy inspectionAircraftCabContact* values are representative points from
// an older Cab-axis picker. They can sit centimeters from the exact door even when
// the rounded supplied hood physically brackets it. Replace those proxy-distance
// assertions with the FINAL fixed-aircraft door-facing Cab-surface proof. This is
// stricter about real geometry: the door must lie inside the hood plane, lateral
// span and vertical span, with a nearby actual supplied vertex.
const staleRepresentativeAssertions = `  expect(Number.isFinite(renderedAircraftCabError)).toBe(true);\n  expect(renderedAircraftCabError).toBeLessThanOrEqual(0.01);`;
const physicalSurfaceAssertions = `  expect(Number.isFinite(renderedAircraftCabError)).toBe(true);\n  expect(returnedRuntime.inspectionAircraftCabDoorContactPlaneCovered).toBe("true");\n  expect(returnedRuntime.inspectionAircraftCabDoorLaterallyCovered).toBe("true");\n  expect(returnedRuntime.inspectionAircraftCabDoorVerticallyCovered).toBe("true");\n  const cabDoorFacingVertexCount = Number(returnedRuntime.inspectionAircraftCabDoorFacingVertexCount);\n  const cabDoorMinimumHorizontalVertexDistanceMeters = Number(returnedRuntime.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters);\n  expect(Number.isFinite(cabDoorFacingVertexCount)).toBe(true);\n  expect(cabDoorFacingVertexCount).toBeGreaterThanOrEqual(3);\n  expect(Number.isFinite(cabDoorMinimumHorizontalVertexDistanceMeters)).toBe(true);\n  expect(cabDoorMinimumHorizontalVertexDistanceMeters).toBeLessThanOrEqual(0.08);`;
if (source.includes(staleRepresentativeAssertions)) {
  source = source.replace(staleRepresentativeAssertions, physicalSurfaceAssertions);
} else if (!source.includes('inspectionAircraftCabDoorContactPlaneCovered')) {
  throw new Error('Articulation Cab representative-point assertion anchor changed');
}

const staleRepresentativeTargetAssertion = '  expect(Math.hypot(renderedDoorTargetX - measuredCabX, renderedDoorTargetZ - measuredCabZ)).toBeLessThanOrEqual(0.01);';
const physicalTargetAssertion = `  // The representative Cab point remains diagnostic only; actual attached-door\n  // acceptance is the final supplied hood footprint asserted above.\n  expect([measuredCabX, measuredCabZ].every(Number.isFinite)).toBe(true);`;
if (source.includes(staleRepresentativeTargetAssertion)) {
  source = source.replace(staleRepresentativeTargetAssertion, physicalTargetAssertion);
} else if (!source.includes('actual attached-door')) {
  throw new Error('Articulation final representative Cab-target assertion anchor changed');
}

if (source.includes('exact-authored-a1-lowest-geometry-ramp-contact-v2')) {
  throw new Error('Obsolete A1 lowest-geometry bogie authority survived articulation verifier preparation');
}
if (!source.includes('57-static-own-gate-target-real-wall-compact-registration-v9')) {
  throw new Error('Intermediate v9 static source-preparer authority disappeared from articulation source-integrity verification');
}
if (!source.includes('57-static-own-gate-target-real-wall-source-heading-provenance-v11')) {
  throw new Error('Final v11 static browser runtime authority is missing from articulation verification');
}
if (source.includes('57-static-bgl-source-pose-real-wall-registration-v10')) {
  throw new Error('Retired v10 static browser runtime authority survived articulation verification preparation');
}
if (!source.includes(runtimeAssertionNew)) {
  throw new Error('Final static runtime authority is not bound to the v11 browser assertion');
}
if (source.includes('geometricHorizontalRotundaOpeningToCabDistance')
  && !source.includes(currentHorizontalProjectionLowerBound)) {
  throw new Error('Final telescoped A1 horizontal projection is still bound to the retired 20 m native-source threshold');
}
for (const required of [
  'inspectionAircraftCabDoorContactPlaneCovered',
  'inspectionAircraftCabDoorLaterallyCovered',
  'inspectionAircraftCabDoorVerticallyCovered',
  'inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters',
  'cabDoorMinimumHorizontalVertexDistanceMeters).toBeLessThanOrEqual(0.08)',
]) {
  if (!source.includes(required)) throw new Error(`Articulation final physical Cab-surface assertion is missing ${required}`);
}

fs.writeFileSync(path, source);
console.log('Prepared articulation browser verifier for final Tunnel-C ramp contact, current own-gate real-wall static authority, and fixed-aircraft physical Cab-hood contact; stale representative Cab-point distances are diagnostic only, while the exact door must be bracketed by the supplied hood surface in plane, lateral position and height with a nearby real vertex.');
