import fs from "node:fs";

const CAMERA_AUTHORITY = "source-measured-a1-apron-side-evidence-camera-v5-balanced-branches";
const PHOTO_CONNECTOR_STYLE_AUTHORITY = "a1-aug15-photo-dogleg-exactly-two-fixed-support-columns-v1";
const STATIC_OWN_GATE_AUTHORITY = "57-static-bgl-source-pose-real-wall-registration-v10";
const MIN_REAL_WALL_DISTANCE_METERS = 8.5;
const MAX_REAL_WALL_DISTANCE_METERS = 15.5;

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
  for (const required of [CAMERA_AUTHORITY, STATIC_OWN_GATE_AUTHORITY]) {
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

  // The Aug. 15 A1 geometry now has a genuinely remote Rotunda. The old
  // 2.9-5.8 m value described the retired compact sleeve and is incompatible
  // with the same runtime geometry that is required to remain 8.5-15.5 m from
  // the real BGATE1 facade. Normalize the verifier to that physical envelope;
  // do not weaken the geometry itself.
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
  source = source.replace(
    "vestibule=${dataset.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters || 'missing'} wall=",
    "fixedRoute=${dataset.terminal4UploadedJetwayA1VisibleVestibuleLengthMeters || 'missing'} photo=${dataset.terminal4UploadedJetwayA1ConnectorStyleAuthority || 'missing'} wall=",
  );

  for (const stale of [
    "const MAX_VISIBLE_TERMINAL_LEG_METERS = 6.0;",
    "visibleLeg > 0.15 && visibleLeg < MAX_VISIBLE_TERMINAL_LEG_METERS",
    "vestibule > 0.15 && vestibule < maxVisibleLeg",
    "const MIN_REAL_WALL_DISTANCE_METERS = 2.9;",
    "const MAX_REAL_WALL_DISTANCE_METERS = 5.8;",
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
    "const MAX_BRANCH_VIEW_IMBALANCE = 0.20;",
  ]) {
    if (!source.includes(required)) throw new Error(`${path}: photo-authoritative A1 verifier is missing ${required}`);
  }
  fs.writeFileSync(path, source, "utf8");
}

console.log(`Prepared photo-authoritative visual verifiers: A1 requires ${PHOTO_CONNECTOR_STYLE_AUTHORITY}, a 6-48 m fixed dogleg route, the genuinely remote ${MIN_REAL_WALL_DISTANCE_METERS}-${MAX_REAL_WALL_DISTANCE_METERS} m Rotunda-to-BGATE1 facade envelope, the balanced v5 apron-side camera, and unchanged strict bogie/branch-visibility checks; static gates retain ${STATIC_OWN_GATE_AUTHORITY}.`);
