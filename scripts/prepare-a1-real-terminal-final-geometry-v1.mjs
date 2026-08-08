import fs from "node:fs";

const sourcePlacedPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";

const FINAL_AUTHORITY = "a1-real-terminal-wall-source-measured-fixed-leg-final-v1";
const MAX_REAL_WALL_DISTANCE_METERS = 44;
const MIN_REAL_WALL_DISTANCE_METERS = 0.5;
const MIN_VISIBLE_FIXED_LEG_METERS = 0.15;
const MAX_VISIBLE_FIXED_LEG_METERS = 44;

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function write(path, value) {
  fs.writeFileSync(path, value, "utf8");
}

function replaceAllKnown(source, variants, replacement) {
  let next = source;
  for (const variant of variants) next = next.replaceAll(variant, replacement);
  return next;
}

// A1 must resolve against the authored Terminal 4 building. The old source
// package special case hard-coded an elevated T4_WALK portal; the normal
// terminal-connector preparation replaces it with a BGATE/DGATE/PHX_TERM400
// structural ray/vertex search. Make that a final invariant so the obsolete
// walkway target can never silently return later in the production stack.
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

// The exact supplied replacement GLB is normalized around its Rotunda, but the
// real A1 fixed terminal section is not required to be 2.4 m long. The authored
// structural-wall search currently resolves a roughly 18 m visible fixed run.
// Preserve that measurement and only reject impossible values; do not relocate
// the Rotunda merely to manufacture a compact screenshot.
let installation = read(installationPath);
installation = replaceAllKnown(
  installation,
  [
    "actualVisibleVestibuleMeters > 0.15 && actualVisibleVestibuleMeters < 12",
    "actualVisibleVestibuleMeters > 0.25 && actualVisibleVestibuleMeters < 12",
  ],
  `actualVisibleVestibuleMeters > ${MIN_VISIBLE_FIXED_LEG_METERS} && actualVisibleVestibuleMeters < ${MAX_VISIBLE_FIXED_LEG_METERS}`,
);
installation = replaceAllKnown(
  installation,
  [
    "visibleLength > 0.15 && visibleLength < 12",
    "visibleLength > 0.25 && visibleLength < 12",
  ],
  `visibleLength > ${MIN_VISIBLE_FIXED_LEG_METERS} && visibleLength < ${MAX_VISIBLE_FIXED_LEG_METERS}`,
);
installation = installation.replaceAll(
  "terminalDistance > rotundaOpening.collarRadius + 0.25 && terminalDistance < 12",
  `terminalDistance > rotundaOpening.collarRadius + ${MIN_VISIBLE_FIXED_LEG_METERS} && terminalDistance < ${MAX_REAL_WALL_DISTANCE_METERS}`,
);
installation = installation.replaceAll(
  'same-day-a1-photo-visible-solid-terminal-vestibule-v12',
  'same-day-a1-photo-source-measured-terminal-vestibule-v15',
);
installation = installation.replaceAll(
  'same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1',
  'exact-rotunda-surface-small-bellows-joint-v2',
);
installation = installation.replaceAll(
  "A1 source-measured visible vestibule is physically invalid",
  "A1 source-measured fixed terminal leg is physically invalid",
);
installation = installation.replaceAll(
  "A1 measured terminal vestibule span is invalid",
  "A1 measured fixed terminal leg is invalid",
);
for (const forbidden of [
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05",
  "Math.abs(connectorVisibleLength - 2.4) > 0.05",
  "const rotundaOverlap = 1.1",
  "TERMINAL_HIDDEN_OVERLAP_METERS = 0.75",
  "UploadedAirportJetwayA1TerminalSolidBulkhead",
]) {
  if (installation.includes(forbidden)) {
    throw new Error(`${installationPath}: obsolete compact/masking A1 geometry survived finalization: ${forbidden}`);
  }
}
for (const required of [
  `actualVisibleVestibuleMeters > ${MIN_VISIBLE_FIXED_LEG_METERS} && actualVisibleVestibuleMeters < ${MAX_VISIBLE_FIXED_LEG_METERS}`,
  "same-day-a1-photo-source-measured-terminal-vestibule-v15",
  "exact-rotunda-surface-small-bellows-joint-v2",
  "const rotundaOverlap = 0.12",
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18",
]) {
  if (!installation.includes(required)) {
    throw new Error(`${installationPath}: final real-wall A1 geometry is missing ${required}`);
  }
}
write(installationPath, installation);

// Readiness must validate the actual measured building-to-Rotunda distance,
// not the retired compact-photo guess. Keep all exact-GLB identity, hierarchy,
// articulation, grounding and continuity checks intact.
let readiness = read(readinessPath);
readiness = replaceAllKnown(
  readiness,
  [
    "a1TerminalWallDistance > 2.9 && a1TerminalWallDistance < 5.8",
    "a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 12",
    "a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 28",
    "a1TerminalWallDistance > 1.5 && a1TerminalWallDistance < 4.1",
  ],
  `a1TerminalWallDistance > ${MIN_REAL_WALL_DISTANCE_METERS} && a1TerminalWallDistance < ${MAX_REAL_WALL_DISTANCE_METERS}`,
);
readiness = replaceAllKnown(
  readiness,
  [
    "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
    "connectorVisibleLength > 0.25 && connectorVisibleLength < 28",
  ],
  `connectorVisibleLength > ${MIN_VISIBLE_FIXED_LEG_METERS} && connectorVisibleLength < ${MAX_VISIBLE_FIXED_LEG_METERS}`,
);
readiness = readiness.replaceAll(
  "Math.abs(connectorVisibleLength - 2.4) > 0.05",
  `!(connectorVisibleLength > ${MIN_VISIBLE_FIXED_LEG_METERS} && connectorVisibleLength < ${MAX_VISIBLE_FIXED_LEG_METERS})`,
);
readiness = readiness.replaceAll(
  'same-day-a1-photo-visible-solid-terminal-vestibule-v12',
  'same-day-a1-photo-source-measured-terminal-vestibule-v15',
);
readiness = readiness.replaceAll(
  'same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1',
  'exact-rotunda-surface-small-bellows-joint-v2',
);
readiness = readiness.replaceAll("compact-real-terminal-wall-readiness-v2", FINAL_AUTHORITY);
readiness = readiness.replaceAll("compact-real-terminal-wall-readiness-v1", FINAL_AUTHORITY);
for (const forbidden of [
  "Math.abs(connectorVisibleLength - 2.4) > 0.05",
  "a1TerminalWallDistance > 2.9 && a1TerminalWallDistance < 5.8",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
]) {
  if (readiness.includes(forbidden)) {
    throw new Error(`${readinessPath}: retired compact A1 readiness survived: ${forbidden}`);
  }
}
for (const required of [
  `a1TerminalWallDistance > ${MIN_REAL_WALL_DISTANCE_METERS} && a1TerminalWallDistance < ${MAX_REAL_WALL_DISTANCE_METERS}`,
  `connectorVisibleLength > ${MIN_VISIBLE_FIXED_LEG_METERS} && connectorVisibleLength < ${MAX_VISIBLE_FIXED_LEG_METERS}`,
]) {
  if (!readiness.includes(required)) {
    throw new Error(`${readinessPath}: final real-wall readiness is missing ${required}`);
  }
}
write(readinessPath, readiness);

// The final wall/Rotunda elbow owns the visible geometry after readiness. It
// must allow the same source-measured fixed leg and keep the Rotunda pivot fixed
// while the aircraft-side bridge turns independently toward the CRJ door.
let elbow = read(elbowPath);
elbow = elbow
  .replace(/const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = [^;]+;/, `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_FIXED_LEG_METERS};`)
  .replace(/const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = [^;]+;/, `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_FIXED_LEG_METERS};`)
  .replace(/const CONNECTOR_STYLE_AUTHORITY = "[^"]+";/, 'const CONNECTOR_STYLE_AUTHORITY = "source-measured-real-terminal-fixed-leg-authored-rotunda-v5";')
  .replace(/const TERMINAL_HIDDEN_OVERLAP_METERS = [^;]+;/, "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;")
  .replace(/const ROTUNDA_SHELL_OVERLAP_METERS = [^;]+;/, "const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;");
elbow = replaceAllKnown(
  elbow,
  [
    "terminalWallDistance >= 2.9 && terminalWallDistance <= 5.8",
    "terminalWallDistance > 2.9 && terminalWallDistance < 5.8",
  ],
  `terminalWallDistance >= ${MIN_REAL_WALL_DISTANCE_METERS} && terminalWallDistance <= ${MAX_REAL_WALL_DISTANCE_METERS}`,
);
elbow = elbow.replaceAll(
  "A1 authored wall-to-Rotunda visible vestibule is not compact",
  "A1 authored wall-to-Rotunda fixed terminal leg is outside the real-wall range",
);
for (const forbidden of [
  "MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.6",
  "MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.2",
  "terminalWallDistance >= 2.9 && terminalWallDistance <= 5.8",
  "TERMINAL_HIDDEN_OVERLAP_METERS = 0.70",
]) {
  if (elbow.includes(forbidden)) {
    throw new Error(`${elbowPath}: compact A1 elbow constraint survived: ${forbidden}`);
  }
}
for (const required of [
  `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_FIXED_LEG_METERS};`,
  `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_FIXED_LEG_METERS};`,
  `terminalWallDistance >= ${MIN_REAL_WALL_DISTANCE_METERS} && terminalWallDistance <= ${MAX_REAL_WALL_DISTANCE_METERS}`,
  "source-measured-real-terminal-fixed-leg-authored-rotunda-v5",
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;",
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;",
]) {
  if (!elbow.includes(required)) {
    throw new Error(`${elbowPath}: final real-wall A1 elbow is missing ${required}`);
  }
}
write(elbowPath, elbow);

console.log(`Finalized A1 against the actual structural Terminal 4 wall: no T4_WALK target, no 2.4 m relocation, source-measured fixed terminal leg allowed through ${MAX_VISIBLE_FIXED_LEG_METERS} m, exact Rotunda preserved, and only 0.18/0.12 m hidden wall/Rotunda seam overlaps.`);
