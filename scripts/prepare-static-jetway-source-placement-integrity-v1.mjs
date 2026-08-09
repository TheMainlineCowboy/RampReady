import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const registrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
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

// Keep the registration/readiness pass, but do not let it move or re-aim a
// package-authored static jetway to manufacture a short wall connection. The
// decoded KPHX BGL x/z/yaw values are the airport placement authority. A bad
// terminal-wall ray must fail closed so the wall fit can be corrected; moving
// or re-aiming the complete supplied parent visibly bunches/crosses neighboring
// bridges at concourse corners.
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
const sourceLockedBlock = `  // The decoded KPHX BGL x/z is the physical static-jetway placement authority.
  // Never translate a supplied jetway parent merely to force a short connector:
  // that was the source of crossed/bunched bridges in exact-head fleet renders.
  // Measure the real facade from the source Rotunda and fail closed if that wall
  // fit would require either an invented long corridor or a deep hidden overlap.
  const rotundaX = sourceX;
  const rotundaZ = sourceZ;
  const wallX = rotundaX + ux * sourceWallDistance;
  const wallZ = rotundaZ + uz * sourceWallDistance;
  const signedTerminalLegMeters = sourceWallDistance - authoredRotundaOffset.radiusMeters;
  const visibleTerminalLegMeters = Math.max(0, signedTerminalLegMeters);
  const terminalWallOverlapMeters = Math.max(0, -signedTerminalLegMeters);
  if (!(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS)) {
    throw new Error(\`Static jetway \${placement.gate} source-locked wall fit would require an invalid visible terminal leg: \${visibleTerminalLegMeters} m (wall=\${sourceWallDistance} m)\`);
  }
  if (!(terminalWallOverlapMeters >= 0 && terminalWallOverlapMeters < authoredRotundaOffset.radiusMeters)) {
    throw new Error(\`Static jetway \${placement.gate} source-locked wall fit would require an invalid Rotunda overlap: \${terminalWallOverlapMeters}\`);
  }
  const resolvedRotundaCenterToWallMeters = sourceWallDistance;`;

const trackedPoseLockedMarker = "real wall fit requires invalid visible terminal leg";
const legacyPoseLockedMarker = "source-locked wall fit would require an invalid visible terminal leg";
if (registration.includes(relocatingBlock)) {
  registration = registration.replace(relocatingBlock, sourceLockedBlock);
} else if (!registration.includes(trackedPoseLockedMarker) && !registration.includes(legacyPoseLockedMarker)) {
  throw new Error(`${registrationPath}: static relocation block is missing; refusing to guess at fleet geometry`);
}

const targetDerivedYawBlock = `  const bridgeDx = targetX - rotundaX;
  const bridgeDz = targetZ - rotundaZ;
  const bridgeDistance = Math.hypot(bridgeDx, bridgeDz);
  const targetHeading = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;
  const sourceBridgeAxisHeading = Number(authoredRotundaOffset.bridgeAxisHeadingRadians);
  if (!Number.isFinite(sourceBridgeAxisHeading)) throw new Error(\`Static jetway \${placement.gate} is missing exact supplied bridge-axis heading\`);
  const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);`;
const sourceLockedYawBlock = `  const bridgeDx = targetX - rotundaX;
  const bridgeDz = targetZ - rotundaZ;
  const bridgeDistance = Math.hypot(bridgeDx, bridgeDz);
  // The static fleet was originally instantiated directly with placement.yaw,
  // after the exact GLB prototype normalized its Rotunda to the parent origin
  // and its longitudinal axis to +Z. Preserve that decoded BGL heading exactly;
  // targetX/targetZ may describe an aircraft-door target but must never re-aim
  // the complete source jetway across a neighboring stand.
  const yaw = sourceYaw;`;
if (registration.includes(targetDerivedYawBlock)) {
  registration = registration.replace(targetDerivedYawBlock, sourceLockedYawBlock);
} else if (!registration.includes("const yaw = sourceYaw;")) {
  throw new Error(`${registrationPath}: target-derived static yaw block is missing; refusing to guess at fleet heading`);
}

registration = registration.replace(
  'const AUTHORITY = "57-static-authored-rotundas-short-real-wall-registration-v5";',
  'const AUTHORITY = "57-static-bgl-pose-locked-short-real-wall-registration-v7";',
);
registration = registration.replace(
  'const AUTHORITY = "57-static-bgl-position-locked-short-real-wall-registration-v6";',
  'const AUTHORITY = "57-static-bgl-pose-locked-short-real-wall-registration-v7";',
);

for (const required of [
  "const rotundaX = sourceX;",
  "const rotundaZ = sourceZ;",
  "const yaw = sourceYaw;",
  "const resolvedRotundaCenterToWallMeters = sourceWallDistance;",
  '57-static-bgl-pose-locked-short-real-wall-registration-v7',
]) {
  if (!registration.includes(required)) {
    throw new Error(`${registrationPath}: source-locked static fleet contract is missing ${required}`);
  }
}
if (!registration.includes(trackedPoseLockedMarker) && !registration.includes(legacyPoseLockedMarker)) {
  throw new Error(`${registrationPath}: source-locked static fleet contract is missing the fail-closed terminal-leg diagnostic`);
}
for (const forbidden of [
  "const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;",
  "const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;",
  "const targetHeading = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;",
  "const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);",
]) {
  if (registration.includes(forbidden)) {
    throw new Error(`${registrationPath}: static fleet relocation/re-aim survived source-pose lock: ${forbidden}`);
  }
}

fs.writeFileSync(registrationPath, registration, "utf8");
console.log("Locked all 57 static exact jetways to their decoded KPHX BGL x/z/yaw poses. Real-wall registration may add only a short measured vestibule; it now fails closed instead of relocating or re-aiming supplied parents across neighboring gates.");
