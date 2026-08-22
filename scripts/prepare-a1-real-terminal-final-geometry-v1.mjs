import fs from "node:fs";

const sourcePlacedPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";

const FINAL_AUTHORITY = "a1-real-terminal-wall-photo-matched-fixed-leg-final-v2";
const MAX_REAL_WALL_DISTANCE_METERS = 5.8;
const MIN_REAL_WALL_DISTANCE_METERS = 2.9;
const MIN_VISIBLE_FIXED_LEG_METERS = 1.2;
const MAX_VISIBLE_FIXED_LEG_METERS = 3.6;
const LIVE_FIT_AUTHORITY = "a1-final-visible-fleet-ready-physical-door-fit-v1";

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

// The supplied Rotunda stays intact, but the same-day A1 photos and overhead do
// not show a tens-of-meters generated corridor. Keep this historical compact-wall
// stage bounded; the later Aug. 15 photo-dogleg stage deliberately replaces this
// envelope with the long two-leg fixed route immediately before the final bundle.
let installation = read(installationPath);
installation = replaceAllKnown(
  installation,
  [
    "actualVisibleVestibuleMeters > 0.15 && actualVisibleVestibuleMeters < 44",
    "actualVisibleVestibuleMeters > 0.15 && actualVisibleVestibuleMeters < 12",
    "actualVisibleVestibuleMeters > 0.25 && actualVisibleVestibuleMeters < 12",
    "actualVisibleVestibuleMeters > 1.2 && actualVisibleVestibuleMeters < 3.6",
  ],
  `actualVisibleVestibuleMeters > ${MIN_VISIBLE_FIXED_LEG_METERS} && actualVisibleVestibuleMeters < ${MAX_VISIBLE_FIXED_LEG_METERS}`,
);
installation = replaceAllKnown(
  installation,
  [
    "visibleLength > 0.15 && visibleLength < 44",
    "visibleLength > 0.15 && visibleLength < 12",
    "visibleLength > 0.25 && visibleLength < 12",
    "visibleLength > 1.2 && visibleLength < 3.6",
  ],
  `visibleLength > ${MIN_VISIBLE_FIXED_LEG_METERS} && visibleLength < ${MAX_VISIBLE_FIXED_LEG_METERS}`,
);
installation = installation.replaceAll(
  "terminalDistance > rotundaOpening.collarRadius + 0.15 && terminalDistance < 44",
  `terminalDistance > rotundaOpening.collarRadius + ${MIN_VISIBLE_FIXED_LEG_METERS} && terminalDistance < ${MAX_REAL_WALL_DISTANCE_METERS}`,
);
installation = installation.replaceAll(
  "terminalDistance > rotundaOpening.collarRadius + 0.25 && terminalDistance < 12",
  `terminalDistance > rotundaOpening.collarRadius + ${MIN_VISIBLE_FIXED_LEG_METERS} && terminalDistance < ${MAX_REAL_WALL_DISTANCE_METERS}`,
);
installation = installation.replaceAll(
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05",
  `!(actualVisibleVestibuleMeters > ${MIN_VISIBLE_FIXED_LEG_METERS} && actualVisibleVestibuleMeters < ${MAX_VISIBLE_FIXED_LEG_METERS})`,
);
installation = installation.replaceAll(
  'same-day-a1-photo-source-measured-terminal-vestibule-v15',
  'same-day-a1-photo-compact-solid-terminal-leg-final-v16',
);
installation = installation.replaceAll(
  'same-day-a1-photo-visible-solid-terminal-vestibule-v12',
  'same-day-a1-photo-compact-solid-terminal-leg-final-v16',
);
installation = installation.replaceAll(
  'same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1',
  'exact-rotunda-surface-small-bellows-joint-v2',
);
installation = installation.replaceAll(
  "A1 source-measured visible vestibule is physically invalid",
  "A1 photo-matched fixed terminal leg is physically invalid",
);
installation = installation.replaceAll(
  "A1 source-measured fixed terminal leg is physically invalid",
  "A1 photo-matched fixed terminal leg is physically invalid",
);
installation = installation.replaceAll(
  "A1 measured terminal vestibule span is invalid",
  "A1 photo-matched fixed terminal leg is invalid",
);
for (const forbidden of [
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05",
  "Math.abs(connectorVisibleLength - 2.4) > 0.05",
  "actualVisibleVestibuleMeters > 0.15 && actualVisibleVestibuleMeters < 44",
  "visibleLength > 0.15 && visibleLength < 44",
  "const rotundaOverlap = 1.1",
  "TERMINAL_HIDDEN_OVERLAP_METERS = 0.75",
  "UploadedAirportJetwayA1TerminalSolidBulkhead",
]) {
  if (installation.includes(forbidden)) {
    throw new Error(`${installationPath}: obsolete long/masking A1 geometry survived finalization: ${forbidden}`);
  }
}
for (const required of [
  `actualVisibleVestibuleMeters > ${MIN_VISIBLE_FIXED_LEG_METERS} && actualVisibleVestibuleMeters < ${MAX_VISIBLE_FIXED_LEG_METERS}`,
  "same-day-a1-photo-compact-solid-terminal-leg-final-v16",
  "exact-rotunda-surface-small-bellows-joint-v2",
  "const rotundaOverlap = 0.12",
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18",
]) {
  if (!installation.includes(required)) {
    throw new Error(`${installationPath}: final photo-matched A1 geometry is missing ${required}`);
  }
}
write(installationPath, installation);

// Readiness must reject the compact-stage wall/Rotunda regression while also
// accepting the current runtime architecture, where the physical V11 Cab fit is
// performed directly on the visible fleet-ready path after source-integrity
// validation. Do not depend on one historical shape of the big mismatch `if`.
let readiness = read(readinessPath);
const finalWallGuard = `a1TerminalWallDistance > ${MIN_REAL_WALL_DISTANCE_METERS} && a1TerminalWallDistance < ${MAX_REAL_WALL_DISTANCE_METERS}`;
const finalVisibleLegGuard = `connectorVisibleLength > ${MIN_VISIBLE_FIXED_LEG_METERS} && connectorVisibleLength < ${MAX_VISIBLE_FIXED_LEG_METERS}`;
readiness = replaceAllKnown(
  readiness,
  [
    "a1TerminalWallDistance > 0.5 && a1TerminalWallDistance < 44",
    "a1TerminalWallDistance > 2.9 && a1TerminalWallDistance < 5.8",
    "a1TerminalWallDistance >= 2.9 && a1TerminalWallDistance <= 5.8",
    "a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 12",
    "a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 28",
    "a1TerminalWallDistance > 1.5 && a1TerminalWallDistance < 4.1",
  ],
  finalWallGuard,
);
readiness = readiness.replace(
  /a1TerminalWallDistance\s*(?:>|>=)\s*[0-9.]+\s*&&\s*a1TerminalWallDistance\s*(?:<|<=)\s*[0-9.]+/g,
  finalWallGuard,
);
readiness = replaceAllKnown(
  readiness,
  [
    "connectorVisibleLength > 0.15 && connectorVisibleLength < 44",
    "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
    "connectorVisibleLength > 0.25 && connectorVisibleLength < 28",
    "connectorVisibleLength > 1.2 && connectorVisibleLength < 3.6",
  ],
  finalVisibleLegGuard,
);
readiness = readiness.replace(
  /connectorVisibleLength\s*(?:>|>=)\s*[0-9.]+\s*&&\s*connectorVisibleLength\s*(?:<|<=)\s*[0-9.]+/g,
  finalVisibleLegGuard,
);
readiness = readiness.replaceAll(
  "Math.abs(connectorVisibleLength - 2.4) > 0.05",
  `!(${finalVisibleLegGuard})`,
);
readiness = readiness.replaceAll(
  'same-day-a1-photo-source-measured-terminal-vestibule-v15',
  'same-day-a1-photo-compact-solid-terminal-leg-final-v16',
);
readiness = readiness.replaceAll(
  'same-day-a1-photo-visible-solid-terminal-vestibule-v12',
  'same-day-a1-photo-compact-solid-terminal-leg-final-v16',
);
readiness = readiness.replaceAll(
  'same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1',
  'exact-rotunda-surface-small-bellows-joint-v2',
);
readiness = readiness.replaceAll("compact-real-terminal-wall-readiness-v2", FINAL_AUTHORITY);
readiness = readiness.replaceAll("compact-real-terminal-wall-readiness-v1", FINAL_AUTHORITY);
readiness = readiness.replaceAll("a1-real-terminal-wall-source-measured-fixed-leg-final-v1", FINAL_AUTHORITY);

const missingPhysicalConditions = [
  !readiness.includes(finalWallGuard) ? `!(${finalWallGuard})` : null,
  !readiness.includes(finalVisibleLegGuard) ? `!(${finalVisibleLegGuard})` : null,
].filter(Boolean);
if (missingPhysicalConditions.length) {
  const mismatchAnchors = [
    "          if (\n            count !== EXPECTED_GATE_COUNT",
    "          if (\n            count !== placements.length",
    "          if (\n            count !== 58",
  ];
  const mismatchAnchor = mismatchAnchors.find((anchor) => readiness.includes(anchor));
  if (mismatchAnchor) {
    readiness = readiness.replace(
      mismatchAnchor,
      `          if (\n            ${missingPhysicalConditions.join("\n            || ")}\n            || ${mismatchAnchor.split("            ")[1]}`,
    );
  } else {
    const liveFitAnchor = "          const finalVisibleFit = fitUploadedA1JetwayToRenderedCrjDoor(THREE, group, fleet, placements);";
    const liveFitContract = [
      liveFitAnchor,
      `const FINAL_VISIBLE_FIT_AUTHORITY = "${LIVE_FIT_AUTHORITY}";`,
      "if (!(Math.abs(finalVisibleFit.verticalGapMeters) <= 0.08))",
      "controller.bind(a1Anchor);",
      "controller.setDeployment(1);",
    ];
    for (const required of liveFitContract) {
      if (!readiness.includes(required)) {
        throw new Error(`${readinessPath}: final visible A1 physical-fit path is missing ${required}`);
      }
    }
    const explicitGuard = `          if (${missingPhysicalConditions.join("\n            || ")}) {\n            throw new Error(\`A1 compact-stage wall/leg physical guard failed before final visible fit: wall=\${a1TerminalWallDistance} leg=\${connectorVisibleLength}\`);\n          }\n\n${liveFitAnchor}`;
    readiness = readiness.replace(liveFitAnchor, explicitGuard);
  }
}

for (const forbidden of [
  "Math.abs(connectorVisibleLength - 2.4) > 0.05",
  "a1TerminalWallDistance > 0.5 && a1TerminalWallDistance < 44",
  "connectorVisibleLength > 0.15 && connectorVisibleLength < 44",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
]) {
  if (readiness.includes(forbidden)) {
    throw new Error(`${readinessPath}: long-corridor A1 readiness survived: ${forbidden}`);
  }
}
for (const required of [finalWallGuard, finalVisibleLegGuard]) {
  if (!readiness.includes(required)) {
    throw new Error(`${readinessPath}: final photo-matched readiness is missing ${required}`);
  }
}
if (readiness.includes("fitUploadedA1JetwayToRenderedCrjDoor")) {
  for (const required of [
    `const FINAL_VISIBLE_FIT_AUTHORITY = "${LIVE_FIT_AUTHORITY}";`,
    "if (!(Math.abs(finalVisibleFit.verticalGapMeters) <= 0.08))",
    "controller.bind(a1Anchor);",
    "controller.setDeployment(1);",
  ]) {
    if (!readiness.includes(required)) throw new Error(`${readinessPath}: live A1 physical-fit guard is missing ${required}`);
  }
}
write(readinessPath, readiness);

// The final wall/Rotunda elbow owns the visible geometry after readiness. Keep
// the supplied Rotunda untouched and constrain only the generated terminal-side
// leg to the same envelope already authored from the A1 photo registration.
let elbow = read(elbowPath);
elbow = elbow
  .replace(/const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = [^;]+;/, `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_FIXED_LEG_METERS};`)
  .replace(/const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = [^;]+;/, `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_FIXED_LEG_METERS};`)
  .replace(/const CONNECTOR_STYLE_AUTHORITY = "[^"]+";/, 'const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-compact-solid-terminal-leg-fixed-wall-v6";')
  .replace(/const TERMINAL_HIDDEN_OVERLAP_METERS = [^;]+;/, "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;")
  .replace(/const ROTUNDA_SHELL_OVERLAP_METERS = [^;]+;/, "const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;");
elbow = replaceAllKnown(
  elbow,
  [
    "terminalWallDistance >= 0.5 && terminalWallDistance <= 44",
    "terminalWallDistance >= 2.9 && terminalWallDistance <= 5.8",
    "terminalWallDistance > 2.9 && terminalWallDistance < 5.8",
  ],
  `terminalWallDistance >= ${MIN_REAL_WALL_DISTANCE_METERS} && terminalWallDistance <= ${MAX_REAL_WALL_DISTANCE_METERS}`,
);
elbow = elbow.replace(
  /terminalWallDistance\s*(?:>|>=)\s*[0-9.]+\s*&&\s*terminalWallDistance\s*(?:<|<=)\s*[0-9.]+/g,
  `terminalWallDistance >= ${MIN_REAL_WALL_DISTANCE_METERS} && terminalWallDistance <= ${MAX_REAL_WALL_DISTANCE_METERS}`,
);
elbow = elbow.replaceAll(
  "A1 authored wall-to-Rotunda fixed terminal leg is outside the real-wall range",
  "A1 authored wall-to-Rotunda visible vestibule is outside the same-day photo range",
);
for (const forbidden of [
  "MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 44",
  "MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 0.15",
  "terminalWallDistance >= 0.5 && terminalWallDistance <= 44",
  "source-measured-real-terminal-fixed-leg-authored-rotunda-v5",
  "TERMINAL_HIDDEN_OVERLAP_METERS = 0.70",
]) {
  if (elbow.includes(forbidden)) {
    throw new Error(`${elbowPath}: long-corridor A1 elbow constraint survived: ${forbidden}`);
  }
}
for (const required of [
  `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_FIXED_LEG_METERS};`,
  `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_FIXED_LEG_METERS};`,
  `terminalWallDistance >= ${MIN_REAL_WALL_DISTANCE_METERS} && terminalWallDistance <= ${MAX_REAL_WALL_DISTANCE_METERS}`,
  "same-day-a1-photo-compact-solid-terminal-leg-fixed-wall-v6",
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;",
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;",
]) {
  if (!elbow.includes(required)) {
    throw new Error(`${elbowPath}: final photo-matched A1 elbow is missing ${required}`);
  }
}
write(elbowPath, elbow);

console.log(`Finalized A1 compact-stage wall guard with live fleet-ready V11 compatibility: no T4_WALK target, wall distance ${MIN_REAL_WALL_DISTANCE_METERS}-${MAX_REAL_WALL_DISTANCE_METERS} m, visible terminal leg ${MIN_VISIBLE_FIXED_LEG_METERS}-${MAX_VISIBLE_FIXED_LEG_METERS} m, exact supplied Rotunda preserved, live Cab fit/rebind required when present, and only 0.18/0.12 m hidden seam overlaps.`);