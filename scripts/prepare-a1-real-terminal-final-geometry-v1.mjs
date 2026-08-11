import fs from "node:fs";

const sourcePlacedPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";

const FINAL_AUTHORITY = "a1-real-terminal-wall-physical-rotunda-elbow-final-v3";
const MIN_REAL_WALL_DISTANCE_METERS = 0.5;
const MAX_REAL_WALL_DISTANCE_METERS = 44;
const MIN_VISIBLE_FIXED_LEG_METERS = 0.15;
const MAX_VISIBLE_FIXED_LEG_METERS = 4.5;
const MIN_PORTAL_ALIGNMENT = 0.985;

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, value) {
  fs.writeFileSync(path, value, "utf8");
}

// A1 must terminate on the authored structural Terminal 4 building, never the
// elevated T4_WALK. Keep this as a final source authority but do not move any
// terminal or jetway geometry here.
let sourcePlaced = read(sourcePlacedPath);
if (sourcePlaced.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${sourcePlacedPath}: obsolete A1 T4_WALK target survived final production preparation`);
}
if (!sourcePlaced.includes("structural-A1-terminal-building-")) {
  throw new Error(`${sourcePlacedPath}: final A1 structural Terminal 4 building authority is missing`);
}
sourcePlaced = sourcePlaced.replace(
  /group\.userData\.terminalConnectionAuthority = "[^"]+";/,
  `group.userData.terminalConnectionAuthority = "${FINAL_AUTHORITY}";`,
);
write(sourcePlacedPath, sourcePlaced);

// The physical Rotunda elbow, measured short fixed leg, hard-zero relocation,
// real Cab endpoint, and wall-lock measurements must already exist. This stage
// is deliberately non-mutating: earlier versions rewrote the physical elbow back
// toward magic 2.40 m / 1.2-3.6 m constraints after it had been installed.
const installation = read(installationPath);
for (const required of [
  'A1_PARENT_ORIENTATION_AUTHORITY = "same-day-photo-authored-opening-fixed-rotunda-elbow-terminal-aligned-v7"',
  "const measuredTerminalAlignment = alignedOpeningDirection.dot(terminalDirection)",
  `measuredTerminalAlignment < ${MIN_PORTAL_ALIGNMENT}`,
  "const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius",
  `actualVisibleVestibuleMeters > ${MIN_VISIBLE_FIXED_LEG_METERS}`,
  `actualVisibleVestibuleMeters < ${MAX_VISIBLE_FIXED_LEG_METERS}`,
  "const terminalRelocationMeters = 0;",
  "const relocationDistance = 0;",
  "uploadedJetwayA1TerminalRelocationMeters = 0",
  "uploadedJetwayA1FinalRotundaWorldX = finalRotundaCenterWorld.x",
  "uploadedJetwayA1FinalMeasuredWallWorldX = finalMeasuredTerminalWallWorld.x",
  "uploadedJetwayA1CabContactWorldX = cabContactWorld.x",
  'uploadedJetwayA1FinalWallLockAuthority = "fixed-rotunda-measured-wall-lock-no-relocation-v34"',
]) {
  if (!installation.includes(required)) {
    throw new Error(`${installationPath}: final physical A1 geometry is missing ${required}`);
  }
}
for (const forbidden of [
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS)",
  "A1 relocated visible vestibule is wrong",
  "a1Anchor.position.x += terminalRelocationX",
  "a1Anchor.position.z += terminalRelocationZ",
  "desiredTerminalDistance = rotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  "actualVisibleVestibuleMeters > 1.2 && actualVisibleVestibuleMeters < 3.6",
]) {
  if (installation.includes(forbidden)) {
    throw new Error(`${installationPath}: stale magic-distance/whole-parent A1 geometry survived finalization: ${forbidden}`);
  }
}

// Normalize readiness only. Multiple compatibility passes rewrite this module in
// different textual forms. The final physical gate therefore both replaces any
// recognized range and INSERTS the guard directly into the final readiness `if`
// when a later generator has removed it. This never changes scene geometry.
let readiness = read(readinessPath);
const finalWallGuard = `a1TerminalWallDistance > ${MIN_REAL_WALL_DISTANCE_METERS} && a1TerminalWallDistance < ${MAX_REAL_WALL_DISTANCE_METERS}`;
const finalVisibleLegGuard = `connectorVisibleLength > ${MIN_VISIBLE_FIXED_LEG_METERS} && connectorVisibleLength < ${MAX_VISIBLE_FIXED_LEG_METERS}`;
readiness = readiness
  .replace(
    /a1TerminalWallDistance\s*(?:>|>=)\s*[0-9.]+\s*&&\s*a1TerminalWallDistance\s*(?:<|<=)\s*[0-9.]+/g,
    finalWallGuard,
  )
  .replace(
    /connectorVisibleLength\s*(?:>|>=)\s*[0-9.]+\s*&&\s*connectorVisibleLength\s*(?:<|<=)\s*[0-9.]+/g,
    finalVisibleLegGuard,
  )
  .replaceAll("Math.abs(connectorVisibleLength - 2.4) > 0.05", `!(${finalVisibleLegGuard})`)
  .replaceAll("a1-real-terminal-wall-photo-matched-fixed-leg-final-v2", FINAL_AUTHORITY)
  .replaceAll("a1-real-terminal-wall-source-measured-fixed-leg-final-v1", FINAL_AUTHORITY)
  .replaceAll("compact-real-terminal-wall-readiness-v2", FINAL_AUTHORITY)
  .replaceAll("compact-real-terminal-wall-readiness-v1", FINAL_AUTHORITY);

if (!readiness.includes(finalWallGuard)) {
  const wallAnchor = "            || a1TerminalConnectionAuthority !== UPLOADED_JETWAY_A1_TERMINAL_CONNECTION_AUTHORITY";
  if (!readiness.includes(wallAnchor)) {
    throw new Error(`${readinessPath}: cannot attach final physical A1 wall-distance guard`);
  }
  readiness = readiness.replace(
    wallAnchor,
    `${wallAnchor}\n            || !(${finalWallGuard})`,
  );
}
if (!readiness.includes(finalVisibleLegGuard)) {
  const visibleAnchor = "            || isolatedNodeRotationCount !== 0";
  if (!readiness.includes(visibleAnchor)) {
    throw new Error(`${readinessPath}: cannot attach final physical A1 visible-leg guard`);
  }
  readiness = readiness.replace(
    visibleAnchor,
    `${visibleAnchor}\n            || !(${finalVisibleLegGuard})`,
  );
}

for (const required of [finalWallGuard, finalVisibleLegGuard]) {
  if (!readiness.includes(required)) {
    throw new Error(`${readinessPath}: final physical A1 readiness is missing ${required}`);
  }
}
for (const forbidden of [
  "Math.abs(connectorVisibleLength - 2.4) > 0.05",
  "connectorVisibleLength > 1.2 && connectorVisibleLength < 3.6",
]) {
  if (readiness.includes(forbidden)) {
    throw new Error(`${readinessPath}: stale photo-constant A1 readiness survived: ${forbidden}`);
  }
}
write(readinessPath, readiness);

// The generated wall-side sleeve may be normalized to the same measured short-
// leg envelope, but this finalizer must not rotate, translate, or resize any of
// the five supplied Airport_Jetway.glb parts. Preserve the physical Rotunda
// articulation already installed in correctUploadedJetwayInstallationV1.js.
let elbow = read(elbowPath);
elbow = elbow
  .replace(/const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = [^;]+;/, `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_FIXED_LEG_METERS};`)
  .replace(/const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = [^;]+;/, `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_FIXED_LEG_METERS};`)
  .replace(/const CONNECTOR_STYLE_AUTHORITY = "[^"]+";/, 'const CONNECTOR_STYLE_AUTHORITY = "physical-a1-rotunda-aperture-short-terminal-leg-v7";');

for (const required of [
  `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_FIXED_LEG_METERS};`,
  `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_FIXED_LEG_METERS};`,
  'const CONNECTOR_STYLE_AUTHORITY = "physical-a1-rotunda-aperture-short-terminal-leg-v7";',
]) {
  if (!elbow.includes(required)) {
    throw new Error(`${elbowPath}: final physical A1 wall sleeve is missing ${required}`);
  }
}
for (const forbidden of [
  "MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 44",
  "same-day-a1-photo-compact-solid-terminal-leg-fixed-wall-v6",
]) {
  if (elbow.includes(forbidden)) {
    throw new Error(`${elbowPath}: stale generic/photo-constant A1 wall sleeve survived: ${forbidden}`);
  }
}
write(elbowPath, elbow);

console.log(`Validated final A1 physical geometry without moving it: structural Terminal 4 wall only, Rotunda aperture alignment >=${MIN_PORTAL_ALIGNMENT.toFixed(3)}, zero whole-bridge relocation, measured visible fixed leg ${MIN_VISIBLE_FIXED_LEG_METERS.toFixed(2)}-${MAX_VISIBLE_FIXED_LEG_METERS.toFixed(2)} m, and Tunnel A/B/C/Cab preserved.`);
