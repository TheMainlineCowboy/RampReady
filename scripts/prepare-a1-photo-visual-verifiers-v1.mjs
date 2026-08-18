import fs from "node:fs";

const CAMERA_AUTHORITY = "source-measured-a1-apron-side-evidence-camera-v5-balanced-branches";
const PHOTO_CONNECTOR_STYLE_AUTHORITY = "a1-aug15-photo-dogleg-exactly-two-fixed-support-columns-v1";
const STATIC_OWN_GATE_AUTHORITY = "57-static-bgl-source-pose-real-wall-registration-v10";
const MIN_REAL_WALL_DISTANCE_METERS = 2.9;
const MAX_REAL_WALL_DISTANCE_METERS = 5.8;
const ATTACHED_EVIDENCE_AUTHORITY = "a1-terminal-connection-attached-evidence-v1";
const EXACT_CAB_SURFACE_AUTHORITY = "a1-final-exact-cab-footprint-door-contact-v2";
const MAX_EXACT_CAB_SURFACE_DISTANCE_METERS = 0.06;

function requireReplace(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`${label}: expected verifier anchor is missing: ${before}`);
  return source.replace(before, after);
}

const exactCabSurfaceAcceptance = (datasetExpression, failureTarget = "geometryFailures.push") => {
  const d = datasetExpression;
  if (failureTarget === "throw") {
    return `  const cabDoorFacingVertexCount = numeric(${d}.inspectionAircraftCabDoorFacingVertexCount, 'Cab door-facing vertex count');\n  const cabDoorSurfaceDistanceMeters = numeric(${d}.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters, 'Cab door-facing surface distance');\n  const cabDoorMinimumHeightMeters = numeric(${d}.inspectionAircraftCabDoorMinimumHeightMeters, 'Cab door-facing minimum height');\n  const cabDoorMaximumHeightMeters = numeric(${d}.inspectionAircraftCabDoorMaximumHeightMeters, 'Cab door-facing maximum height');\n  if (\n    ${d}.inspectionAircraftCabDoorContactPlaneCovered !== 'true'\n    || ${d}.inspectionAircraftCabDoorLaterallyCovered !== 'true'\n    || ${d}.inspectionAircraftCabDoorVerticallyCovered !== 'true'\n    || cabDoorFacingVertexCount < 3\n    || cabDoorSurfaceDistanceMeters > ${MAX_EXACT_CAB_SURFACE_DISTANCE_METERS}\n    || cabDoorMinimumHeightMeters > 0.08\n    || cabDoorMaximumHeightMeters < -0.08\n  ) {\n    throw new Error(\`A1 exact fixed CRJ door is outside the final supplied Cab boarding surface: distance=\${cabDoorSurfaceDistanceMeters} plane=\${${d}.inspectionAircraftCabDoorContactPlaneCovered}, lateral=\${${d}.inspectionAircraftCabDoorLaterallyCovered}, vertical=\${${d}.inspectionAircraftCabDoorVerticallyCovered}, vertices=\${cabDoorFacingVertexCount}, height=[\${cabDoorMinimumHeightMeters},\${cabDoorMaximumHeightMeters}]\`);\n  }`;
  }
  return `  const cabDoorFacingVertexCount = finiteNumber(${d}.inspectionAircraftCabDoorFacingVertexCount);\n  const cabDoorSurfaceDistanceMeters = finiteNumber(${d}.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters);\n  const cabDoorMinimumHeightMeters = finiteNumber(${d}.inspectionAircraftCabDoorMinimumHeightMeters);\n  const cabDoorMaximumHeightMeters = finiteNumber(${d}.inspectionAircraftCabDoorMaximumHeightMeters);\n  if (\n    ${d}.inspectionAircraftCabDoorContactPlaneCovered !== 'true'\n    || ${d}.inspectionAircraftCabDoorLaterallyCovered !== 'true'\n    || ${d}.inspectionAircraftCabDoorVerticallyCovered !== 'true'\n    || cabDoorFacingVertexCount === null || cabDoorFacingVertexCount < 3\n    || cabDoorSurfaceDistanceMeters === null || cabDoorSurfaceDistanceMeters > ${MAX_EXACT_CAB_SURFACE_DISTANCE_METERS}\n    || cabDoorMinimumHeightMeters === null || cabDoorMinimumHeightMeters > 0.08\n    || cabDoorMaximumHeightMeters === null || cabDoorMaximumHeightMeters < -0.08\n  ) {\n    geometryFailures.push(\`A1 exact fixed CRJ door is outside the final supplied Cab boarding surface: distance=\${cabDoorSurfaceDistanceMeters} plane=\${${d}.inspectionAircraftCabDoorContactPlaneCovered}, lateral=\${${d}.inspectionAircraftCabDoorLaterallyCovered}, vertical=\${${d}.inspectionAircraftCabDoorVerticallyCovered}, vertices=\${cabDoorFacingVertexCount}, height=[\${cabDoorMinimumHeightMeters},\${cabDoorMaximumHeightMeters}]\`);\n  }`;
};

{
  const path = "scripts/verify-terminal4-fleet-visual.cjs";
  let source = fs.readFileSync(path, "utf8");
  source = source.replace(/const CURRENT_SUBVIEW_AUTHORITY = '[^']+';/, `const CURRENT_SUBVIEW_AUTHORITY = '${CAMERA_AUTHORITY}';`);
  source = source.replace(/const STATIC_OWN_GATE_AUTHORITY = '[^']+';/, `const STATIC_OWN_GATE_AUTHORITY = '${STATIC_OWN_GATE_AUTHORITY}';`);
  source = source.replace(
    /const MAXIMUM_(?:DEFERRED_A1_VERTICAL_ERROR_METERS|A1_DOOR_VERTICAL_ERROR_METERS) = [0-9.]+;/,
    `const EXACT_CAB_SURFACE_AUTHORITY = '${EXACT_CAB_SURFACE_AUTHORITY}';`,
  );

  const oldHorizontalBlock = `  const liveHorizontalError = finiteNumber(a1.inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters);\n  if (liveHorizontalError === null || liveHorizontalError > MAXIMUM_A1_LIVE_HORIZONTAL_ERROR_METERS) {\n    geometryFailures.push(\`A1 live visible door/Cab horizontal error is unacceptable while attached: \${a1.inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters} m\`);\n  }`;
  const surfaceHorizontalDiagnostic = `  // ${EXACT_CAB_SURFACE_AUTHORITY}-horizontal\n  // The old Cab representative point is not on the rounded aircraft-facing hood.\n  // Keep the checkpoint value, but source it from the nearest exact door-facing\n  // supplied Cab vertex; full plane/lateral/vertical coverage is checked below.\n  const liveHorizontalError = finiteNumber(a1.inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters);`;
  if (source.includes(oldHorizontalBlock)) source = source.replace(oldHorizontalBlock, surfaceHorizontalDiagnostic);
  else if (!source.includes(`${EXACT_CAB_SURFACE_AUTHORITY}-horizontal`)) throw new Error(`${path}: stale live horizontal Cab proxy block is missing`);

  const deferredVerticalBlock = `  const verticalError = finiteNumber(a1.inspectionAircraftDoorVerticalErrorMeters);\n  if (verticalError === null || Math.abs(verticalError) > MAXIMUM_DEFERRED_A1_VERTICAL_ERROR_METERS) {\n    geometryFailures.push(\`A1 deferred door-height gap escaped safe bounds: \${a1.inspectionAircraftDoorVerticalErrorMeters} m\`);\n  } else if (Math.abs(verticalError) > 0.5) {\n    deferredGeometry.push(\`A1 bridge lift remains deferred: vertical gap=\${verticalError.toFixed(3)} m; aircraft and exact bogie remain grounded.\`);\n  }`;
  const priorStrictVerticalBlock = `  const verticalError = finiteNumber(a1.inspectionAircraftDoorVerticalErrorMeters);\n  if (verticalError === null || Math.abs(verticalError) > MAXIMUM_A1_DOOR_VERTICAL_ERROR_METERS) {\n    geometryFailures.push(\`A1 visible door/Cab vertical error is unacceptable while attached: \${a1.inspectionAircraftDoorVerticalErrorMeters} m\`);\n  }`;
  const surfaceBlock = `  // ${EXACT_CAB_SURFACE_AUTHORITY}\n  // Representative-point X/Z/Y diagnostics are retired for acceptance on the\n  // rounded Cab. Judge the actual aircraft-facing supplied Cab vertex footprint.\n${exactCabSurfaceAcceptance("a1")}`;
  if (source.includes(priorStrictVerticalBlock)) source = source.replace(priorStrictVerticalBlock, surfaceBlock);
  else if (source.includes(deferredVerticalBlock)) source = source.replace(deferredVerticalBlock, surfaceBlock);
  else if (!source.includes(EXACT_CAB_SURFACE_AUTHORITY)) throw new Error(`${path}: Cab surface acceptance anchor is missing`);

  const a1PresetAnchor = `  await waitForPreset(page, 'a1Connection');`;
  const attachedEvidenceCall = `${a1PresetAnchor}\n\n  const attachedEvidenceState = await page.evaluate(() => {\n    const attach = window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__;\n    if (typeof attach !== 'function') throw new Error('A1 attached visual-evidence bridge is missing');\n    return attach();\n  });\n  if (attachedEvidenceState === 'not-ready') {\n    throw new Error('A1 attached visual-evidence bridge ran before the supplied jetway controller was ready');\n  }\n  await page.waitForFunction((authority) => (\n    document.querySelector('canvas.trainerCanvas')?.dataset?.a1InspectionAttachedEvidenceAuthority === authority\n  ), '${ATTACHED_EVIDENCE_AUTHORITY}', { timeout: 30000, polling: 100 });`;
  source = requireReplace(source, a1PresetAnchor, attachedEvidenceCall, path);

  for (const required of [
    CAMERA_AUTHORITY, STATIC_OWN_GATE_AUTHORITY, EXACT_CAB_SURFACE_AUTHORITY,
    "inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters",
    "inspectionAircraftCabDoorContactPlaneCovered", "inspectionAircraftCabDoorLaterallyCovered",
    "inspectionAircraftCabDoorVerticallyCovered", "inspectionAircraftCabDoorFacingVertexCount",
    "__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__", ATTACHED_EVIDENCE_AUTHORITY,
  ]) if (!source.includes(required)) throw new Error(`${path}: current photo visual verifier is missing ${required}`);
  for (const stale of [
    "A1 visible door/Cab vertical error is unacceptable while attached",
    "A1 live visible door/Cab horizontal error is unacceptable while attached",
  ]) if (source.includes(stale)) throw new Error(`${path}: stale representative-point Cab veto survived: ${stale}`);
  fs.writeFileSync(path, source, "utf8");
}

{
  const path = "scripts/verify-a1-terminal-joint-browser.cjs";
  let source = fs.readFileSync(path, "utf8");
  source = source.replace(/const CURRENT_SUBVIEW_AUTHORITY = '[^']+';/, `const CURRENT_SUBVIEW_AUTHORITY = '${CAMERA_AUTHORITY}';`);
  source = requireReplace(
    source,
    "const MAX_VISIBLE_TERMINAL_LEG_METERS = 6.0;",
    `const MIN_VISIBLE_TERMINAL_LEG_METERS = 6.0;\nconst MAX_VISIBLE_TERMINAL_LEG_METERS = 48.0;\nconst PHOTO_CONNECTOR_STYLE_AUTHORITY = '${PHOTO_CONNECTOR_STYLE_AUTHORITY}';`,
    path,
  );
  source = source.replace(
    /const MAX_A1_DOOR_VERTICAL_ERROR_METERS = [0-9.]+;\nconst MAX_BOGIE_CLEARANCE_METERS = 0\.015;/,
    `const EXACT_CAB_SURFACE_AUTHORITY = '${EXACT_CAB_SURFACE_AUTHORITY}';\nconst MAX_BOGIE_CLEARANCE_METERS = 0.015;`,
  );
  source = source.replace("const MAX_BOGIE_CLEARANCE_METERS = 0.015;", `const EXACT_CAB_SURFACE_AUTHORITY = '${EXACT_CAB_SURFACE_AUTHORITY}';\nconst MAX_BOGIE_CLEARANCE_METERS = 0.015;`);
  source = source.replace(
    `const EXACT_CAB_SURFACE_AUTHORITY = '${EXACT_CAB_SURFACE_AUTHORITY}';\nconst EXACT_CAB_SURFACE_AUTHORITY = '${EXACT_CAB_SURFACE_AUTHORITY}';`,
    `const EXACT_CAB_SURFACE_AUTHORITY = '${EXACT_CAB_SURFACE_AUTHORITY}';`,
  );
  source = source.replaceAll(
    "vestibule > 0.15 && vestibule < maxVisibleLeg",
    `vestibule >= 6 && vestibule <= maxVisibleLeg\n        && data?.terminal4UploadedJetwayA1ConnectorStyleAuthority === '${PHOTO_CONNECTOR_STYLE_AUTHORITY}'`,
  );
  source = source.replaceAll(
    "visibleLeg > 0.15 && visibleLeg < MAX_VISIBLE_TERMINAL_LEG_METERS",
    "visibleLeg >= MIN_VISIBLE_TERMINAL_LEG_METERS && visibleLeg <= MAX_VISIBLE_TERMINAL_LEG_METERS",
  );
  source = source.replace(
    "    throw new Error(`A1 terminal-side shell is implausibly long: ${visibleLeg} m`);",
    "    throw new Error(`A1 photo fixed terminal route is outside the 6-48 m authority: ${visibleLeg} m`);",
  );
  source = source
    .replace(/const MIN_REAL_WALL_DISTANCE_METERS = [0-9.]+;/, `const MIN_REAL_WALL_DISTANCE_METERS = ${MIN_REAL_WALL_DISTANCE_METERS};`)
    .replace(/const MAX_REAL_WALL_DISTANCE_METERS = [0-9.]+;/, `const MAX_REAL_WALL_DISTANCE_METERS = ${MAX_REAL_WALL_DISTANCE_METERS};`);

  const directWallAssertion = `  if (!(realWallDistance > MIN_REAL_WALL_DISTANCE_METERS && realWallDistance < MAX_REAL_WALL_DISTANCE_METERS)) {`;
  if (!source.includes(`terminal4UploadedJetwayA1ConnectorStyleAuthority !== PHOTO_CONNECTOR_STYLE_AUTHORITY`)) {
    if (!source.includes(directWallAssertion)) throw new Error(`${path}: direct A1 photo-route assertion anchor is missing`);
    source = source.replace(
      directWallAssertion,
      `  if (terminalData.terminal4UploadedJetwayA1ConnectorStyleAuthority !== PHOTO_CONNECTOR_STYLE_AUTHORITY) {\n    throw new Error(\`A1 long terminal route lacks the dogleg/exact-two-support photo authority: \${terminalData.terminal4UploadedJetwayA1ConnectorStyleAuthority}\`);\n  }\n${directWallAssertion}`,
    );
  }
  const wallAssertionBlock = `  if (!(realWallDistance > MIN_REAL_WALL_DISTANCE_METERS && realWallDistance < MAX_REAL_WALL_DISTANCE_METERS)) {\n    throw new Error(\`A1 transformed Rotunda-to-wall distance is outside the measured envelope: \${realWallDistance} m\`);\n  }`;
  const priorStrictDoorHeightBlock = `${wallAssertionBlock}\n  const doorVerticalError = numeric(terminalData.inspectionAircraftDoorVerticalErrorMeters, 'visible door/Cab vertical error');\n  if (Math.abs(doorVerticalError) > MAX_A1_DOOR_VERTICAL_ERROR_METERS) {\n    throw new Error(\`A1 visible door/Cab vertical error is unacceptable while attached: \${doorVerticalError} m\`);\n  }`;
  const strictSurfaceBlock = `${wallAssertionBlock}\n  // ${EXACT_CAB_SURFACE_AUTHORITY}\n${exactCabSurfaceAcceptance("terminalData", "throw")}`;
  if (source.includes(priorStrictDoorHeightBlock)) source = source.replace(priorStrictDoorHeightBlock, strictSurfaceBlock);
  else if (source.includes(wallAssertionBlock) && !source.includes("inspectionAircraftCabDoorVerticallyCovered")) source = source.replace(wallAssertionBlock, strictSurfaceBlock);
  source = source.replace(
    "vestibule=${dataset.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters || 'missing'} wall=",
    "fixedRoute=${dataset.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters || 'missing'} photo=${dataset.terminal4UploadedJetwayA1ConnectorStyleAuthority || 'missing'} wall=",
  );

  for (const stale of [
    "const MAX_VISIBLE_TERMINAL_LEG_METERS = 6.0;", "visibleLeg > 0.15 && visibleLeg < MAX_VISIBLE_TERMINAL_LEG_METERS",
    "vestibule > 0.15 && vestibule < maxVisibleLeg", "A1 visible door/Cab vertical error is unacceptable while attached", "MAX_A1_DOOR_VERTICAL_ERROR_METERS",
  ]) if (source.includes(stale)) throw new Error(`${path}: stale compact/representative-point A1 verifier remains: ${stale}`);
  for (const required of [
    CAMERA_AUTHORITY, PHOTO_CONNECTOR_STYLE_AUTHORITY, "const MIN_VISIBLE_TERMINAL_LEG_METERS = 6.0;",
    "const MAX_VISIBLE_TERMINAL_LEG_METERS = 48.0;", "visibleLeg >= MIN_VISIBLE_TERMINAL_LEG_METERS",
    "terminal4UploadedJetwayA1ConnectorStyleAuthority", `const MIN_REAL_WALL_DISTANCE_METERS = ${MIN_REAL_WALL_DISTANCE_METERS};`,
    `const MAX_REAL_WALL_DISTANCE_METERS = ${MAX_REAL_WALL_DISTANCE_METERS};`, EXACT_CAB_SURFACE_AUTHORITY,
    "inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters", "inspectionAircraftCabDoorContactPlaneCovered",
    "inspectionAircraftCabDoorLaterallyCovered", "inspectionAircraftCabDoorVerticallyCovered", "const MAX_BRANCH_VIEW_IMBALANCE = 0.20;",
  ]) if (!source.includes(required)) throw new Error(`${path}: photo-authoritative A1 verifier is missing ${required}`);
  fs.writeFileSync(path, source, "utf8");
}

console.log(`Prepared photo-authoritative visual verifiers: A1 requires ${PHOTO_CONNECTOR_STYLE_AUTHORITY}, a 6-48 m fixed dogleg route, the unchanged authored/source-local ${MIN_REAL_WALL_DISTANCE_METERS}-${MAX_REAL_WALL_DISTANCE_METERS} m Rotunda-to-BGATE1 facade telemetry envelope, and <=${MAX_EXACT_CAB_SURFACE_DISTANCE_METERS} m exact final supplied Cab door-facing physical contact under ${EXACT_CAB_SURFACE_AUTHORITY}; explicit attached evidence, balanced v5 apron camera, bogie and branch-visibility checks remain strict; static gates retain ${STATIC_OWN_GATE_AUTHORITY}.`);
