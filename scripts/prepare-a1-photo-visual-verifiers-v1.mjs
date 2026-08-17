import fs from "node:fs";

const CAMERA_AUTHORITY = "source-measured-a1-apron-side-evidence-camera-v5-balanced-branches";
const PHOTO_CONNECTOR_STYLE_AUTHORITY = "a1-aug15-photo-dogleg-exactly-two-fixed-support-columns-v1";
const STATIC_OWN_GATE_AUTHORITY = "57-static-bgl-source-pose-real-wall-registration-v10";
const MIN_REAL_WALL_DISTANCE_METERS = 2.9;
const MAX_REAL_WALL_DISTANCE_METERS = 5.8;
const MAX_A1_DOOR_VERTICAL_ERROR_METERS = 0.25;
const ATTACHED_EVIDENCE_AUTHORITY = "a1-terminal-connection-attached-evidence-v1";

function requireReplace(source, before, after, label) {
  if (source.includes(after)) return source;
  if (!source.includes(before)) throw new Error(`${label}: expected verifier anchor is missing: ${before}`);
  return source.replace(before, after);
}

{
  const path = "scripts/verify-terminal4-fleet-visual.cjs";
  let source = fs.readFileSync(path, "utf8");
  source = source.replace(
    /const CURRENT_SUBVIEW_AUTHORITY = '[^']+';/,
    `const CURRENT_SUBVIEW_AUTHORITY = '${CAMERA_AUTHORITY}';`,
  );
  source = source.replace(
    /const STATIC_OWN_GATE_AUTHORITY = '[^']+';/,
    `const STATIC_OWN_GATE_AUTHORITY = '${STATIC_OWN_GATE_AUTHORITY}';`,
  );
  source = requireReplace(
    source,
    "const MAXIMUM_DEFERRED_A1_VERTICAL_ERROR_METERS = 6;",
    `const MAXIMUM_A1_DOOR_VERTICAL_ERROR_METERS = ${MAX_A1_DOOR_VERTICAL_ERROR_METERS};`,
    path,
  );
  const deferredVerticalBlock = `  const verticalError = finiteNumber(a1.inspectionAircraftDoorVerticalErrorMeters);\n  if (verticalError === null || Math.abs(verticalError) > MAXIMUM_DEFERRED_A1_VERTICAL_ERROR_METERS) {\n    geometryFailures.push(\`A1 deferred door-height gap escaped safe bounds: \${a1.inspectionAircraftDoorVerticalErrorMeters} m\`);\n  } else if (Math.abs(verticalError) > 0.5) {\n    deferredGeometry.push(\`A1 bridge lift remains deferred: vertical gap=\${verticalError.toFixed(3)} m; aircraft and exact bogie remain grounded.\`);\n  }`;
  const strictVerticalBlock = `  const verticalError = finiteNumber(a1.inspectionAircraftDoorVerticalErrorMeters);\n  if (verticalError === null || Math.abs(verticalError) > MAXIMUM_A1_DOOR_VERTICAL_ERROR_METERS) {\n    geometryFailures.push(\`A1 visible door/Cab vertical error is unacceptable while attached: \${a1.inspectionAircraftDoorVerticalErrorMeters} m\`);\n  }`;
  source = requireReplace(source, deferredVerticalBlock, strictVerticalBlock, path);

  const a1PresetAnchor = `  await waitForPreset(page, 'a1Connection');`;
  const attachedEvidenceCall = `${a1PresetAnchor}\n\n  const attachedEvidenceState = await page.evaluate(() => {\n    const attach = window.__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__;\n    if (typeof attach !== 'function') throw new Error('A1 attached visual-evidence bridge is missing');\n    return attach();\n  });\n  if (attachedEvidenceState === 'not-ready') {\n    throw new Error('A1 attached visual-evidence bridge ran before the supplied jetway controller was ready');\n  }\n  await page.waitForFunction((authority) => (\n    document.querySelector('canvas.trainerCanvas')?.dataset?.a1InspectionAttachedEvidenceAuthority === authority\n  ), '${ATTACHED_EVIDENCE_AUTHORITY}', { timeout: 30000, polling: 100 });`;
  source = requireReplace(source, a1PresetAnchor, attachedEvidenceCall, path);

  for (const required of [
    CAMERA_AUTHORITY,
    STATIC_OWN_GATE_AUTHORITY,
    `const MAXIMUM_A1_DOOR_VERTICAL_ERROR_METERS = ${MAX_A1_DOOR_VERTICAL_ERROR_METERS};`,
    "A1 visible door/Cab vertical error is unacceptable while attached",
    "__RAMPREADY_VISUAL_EVIDENCE_ATTACH_A1__",
    ATTACHED_EVIDENCE_AUTHORITY,
  ]) {
    if (!source.includes(required)) throw new Error(`${path}: current photo visual verifier is missing ${required}`);
  }
  fs.writeFileSync(path, source, "utf8");
}

{
  const path = "scripts/verify-a1-terminal-joint-browser.cjs";
  let source = fs.readFileSync(path, "utf8");
  source = source.replace(
    /const CURRENT_SUBVIEW_AUTHORITY = '[^']+';/,
    `const CURRENT_SUBVIEW_AUTHORITY = '${CAMERA_AUTHORITY}';`,
  );
  source = requireReplace(
    source,
    "const MAX_VISIBLE_TERMINAL_LEG_METERS = 6.0;",
    `const MIN_VISIBLE_TERMINAL_LEG_METERS = 6.0;\nconst MAX_VISIBLE_TERMINAL_LEG_METERS = 48.0;\nconst PHOTO_CONNECTOR_STYLE_AUTHORITY = '${PHOTO_CONNECTOR_STYLE_AUTHORITY}';`,
    path,
  );
  source = requireReplace(
    source,
    "const MAX_BOGIE_CLEARANCE_METERS = 0.015;",
    `const MAX_A1_DOOR_VERTICAL_ERROR_METERS = ${MAX_A1_DOOR_VERTICAL_ERROR_METERS};\nconst MAX_BOGIE_CLEARANCE_METERS = 0.015;`,
    path,
  );
  source = source.replaceAll(
    "vestibule > 0.15 && vestibule < maxVisibleLeg",
    `vestibule >= ${6.0} && vestibule <= maxVisibleLeg\n        && data?.terminal4UploadedJetwayA1ConnectorStyleAuthority === '${PHOTO_CONNECTOR_STYLE_AUTHORITY}'`,
  );
  source = source.replaceAll(
    "visibleLeg > 0.15 && visibleLeg < MAX_VISIBLE_TERMINAL_LEG_METERS",
    "visibleLeg >= MIN_VISIBLE_TERMINAL_LEG_METERS && visibleLeg <= MAX_VISIBLE_TERMINAL_LEG_METERS",
  );
  source = source.replace(
    "    throw new Error(`A1 terminal-side shell is implausibly long: ${visibleLeg} m`);",
    "    throw new Error(`A1 photo fixed terminal route is outside the 6-48 m authority: ${visibleLeg} m`);",
  );

  // Keep these two measurements separate. The Aug. 15 photo-authoritative fixed
  // corridor/dogleg is validated by terminal4UploadedJetwayA1VisibleVestibuleLengthMeters
  // plus PHOTO_CONNECTOR_STYLE_AUTHORITY. terminal4A1JetwayWallDistance remains the
  // authored movable-jetway Rotunda's local/source relation to the measured BGATE1 facade;
  // forcing the long fixed-corridor span onto that legacy/source-local field makes
  // a correct 18 m dogleg fail despite the rendered geometry being photo-consistent.
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
  const strictDoorHeightBlock = `${wallAssertionBlock}\n  const doorVerticalError = numeric(terminalData.inspectionAircraftDoorVerticalErrorMeters, 'visible door/Cab vertical error');\n  if (Math.abs(doorVerticalError) > MAX_A1_DOOR_VERTICAL_ERROR_METERS) {\n    throw new Error(\`A1 visible door/Cab vertical error is unacceptable while attached: \${doorVerticalError} m\`);\n  }`;
  source = requireReplace(source, wallAssertionBlock, strictDoorHeightBlock, path);
  source = source.replace(
    "vestibule=${dataset.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters || 'missing'} wall=",
    "fixedRoute=${dataset.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters || 'missing'} photo=${dataset.terminal4UploadedJetwayA1ConnectorStyleAuthority || 'missing'} wall=",
  );

  for (const stale of [
    "const MAX_VISIBLE_TERMINAL_LEG_METERS = 6.0;",
    "visibleLeg > 0.15 && visibleLeg < MAX_VISIBLE_TERMINAL_LEG_METERS",
    "vestibule > 0.15 && vestibule < maxVisibleLeg",
  ]) {
    if (source.includes(stale)) throw new Error(`${path}: stale compact-A1 verifier remains: ${stale}`);
  }
  for (const required of [
    CAMERA_AUTHORITY,
    PHOTO_CONNECTOR_STYLE_AUTHORITY,
    "const MIN_VISIBLE_TERMINAL_LEG_METERS = 6.0;",
    "const MAX_VISIBLE_TERMINAL_LEG_METERS = 48.0;",
    "visibleLeg >= MIN_VISIBLE_TERMINAL_LEG_METERS",
    "terminal4UploadedJetwayA1ConnectorStyleAuthority",
    `const MIN_REAL_WALL_DISTANCE_METERS = ${MIN_REAL_WALL_DISTANCE_METERS};`,
    `const MAX_REAL_WALL_DISTANCE_METERS = ${MAX_REAL_WALL_DISTANCE_METERS};`,
    `const MAX_A1_DOOR_VERTICAL_ERROR_METERS = ${MAX_A1_DOOR_VERTICAL_ERROR_METERS};`,
    "inspectionAircraftDoorVerticalErrorMeters",
    "A1 visible door/Cab vertical error is unacceptable while attached",
    "const MAX_BRANCH_VIEW_IMBALANCE = 0.20;",
  ]) {
    if (!source.includes(required)) throw new Error(`${path}: photo-authoritative A1 verifier is missing ${required}`);
  }
  fs.writeFileSync(path, source, "utf8");
}

console.log(`Prepared photo-authoritative visual verifiers: A1 requires ${PHOTO_CONNECTOR_STYLE_AUTHORITY}, a 6-48 m fixed dogleg route, the unchanged authored/source-local ${MIN_REAL_WALL_DISTANCE_METERS}-${MAX_REAL_WALL_DISTANCE_METERS} m Rotunda-to-BGATE1 facade telemetry envelope, <=${MAX_A1_DOOR_VERTICAL_ERROR_METERS} m attached visible door/Cab vertical error, explicit attached evidence via ${ATTACHED_EVIDENCE_AUTHORITY}, the balanced v5 apron-side camera, and unchanged strict bogie/branch-visibility checks; static gates retain ${STATIC_OWN_GATE_AUTHORITY}.`);
