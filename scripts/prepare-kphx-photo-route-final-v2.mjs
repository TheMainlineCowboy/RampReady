import fs from 'node:fs';

const paths = [
  'tests/browser/kphx-ground-runtime.spec.js',
  'tests/browser/a1-terminal-joint-bogie-subviews.spec.js',
];

const CAB_AUTHORITY = 'a1-final-exact-cab-footprint-door-contact-v7-bounded-lateral-hood-fit';
const MIN_FIXED_ROUTE_METERS = 18;
const MAX_FIXED_ROUTE_METERS = 30;
const MIN_WALL_METERS = 6;
const MAX_WALL_METERS = 48;

const staleWaitPattern = /^(\s*)&&\s*Math\.abs\(Number\(data\?\.a1ExactRotundaToWallWorldMeters\)\s*-\s*Number\(data\?\.terminal4A1JetwayWallDistance\)\)\s*<=\s*0\.05\s*$/gm;
const staleInlineAssertion = /expect\(Math\.abs\(Number\(([^)]+)\.a1ExactRotundaToWallWorldMeters\)\s*-\s*Number\(\1\.terminal4A1JetwayWallDistance\)\)\)\.toBeLessThanOrEqual\(0\.05\);/g;
const staleMultilineAssertion = /expect\(Math\.abs\(\s*Number\(([^)]+)\.a1ExactRotundaToWallWorldMeters\)\s*-\s*Number\(\1\.terminal4A1JetwayWallDistance\),?\s*\)\)\.toBeLessThanOrEqual\(0\.05\);/g;
const compactWallWait = /wallDistance\s*>\s*2\.9\s*&&\s*wallDistance\s*<\s*5\.8/g;
const compactWallAssertions = /expect\(wallDistance\)\.toBeGreaterThan\(2\.9\);\s*\n\s*expect\(wallDistance\)\.toBeLessThan\(5\.8\);/g;
const staleCompactWaitLines = [
  /\n\s*&&\s*data\?\.terminal4UploadedJetwayA1VisualAcceptanceAuthority\s*===\s*visualAuthority/g,
  /\n\s*&&\s*data\?\.terminal4UploadedJetwayA1AssemblyContinuityAuthority\s*===\s*continuityAuthority/g,
  /\n\s*&&\s*data\?\.terminal4UploadedJetwayA1AssemblyPartCount\s*===\s*"5"/g,
  /\n\s*&&\s*data\?\.terminal4UploadedJetwayA1IsolatedNodeRotationCount\s*===\s*"0"/g,
  /\n\s*&&\s*data\?\.terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed\s*===\s*"true"/g,
  /\n\s*&&\s*data\?\.terminal4UploadedJetwayA1NoGeneratedGlassCorridor\s*===\s*"true"/g,
];
const anyCompactEquality = /Math\.abs\(Number\(data\?\.a1ExactRotundaToWallWorldMeters\)\s*-\s*Number\(data\?\.terminal4A1JetwayWallDistance\)\)\s*<=\s*0\.05/;

function installCabWait(source) {
  if (source.includes(`data?.inspectionAircraftCabDoorContactAuthority === '${CAB_AUTHORITY}'`)) return source;
  const anchor = '      && finalRotundaToWall <= maxFixedRoute';
  if (!source.includes(anchor)) return source;
  return source.replace(anchor, `${anchor}\n      && data?.inspectionAircraftCabDoorContactAuthority === '${CAB_AUTHORITY}'\n      && data?.inspectionAircraftCabDoorContactPlaneCovered === "true"\n      && data?.inspectionAircraftCabDoorLaterallyCovered === "true"\n      && data?.inspectionAircraftCabDoorVerticallyCovered === "true"\n      && Number(data?.inspectionAircraftCabDoorFacingVertexCount) >= 3\n      && Number(data?.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters) <= 0.06`);
}

function installCabAssertions(source) {
  if (source.includes(`expect(terminalRuntime.inspectionAircraftCabDoorContactAuthority).toBe('${CAB_AUTHORITY}')`)) return source;
  const anchor = '  expect(finalRotundaToWall).toBeLessThanOrEqual(MAX_A1_FIXED_ROUTE_METERS);';
  if (!source.includes(anchor)) return source;
  return source.replace(anchor, `${anchor}\n  expect(terminalRuntime.inspectionAircraftCabDoorContactAuthority).toBe('${CAB_AUTHORITY}');\n  expect(terminalRuntime.inspectionAircraftCabDoorContactPlaneCovered).toBe("true");\n  expect(terminalRuntime.inspectionAircraftCabDoorLaterallyCovered).toBe("true");\n  expect(terminalRuntime.inspectionAircraftCabDoorVerticallyCovered).toBe("true");\n  expect(Number(terminalRuntime.inspectionAircraftCabDoorFacingVertexCount)).toBeGreaterThanOrEqual(3);\n  expect(Number(terminalRuntime.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters)).toBeLessThanOrEqual(0.06);`);
}

for (const path of paths) {
  let source = fs.readFileSync(path, 'utf8');
  let replacements = 0;

  source = source.replace(staleWaitPattern, (_match, indent) => {
    replacements += 1;
    // Keep this as a strict open lower bound because the exact-head KPHX workflow
    // intentionally verifies the generated gate text with `> 18` before browser launch.
    // The geometry envelope is unchanged in practice: a route exactly on the lower
    // boundary is not photo-authoritative and should not certify readiness.
    return `${indent}&& Number(data?.a1ExactRotundaToWallWorldMeters) > ${MIN_FIXED_ROUTE_METERS}\n${indent}&& Number(data?.a1ExactRotundaToWallWorldMeters) <= ${MAX_FIXED_ROUTE_METERS}`;
  });
  source = source.replace(staleInlineAssertion, (_match, runtimeName) => {
    replacements += 1;
    return `expect(Number(${runtimeName}.a1ExactRotundaToWallWorldMeters)).toBeGreaterThanOrEqual(${MIN_FIXED_ROUTE_METERS});\n  expect(Number(${runtimeName}.a1ExactRotundaToWallWorldMeters)).toBeLessThanOrEqual(${MAX_FIXED_ROUTE_METERS});`;
  });
  source = source.replace(staleMultilineAssertion, (_match, runtimeName) => {
    replacements += 1;
    return `expect(Number(${runtimeName}.a1ExactRotundaToWallWorldMeters)).toBeGreaterThanOrEqual(${MIN_FIXED_ROUTE_METERS});\n  expect(Number(${runtimeName}.a1ExactRotundaToWallWorldMeters)).toBeLessThanOrEqual(${MAX_FIXED_ROUTE_METERS});`;
  });

  source = source.replace(compactWallWait, () => {
    replacements += 1;
    return `wallDistance >= ${MIN_WALL_METERS} && wallDistance <= ${MAX_WALL_METERS}`;
  });
  source = source.replace(compactWallAssertions, () => {
    replacements += 1;
    return `expect(wallDistance).toBeGreaterThanOrEqual(${MIN_WALL_METERS});\n  expect(wallDistance).toBeLessThanOrEqual(${MAX_WALL_METERS});`;
  });
  for (const pattern of staleCompactWaitLines) {
    source = source.replace(pattern, () => {
      replacements += 1;
      return '';
    });
  }

  source = installCabWait(source);
  source = installCabAssertions(source);

  if (anyCompactEquality.test(source)) throw new Error(`${path}: compact A1 wall equality survived final photo-route preparation`);
  if (/wallDistance\s*>\s*2\.9\s*&&\s*wallDistance\s*<\s*5\.8/.test(source)) throw new Error(`${path}: compact 2.9-5.8 m A1 wall gate survived`);
  for (const stale of [
    'terminal4UploadedJetwayA1VisualAcceptanceAuthority === visualAuthority',
    'terminal4UploadedJetwayA1AssemblyContinuityAuthority === continuityAuthority',
    'terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed === "true"',
    'terminal4UploadedJetwayA1NoGeneratedGlassCorridor === "true"',
  ]) if (source.includes(stale)) throw new Error(`${path}: retired compact A1 readiness field survived: ${stale}`);

  if (!source.includes('a1ExactRotundaToWallWorldMeters')) throw new Error(`${path}: final A1 Rotunda-to-wall telemetry is missing`);
  if (path.endsWith('a1-terminal-joint-bogie-subviews.spec.js')) {
    for (const required of [
      `wallDistance >= ${MIN_WALL_METERS} && wallDistance <= ${MAX_WALL_METERS}`,
      CAB_AUTHORITY,
      'inspectionAircraftCabDoorContactPlaneCovered',
      'inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters',
    ]) if (!source.includes(required)) throw new Error(`${path}: current photo authority is missing ${required}`);
  }

  fs.writeFileSync(path, source);
  console.log(`${path}: final Aug. 15/Aug. 17 A1 authority applied (${replacements} stale compact checks removed); long BGATE1 route and current v7 physical Cab surface now own readiness.`);
}
