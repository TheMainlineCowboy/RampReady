import fs from "node:fs";

// Keep the decoded BGL heading as provenance, but do not let it own the final
// aircraft-side bridge direction. The live fleet evidence showed that several
// raw source headings do not point at their own stand after the replacement GLB
// is normalized and the Rotunda is registered to the real Terminal 4 facade.
// Run the source-registration pass first so we retain that evidence, then make
// the final rigid-parent yaw point from the registered Rotunda to THIS gate's
// authored CRJ forward-left door target.
await import(`./prepare-terminal4-jetway-source-registration-v1.mjs?static-source-pose=${Date.now()}`);

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const REGISTRATION_AUTHORITY = "57-static-own-gate-target-real-wall-compact-registration-v9";
const COMPACT_VISIBLE_TERMINAL_LEG_METERS = 0.55;
const COMPACT_TERMINAL_WALL_OVERLAP_METERS = 0.18;
const MIN_VISIBLE_METERS = 0.25;
const MAX_VISIBLE_METERS = 1.25;
const MAXIMUM_OWN_GATE_HEADING_ERROR_RADIANS = 0.002;
let source = fs.readFileSync(readinessPath, "utf8");

const baseFleetImport = 'import { installUploadedAirportJetwayFleet as installUploadedAirportJetwayFleetBase } from "./uploadedAirportJetwayFleet.js";';
const legacyRegistrationImport = 'import { registerStaticJetwayFleetToFacade } from "./registerStaticJetwayFleetToFacadeV1.js";';
const registrationImport = `import {
  registerStaticJetwayFleetToFacade,
  STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY,
  STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY,
  STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY,
} from "./registerStaticJetwayFleetToFacadeV1.js";`;
const installationCall = "          const installationCorrection = correctUploadedJetwayInstallation(THREE, group, fleet, placements);";
const registrationCall = "          const staticFleetRegistration = registerStaticJetwayFleetToFacade(THREE, group, fleet, placements);";

if (source.includes(legacyRegistrationImport)) {
  source = source.replace(legacyRegistrationImport, registrationImport);
}
if (!source.includes(registrationImport)) {
  if (!source.includes(baseFleetImport)) {
    throw new Error(`${readinessPath}: base fleet import anchor is missing`);
  }
  source = source.replace(baseFleetImport, `${baseFleetImport}\n${registrationImport}`);
}

const obsoleteStart = "          // Static jetways are already authored at the exact KPHX BGL gate coordinates.";
const obsoleteEnd = "          group.userData.uploadedJetwayStaticFacadeRelocationApplied = false;";
if (source.includes(obsoleteStart)) {
  const start = source.indexOf(obsoleteStart);
  const endStart = source.indexOf(obsoleteEnd, start);
  if (endStart < 0) throw new Error(`${readinessPath}: obsolete static-placement override is incomplete`);
  const end = endStart + obsoleteEnd.length;
  source = `${source.slice(0, start)}${registrationCall}${source.slice(end)}`;
}
if (!source.includes(registrationCall)) {
  if (!source.includes(installationCall)) {
    throw new Error(`${readinessPath}: installation-correction anchor is missing`);
  }
  source = source.replace(installationCall, `${installationCall}\n${registrationCall}`);
}

for (const required of [
  registrationImport,
  "STATIC_JETWAY_FACADE_REGISTRATION_AUTHORITY",
  "STATIC_JETWAY_GROUND_ISOLATION_AUTHORITY",
  "STATIC_JETWAY_MODEL_ROOT_OFFSET_AUTHORITY",
  registrationCall,
]) {
  if (!source.includes(required)) {
    throw new Error(`${readinessPath}: measured static terminal-wall registration is missing ${required}`);
  }
}
fs.writeFileSync(readinessPath, source, "utf8");

let registration = fs.readFileSync(registrationPath, "utf8");
const relocatingBlock = `  // Preserve the measured real facade point, not the stale Rotunda position.
  // The old registration left the supplied Rotunda at the raw BGL point and
  // filled the entire remaining distance with a fabricated white corridor.
  // Instead move the complete rigid authored assembly toward the real wall so
  // every static gate has the same compact photo-style wall -> vestibule ->
  // Rotunda relationship as A1. No supplied child transform is changed.
  const wallX = sourceX + ux * sourceWallDistance;
  const wallZ = sourceZ + uz * sourceWallDistance;
  const visibleTerminalLegMeters = TARGET_VISIBLE_TERMINAL_LEG_METERS;
  if (!(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS)) {
    throw new Error(\`Static jetway \${placement.gate} compact visible terminal vestibule is invalid: \${visibleTerminalLegMeters}\`);
  }
  const terminalWallOverlapMeters = 0;
  const resolvedRotundaCenterToWallMeters = authoredRotundaOffset.radiusMeters + visibleTerminalLegMeters;
  const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;
  const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;`;
const compactRealWallBlock = `  // Register the complete rigid supplied assembly to the measured real
  // Terminal 4 wall. Generated geometry is limited to the short wall sleeve;
  // the replacement jetway itself stays the exact supplied GLB.
  const wallX = sourceX + ux * sourceWallDistance;
  const wallZ = sourceZ + uz * sourceWallDistance;
  const visibleTerminalLegMeters = ${COMPACT_VISIBLE_TERMINAL_LEG_METERS};
  const terminalWallOverlapMeters = ${COMPACT_TERMINAL_WALL_OVERLAP_METERS};
  if (!(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS)) {
    throw new Error(\`Static jetway \${placement.gate} compact real-wall vestibule is invalid: \${visibleTerminalLegMeters}\`);
  }
  const resolvedRotundaCenterToWallMeters = authoredRotundaOffset.radiusMeters
    + visibleTerminalLegMeters - terminalWallOverlapMeters;
  const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;
  const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;`;

if (registration.includes(relocatingBlock)) {
  registration = registration.replace(relocatingBlock, compactRealWallBlock);
} else if (!registration.includes("compact real-wall vestibule is invalid")) {
  throw new Error(`${registrationPath}: static wall-registration block is missing; refusing to guess at fleet geometry`);
}

// prepare-terminal4-jetway-source-registration-v1 preserves the raw BGL heading
// and currently leaves a final `yaw = sourceYaw`. That produced the visible
// crossed/sideways fleet. Keep its source-vs-target delta telemetry, but make the
// actual rendered parent use the target registration yaw for its OWN gate.
const sourceYawAssignment = "  const yaw = sourceYaw;";
const targetYawAssignment = "  const yaw = targetRegistrationYaw;";
if (registration.includes(sourceYawAssignment)) {
  registration = registration.replace(sourceYawAssignment, targetYawAssignment);
} else if (registration.includes("  const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);")) {
  registration = registration.replace(
    "  const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);",
    `  const targetRegistrationYaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);\n  const sourceHeadingTargetDeltaRadians = Math.abs(wrapYaw(THREE, targetRegistrationYaw - sourceYaw));\n  const yaw = targetRegistrationYaw;`,
  );
} else if (!registration.includes(targetYawAssignment)) {
  throw new Error(`${registrationPath}: own-gate target yaw anchor is missing; refusing to guess at fleet heading`);
}

const yawValidationAnchor = "  const rotatedRotundaOffset = new THREE.Vector3(authoredRotundaOffset.x, 0, authoredRotundaOffset.z)";
const yawValidationBlock = `  const resolvedBridgeHeading = wrapYaw(THREE, yaw + sourceBridgeAxisHeading);
  const ownGateHeadingErrorRadians = Math.abs(wrapYaw(THREE, resolvedBridgeHeading - targetHeading));
  if (ownGateHeadingErrorRadians > ${MAXIMUM_OWN_GATE_HEADING_ERROR_RADIANS}) {
    throw new Error(\`Static jetway \${placement.gate} is not aimed at its own gate target: \${ownGateHeadingErrorRadians} rad\`);
  }
  const bridgeUnitX = bridgeDx / bridgeDistance;
  const bridgeUnitZ = bridgeDz / bridgeDistance;
  const terminalFacingDot = bridgeUnitX * ux + bridgeUnitZ * uz;
  if (terminalFacingDot > 0.25) {
    throw new Error(\`Static jetway \${placement.gate} points back toward the terminal instead of its own stand: dot=\${terminalFacingDot}\`);
  }

${yawValidationAnchor}`;
if (!registration.includes("const ownGateHeadingErrorRadians")) {
  if (!registration.includes(yawValidationAnchor)) {
    throw new Error(`${registrationPath}: own-gate yaw validation anchor is missing`);
  }
  registration = registration.replace(yawValidationAnchor, yawValidationBlock);
}

const returnAnchor = "    staticFacadeRegistrationYawChangeRadians: yawChange,";
const returnPatch = `${returnAnchor}
    staticOwnGateHeadingErrorRadians: ownGateHeadingErrorRadians,
    staticTerminalFacingDot: terminalFacingDot,`;
if (!registration.includes("staticOwnGateHeadingErrorRadians:")) {
  if (!registration.includes(returnAnchor)) throw new Error(`${registrationPath}: own-gate telemetry return anchor is missing`);
  registration = registration.replace(returnAnchor, returnPatch);
}

const aggregateAnchor = "  const maximumYawChange = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticFacadeRegistrationYawChangeRadians));";
const aggregatePatch = `${aggregateAnchor}
  const maximumOwnGateHeadingError = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticOwnGateHeadingErrorRadians));
  const maximumTerminalFacingDot = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticTerminalFacingDot));`;
if (!registration.includes("maximumOwnGateHeadingError")) {
  if (!registration.includes(aggregateAnchor)) throw new Error(`${registrationPath}: own-gate telemetry aggregate anchor is missing`);
  registration = registration.replace(aggregateAnchor, aggregatePatch);
}

const telemetryAnchor = "  group.userData.uploadedJetwayStaticFacadeMaximumYawChangeRadians = maximumYawChange;";
const telemetryPatch = `${telemetryAnchor}
  group.userData.uploadedJetwayStaticOwnGateTargetAuthority = "${REGISTRATION_AUTHORITY}";
  group.userData.uploadedJetwayStaticOwnGateTargetCount = 57;
  group.userData.uploadedJetwayStaticMaximumOwnGateHeadingErrorRadians = maximumOwnGateHeadingError;
  group.userData.uploadedJetwayStaticMaximumTerminalFacingDot = maximumTerminalFacingDot;`;
if (!registration.includes("uploadedJetwayStaticOwnGateTargetAuthority")) {
  if (!registration.includes(telemetryAnchor)) throw new Error(`${registrationPath}: own-gate browser telemetry anchor is missing`);
  registration = registration.replace(telemetryAnchor, telemetryPatch);
}

registration = registration
  .replace('const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.2;', `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`)
  .replace('const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.6;', `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`)
  .replace('const TARGET_VISIBLE_TERMINAL_LEG_METERS = 2.4;', `const TARGET_VISIBLE_TERMINAL_LEG_METERS = ${COMPACT_VISIBLE_TERMINAL_LEG_METERS};`)
  .replace('const AUTHORITY = "57-static-authored-rotundas-short-real-wall-registration-v5";', `const AUTHORITY = "${REGISTRATION_AUTHORITY}";`)
  .replace('const AUTHORITY = "57-static-bgl-position-locked-short-real-wall-registration-v6";', `const AUTHORITY = "${REGISTRATION_AUTHORITY}";`)
  .replace('const AUTHORITY = "57-static-bgl-pose-locked-short-real-wall-registration-v7";', `const AUTHORITY = "${REGISTRATION_AUTHORITY}";`)
  .replace('const AUTHORITY = "57-static-source-heading-real-wall-compact-registration-v8";', `const AUTHORITY = "${REGISTRATION_AUTHORITY}";`);

for (const required of [
  `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`,
  `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`,
  `const TARGET_VISIBLE_TERMINAL_LEG_METERS = ${COMPACT_VISIBLE_TERMINAL_LEG_METERS};`,
  `const AUTHORITY = "${REGISTRATION_AUTHORITY}";`,
  "const wallX = sourceX + ux * sourceWallDistance;",
  "const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;",
  "const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;",
  "const yaw = targetRegistrationYaw;",
  "const ownGateHeadingErrorRadians",
  "uploadedJetwayStaticOwnGateTargetCount = 57",
  "compact real-wall vestibule is invalid",
]) {
  if (!registration.includes(required)) {
    throw new Error(`${registrationPath}: compact own-gate real-wall contract is missing ${required}`);
  }
}

const retiredSourceLockMessage = "source-locked wall fit would require" + " an invalid visible terminal leg";
const retiredSourceDistanceAssignment = "const resolvedRotundaCenterToWallMeters = " + "sourceWallDistance;";
for (const forbidden of [
  retiredSourceLockMessage,
  retiredSourceDistanceAssignment,
  "const yaw = sourceYaw;",
  "57-static-bgl-pose-locked-short-real-wall-registration-v7",
]) {
  if (registration.includes(forbidden)) {
    throw new Error(`${registrationPath}: retired static source-position/source-yaw behavior survived: ${forbidden}`);
  }
}

fs.writeFileSync(registrationPath, registration, "utf8");
console.log(`Registered all 57 static exact jetways to the measured real Terminal 4 facade with a ${COMPACT_VISIBLE_TERMINAL_LEG_METERS} m fixed vestibule and aimed every aircraft-side bridge at its own authored gate target. Raw BGL headings remain telemetry only; crossed-stand source-yaw ownership is fail-closed.`);
