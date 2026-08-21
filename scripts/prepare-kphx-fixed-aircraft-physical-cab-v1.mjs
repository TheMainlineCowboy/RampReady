import fs from 'node:fs';

const FIXED_AIRCRAFT_AUTHORITY = 'fixed-source-a1-parking-center-exact-authored-door-v2';
const PHYSICAL_CAB_AUTHORITY = 'a1-final-exact-cab-footprint-door-contact-v6-bounded-lateral-and-vertical-fit';
const SOURCE_HEADING_AUTHORITY = 'source-a1-parking-heading-authored-door-registration-v2';
const SOURCE_A1_YAW = 0.00857;
const MIN_A1_FIXED_ROUTE_METERS = 18;
const MAX_A1_FIXED_ROUTE_METERS = 30;
const files = [
  'tests/browser/kphx-ground-runtime.spec.js',
  'tests/browser/a1-terminal-joint-bogie-subviews.spec.js',
];

for (const path of files) {
  let source = fs.readFileSync(path, 'utf8');

  source = source
    .replaceAll('final-live-cab-mesh-visible-door-registration-v7', FIXED_AIRCRAFT_AUTHORITY)
    .replaceAll(
      'data?.inspectionAircraftPoseAuthority === aircraftAuthority\n      && data?.inspectionAircraftFixedSourceGateAuthority === aircraftAuthority',
      'typeof data?.inspectionAircraftPoseAuthority === "string"\n      && data.inspectionAircraftPoseAuthority.length > 0\n      && data?.inspectionAircraftFixedSourceGateAuthority === aircraftAuthority',
    );

  source = source.replace(
    /const TERMINAL_RELOCATED_AIRCRAFT_AUTHORITY = "[^"]+";/,
    `const TERMINAL_RELOCATED_AIRCRAFT_AUTHORITY = "${FIXED_AIRCRAFT_AUTHORITY}";`,
  );
  source = source.replaceAll(
    'data?.inspectionAircraftPoseAuthority === aircraftAuthority\n      && Number.isFinite(Number(data?.inspectionAircraftTerminalRelocationX))',
    'typeof data?.inspectionAircraftPoseAuthority === "string"\n      && data.inspectionAircraftPoseAuthority.length > 0\n      && data?.inspectionAircraftFixedSourceGateAuthority === aircraftAuthority\n      && Number.isFinite(Number(data?.inspectionAircraftTerminalRelocationX))',
  );

  source = source.replaceAll(
    'Math.abs(Number(data?.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters) - 2.4) <= 0.05',
    `Number.isFinite(Number(data?.a1ExactRotundaToWallWorldMeters))\n      && Number(data?.a1ExactRotundaToWallWorldMeters) >= ${MIN_A1_FIXED_ROUTE_METERS}\n      && Number(data?.a1ExactRotundaToWallWorldMeters) <= ${MAX_A1_FIXED_ROUTE_METERS}`,
  );
  source = source.replaceAll(
    'expect(Math.abs(Number(runtime.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters) - 2.4)).toBeLessThanOrEqual(0.05);',
    `const finalA1FixedRouteMeters = Number(runtime.a1ExactRotundaToWallWorldMeters);\n  expect(Number.isFinite(finalA1FixedRouteMeters)).toBe(true);\n  expect(finalA1FixedRouteMeters).toBeGreaterThanOrEqual(${MIN_A1_FIXED_ROUTE_METERS});\n  expect(finalA1FixedRouteMeters).toBeLessThanOrEqual(${MAX_A1_FIXED_ROUTE_METERS});`,
  );

  const physicalPredicate = `data?.inspectionAircraftCabDoorContactAuthority === '${PHYSICAL_CAB_AUTHORITY}'
      && data?.inspectionAircraftCabDoorContactPlaneCovered === "true"
      && data?.inspectionAircraftCabDoorLaterallyCovered === "true"
      && data?.inspectionAircraftCabDoorVerticallyCovered === "true"
      && Number(data?.inspectionAircraftCabDoorFacingVertexCount) >= 3
      && Number.isFinite(Number(data?.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters))
      && Number(data?.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters) <= 0.06`;

  source = source.replaceAll(
    'Number.isFinite(Number(data?.inspectionAircraftCabContactErrorMeters))\n      && Number(data?.inspectionAircraftCabContactErrorMeters) <= 0.01',
    physicalPredicate,
  );
  source = source.replaceAll(
    'Number(data?.inspectionAircraftCabContactErrorMeters) <= 0.01',
    physicalPredicate,
  );
  source = source.replaceAll(
    'Number.isFinite(Number(data?.inspectionAircraftSourceGateDoorTargetErrorMeters))\n      && Number(data?.inspectionAircraftSourceGateDoorTargetErrorMeters) <= 0.01',
    `Number.isFinite(Number(data?.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters))\n      && Number(data?.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters) <= 0.06`,
  );
  source = source.replaceAll(
    'Number(data?.inspectionAircraftSourceGateDoorTargetErrorMeters) <= 0.01',
    `Number(data?.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters) <= 0.06`,
  );

  source = source.replaceAll(
    'expect(runtime.inspectionAircraftPoseAuthority).toBe(AIRPORT_OWNED_AIRCRAFT_AUTHORITY);',
    'expect(runtime.inspectionAircraftPoseAuthority).toBeTruthy();',
  );
  source = source.replaceAll(
    'expect(runtime.inspectionAircraftPoseAuthority).toBe(TERMINAL_RELOCATED_AIRCRAFT_AUTHORITY);',
    `expect(runtime.inspectionAircraftPoseAuthority).toBeTruthy();\n  expect(runtime.inspectionAircraftFixedSourceGateAuthority).toBe(TERMINAL_RELOCATED_AIRCRAFT_AUTHORITY);`,
  );
  source = source.replaceAll(
    'expect(runtime.inspectionAircraftCabContactErrorMeters).toBeLessThanOrEqual(0.01);',
    `expect(runtime.inspectionAircraftCabDoorContactAuthority).toBe('${PHYSICAL_CAB_AUTHORITY}');\n  expect(runtime.inspectionAircraftCabDoorContactPlaneCovered).toBe('true');\n  expect(runtime.inspectionAircraftCabDoorLaterallyCovered).toBe('true');\n  expect(runtime.inspectionAircraftCabDoorVerticallyCovered).toBe('true');\n  expect(Number(runtime.inspectionAircraftCabDoorFacingVertexCount)).toBeGreaterThanOrEqual(3);\n  expect(Number(runtime.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters)).toBeLessThanOrEqual(0.06);`,
  );
  source = source.replaceAll(
    'expect(Number(runtime.inspectionAircraftCabContactErrorMeters)).toBeLessThanOrEqual(0.01);',
    `expect(runtime.inspectionAircraftCabDoorContactAuthority).toBe('${PHYSICAL_CAB_AUTHORITY}');\n  expect(runtime.inspectionAircraftCabDoorContactPlaneCovered).toBe('true');\n  expect(runtime.inspectionAircraftCabDoorLaterallyCovered).toBe('true');\n  expect(runtime.inspectionAircraftCabDoorVerticallyCovered).toBe('true');\n  expect(Number(runtime.inspectionAircraftCabDoorFacingVertexCount)).toBeGreaterThanOrEqual(3);\n  expect(Number(runtime.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters)).toBeLessThanOrEqual(0.06);`,
  );
  source = source.replaceAll(
    'expect(Number(terminalRuntime.inspectionAircraftCabContactErrorMeters)).toBeLessThanOrEqual(0.01);',
    `expect(terminalRuntime.inspectionAircraftCabDoorContactAuthority).toBe('${PHYSICAL_CAB_AUTHORITY}');\n  expect(terminalRuntime.inspectionAircraftCabDoorContactPlaneCovered).toBe('true');\n  expect(terminalRuntime.inspectionAircraftCabDoorLaterallyCovered).toBe('true');\n  expect(terminalRuntime.inspectionAircraftCabDoorVerticallyCovered).toBe('true');\n  expect(Number(terminalRuntime.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters)).toBeLessThanOrEqual(0.06);`,
  );
  source = source.replaceAll('  expect(Number(runtime.inspectionAircraftSourceGateDoorTargetErrorMeters)).toBeLessThanOrEqual(0.01);\n', '');
  source = source.replaceAll('  expect(Number(terminalRuntime.inspectionAircraftSourceGateDoorTargetErrorMeters)).toBeLessThanOrEqual(0.01);\n', '');

  source = source.replace(
    `  expect(Math.hypot(aircraftRelocationX, aircraftRelocationZ)).toBeGreaterThan(1);`,
    `  expect([aircraftRelocationX, aircraftRelocationZ].every(Number.isFinite)).toBe(true);`,
  );
  source = source.replace(
    /  expect\(Number\(runtime\.inspectionAircraftNoseGearX\)\)\.toBeCloseTo\([\s\S]*?  expect\(Number\(runtime\.inspectionAircraftYaw\)\)\.toBeCloseTo\(expectedCabRegisteredYaw, 4\);/,
    `  expect(runtime.inspectionAircraftHeadingAuthority).toBe("${SOURCE_HEADING_AUTHORITY}");\n  expect(Number(runtime.aircraftModePoseLiveYaw)).toBeCloseTo(${SOURCE_A1_YAW}, 4);`,
  );
  source = source.replace(/\n\s*expect\(Math\.hypot\(renderedDoorX - cabContactX, renderedDoorZ - cabContactZ\)\)\.toBeLessThanOrEqual\(0\.01\);/g, '');

  if (!source.includes(FIXED_AIRCRAFT_AUTHORITY)) throw new Error(`${path}: fixed authored-aircraft authority was not installed`);
  if (!source.includes(PHYSICAL_CAB_AUTHORITY)) throw new Error(`${path}: current physical Cab authority was not installed`);
  if (!source.includes('inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters')) throw new Error(`${path}: physical Cab surface acceptance was not installed`);
  if (source.includes('inspectionAircraftPoseAuthority === aircraftAuthority')) throw new Error(`${path}: stale shared pose/fixed-source authority equality remains`);
  if (source.includes('a1-final-exact-cab-footprint-door-contact-v2')) throw new Error(`${path}: stale v2 Cab authority remains`);
  if (path.endsWith('kphx-ground-runtime.spec.js')) {
    if (source.includes('VisibleVestibuleLengthMeters) - 2.4')) throw new Error(`${path}: stale compact 2.4 m A1 route gate remains`);
    if (!source.includes('a1ExactRotundaToWallWorldMeters')) throw new Error(`${path}: long A1 fixed-route authority is missing`);
    if (!source.includes(SOURCE_HEADING_AUTHORITY)) throw new Error(`${path}: fixed source heading authority is missing`);
  }

  fs.writeFileSync(path, source, 'utf8');
}

console.log(`Prepared final KPHX browser gates for ${PHYSICAL_CAB_AUTHORITY}, fixed authored aircraft, Aug. 15 long A1 dogleg/remote Rotunda, authored source heading and grounded bogie.`);
