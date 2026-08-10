import fs from "node:fs";

// The static pose guard can only be correct if placement.yaw is actually the
// decoded KPHX BGL jetway heading. Run the source-heading registration first,
// late enough that it owns the scene that is actually bundled.
await import(`./prepare-terminal4-jetway-source-registration-v1.mjs?static-source-pose=${Date.now()}`);

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const REGISTRATION_AUTHORITY = "57-static-source-heading-real-wall-compact-registration-v8";
const COMPACT_VISIBLE_TERMINAL_LEG_METERS = 0.55;
const COMPACT_TERMINAL_WALL_OVERLAP_METERS = 0.18;
const MIN_VISIBLE_METERS = 0.25;
const MAX_VISIBLE_METERS = 1.25;
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
const compactSourceHeadingWallBlock = `  // Keep the decoded KPHX BGL HEADING, but register the complete rigid supplied
  // assembly to the measured real Terminal 4 wall. The prior source-position
  // lock was the live failure: it left some Rotundas tens of meters from the
  // facade and then manufactured giant white corridors (up to 43 m) to hide the
  // coordinate-frame mismatch. Move only the complete parent in X/Z; never
  // change a supplied child transform and never derive yaw from a synthetic CRJ.
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
  registration = registration.replace(relocatingBlock, compactSourceHeadingWallBlock);
} else if (!registration.includes("compact real-wall vestibule is invalid")) {
  throw new Error(`${registrationPath}: static wall-registration block is missing; refusing to guess at fleet geometry`);
}

const targetDerivedYawBlock = `  const bridgeDx = targetX - rotundaX;
  const bridgeDz = targetZ - rotundaZ;
  const bridgeDistance = Math.hypot(bridgeDx, bridgeDz);
  const targetHeading = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;
  const sourceBridgeAxisHeading = Number(authoredRotundaOffset.bridgeAxisHeadingRadians);
  if (!Number.isFinite(sourceBridgeAxisHeading)) throw new Error(\`Static jetway \${placement.gate} is missing exact supplied bridge-axis heading\`);
  const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);`;
const sourceHeadingBlock = `  const bridgeDx = targetX - rotundaX;
  const bridgeDz = targetZ - rotundaZ;
  const bridgeDistance = Math.hypot(bridgeDx, bridgeDz);
  // Preserve the decoded KPHX BGL heading. Position may be translated rigidly
  // to the measured facade, but a synthetic CRJ door target must never re-aim
  // the complete static jetway across a neighboring gate.
  const yaw = sourceYaw;`;
if (registration.includes(targetDerivedYawBlock)) {
  registration = registration.replace(targetDerivedYawBlock, sourceHeadingBlock);
} else if (!registration.includes("const yaw = sourceYaw;")) {
  throw new Error(`${registrationPath}: target-derived static yaw block is missing; refusing to guess at fleet heading`);
}

registration = registration
  .replace('const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.2;', `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`)
  .replace('const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.6;', `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`)
  .replace('const TARGET_VISIBLE_TERMINAL_LEG_METERS = 2.4;', `const TARGET_VISIBLE_TERMINAL_LEG_METERS = ${COMPACT_VISIBLE_TERMINAL_LEG_METERS};`)
  .replace('const AUTHORITY = "57-static-authored-rotundas-short-real-wall-registration-v5";', `const AUTHORITY = "${REGISTRATION_AUTHORITY}";`)
  .replace('const AUTHORITY = "57-static-bgl-position-locked-short-real-wall-registration-v6";', `const AUTHORITY = "${REGISTRATION_AUTHORITY}";`)
  .replace('const AUTHORITY = "57-static-bgl-pose-locked-short-real-wall-registration-v7";', `const AUTHORITY = "${REGISTRATION_AUTHORITY}";`);

for (const required of [
  `const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MIN_VISIBLE_METERS};`,
  `const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = ${MAX_VISIBLE_METERS};`,
  `const TARGET_VISIBLE_TERMINAL_LEG_METERS = ${COMPACT_VISIBLE_TERMINAL_LEG_METERS};`,
  `const AUTHORITY = "${REGISTRATION_AUTHORITY}";`,
  "const wallX = sourceX + ux * sourceWallDistance;",
  "const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;",
  "const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;",
  "const yaw = sourceYaw;",
  "compact real-wall vestibule is invalid",
]) {
  if (!registration.includes(required)) {
    throw new Error(`${registrationPath}: compact source-heading real-wall contract is missing ${required}`);
  }
}
for (const forbidden of [
  "source-locked wall fit would require an invalid visible terminal leg",
  "const resolvedRotundaCenterToWallMeters = sourceWallDistance;",
  "const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);",
  "57-static-bgl-pose-locked-short-real-wall-registration-v7",
]) {
  if (registration.includes(forbidden)) {
    throw new Error(`${registrationPath}: retired static source-position/target-yaw behavior survived: ${forbidden}`);
  }
}

fs.writeFileSync(registrationPath, registration, "utf8");
console.log(`Registered all 57 static exact jetways to the measured real Terminal 4 facade with a ${COMPACT_VISIBLE_TERMINAL_LEG_METERS} m fixed vestibule while preserving each decoded KPHX BGL heading. Giant synthetic corridors and CRJ-target re-aiming are now fail-closed.`);