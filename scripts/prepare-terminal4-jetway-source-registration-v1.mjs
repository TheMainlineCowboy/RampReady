import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const staticRegistrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const SOURCE_REGISTRATION_AUTHORITY = "exact-terminal4-jetway-source-local-under-parent-offset-v2";
const STATIC_SOURCE_HEADING_AUTHORITY = "57-static-bgl-jetway-heading-preserved-v1";
let source = fs.readFileSync(jetwayPath, "utf8");

// The source-placed jetway GROUP already owns the KPHX +6.2 m Z world offset:
//   group.position.fromArray(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset)
// Therefore each exact Airport_Jetway.glb clone must remain in the original
// BGL-local x/z coordinates. The terminal-wall search is performed against the
// world-positioned terminal and correctly adds sourceOffsetZ to its ray origin;
// applying that same offset to a child placement would double-shift the model.
const unregisteredPlacement = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw,
      targetX,
      targetZ,`;
const sourceLocalPlacement = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw: jetway.g === "A1" ? yaw : sourceJetwayYaw,
      targetX,
      targetZ,
      sourceJetwayHeadingDegrees: Number(jetway.h),
      sourceJetwayYawRadians: sourceJetwayYaw,
      sourceHeadingAuthority: jetway.g === "A1" ? "a1-photo-registered-animated-exception" : "${STATIC_SOURCE_HEADING_AUTHORITY}",`;

// Repair any transient v1 double-offset form before applying the source-local
// authority. This keeps the preparer idempotent even when invoked more than once
// during the production migration stack.
source = source
  .replace("      z: jetway.z + sourceOffsetZ,", "      z: jetway.z,")
  .replace("      targetZ: targetZ + sourceOffsetZ,", "      targetZ,")
  .replace(/      sourceRegistrationAuthority: "exact-terminal4-jetway-source-registration-plus-6p2z-v1",\n/g, "");

// Legacy FSX heading h is expressed clockwise from north in the source airport
// frame. After the terminal's reflected 90-degree axis conversion, the supplied
// bridge's browser +Z longitudinal yaw is 180deg-h. Across all 58 decoded source
// records this tracks the original bridge-to-stand direction (46/58 within 15deg,
// 55/58 within 30deg); the corner outliers are exactly the authored elbow cases
// that must NOT be flattened to a CRJ door vector.
const yawAnchor = "    const yaw = Math.atan2(ux, uz);";
const yawPatch = `    const yaw = Math.atan2(ux, uz);
    const sourceJetwayHeadingDegrees = Number(jetway.h);
    if (!Number.isFinite(sourceJetwayHeadingDegrees)) {
      throw new Error(\`Jetway \${jetway.g} is missing its decoded KPHX BGL heading\`);
    }
    const sourceJetwayYaw = THREE.MathUtils.degToRad(180 - sourceJetwayHeadingDegrees);
    const sourceJetwayForwardX = Math.sin(sourceJetwayYaw);
    const sourceJetwayForwardZ = Math.cos(sourceJetwayYaw);
    const terminalPreferredX = jetway.g === "A1" ? -ux : -sourceJetwayForwardX;
    const terminalPreferredZ = jetway.g === "A1" ? -uz : -sourceJetwayForwardZ;`;
if (!source.includes("const sourceJetwayYaw = THREE.MathUtils.degToRad(180 - sourceJetwayHeadingDegrees);")) {
  if (!source.includes(yawAnchor)) throw new Error(`${jetwayPath}: source bridge yaw anchor is missing`);
  source = source.replace(yawAnchor, yawPatch);
}

const oldTerminalRay = `      -ux,
      -uz,
      rotundaY,`;
const sourceHeadingTerminalRay = `      terminalPreferredX,
      terminalPreferredZ,
      rotundaY,`;
if (source.includes(oldTerminalRay)) source = source.replace(oldTerminalRay, sourceHeadingTerminalRay);

source = source
  .replace("    const connectorTowardX = terminalConnection?.towardX ?? -ux;", "    const connectorTowardX = terminalConnection?.towardX ?? terminalPreferredX;")
  .replace("    const connectorTowardZ = terminalConnection?.towardZ ?? -uz;", "    const connectorTowardZ = terminalConnection?.towardZ ?? terminalPreferredZ;");

if (!source.includes(SOURCE_REGISTRATION_AUTHORITY)) {
  if (!source.includes(unregisteredPlacement)) {
    throw new Error(`${jetwayPath}: exact uploaded jetway source-local placement anchor is missing`);
  }
  source = source.replace(unregisteredPlacement, sourceLocalPlacement);
} else if (!source.includes(STATIC_SOURCE_HEADING_AUTHORITY)) {
  const registeredPlacement = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw,
      targetX,
      targetZ,
      sourceRegistrationAuthority: "${SOURCE_REGISTRATION_AUTHORITY}",`;
  const upgradedPlacement = `${sourceLocalPlacement}
      sourceRegistrationAuthority: "${SOURCE_REGISTRATION_AUTHORITY}",`;
  if (!source.includes(registeredPlacement)) {
    throw new Error(`${jetwayPath}: registered placement block is missing for source-heading upgrade`);
  }
  source = source.replace(registeredPlacement, upgradedPlacement);
}

// A1 must never be redirected to the elevated T4_WALK. Earlier source code had
// a hard-coded exactWalkwayPortalX override which could make telemetry claim a
// connection while the supplied bridge visibly ran underneath the walkway.
const obsoleteWalkwayBlock = /\n    if \(jetway\.g === "A1"\) \{\n      const exactWalkwayPortalX = -30\.16857013;[\s\S]*?authority: "exact-T4_WALK-A1-terminal-portal-v25",\n      \}\);\n    \}/;
if (obsoleteWalkwayBlock.test(source)) source = source.replace(obsoleteWalkwayBlock, "");

if (source.includes("exact-T4_WALK-A1-terminal-portal-v25") || source.includes("exactWalkwayPortalX")) {
  throw new Error(`${jetwayPath}: obsolete A1 elevated-walkway targeting is still present`);
}

for (const token of [
  `group.position.fromArray(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset)`,
  `const sourceOffsetZ = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset[2]`,
  `jetway.z + sourceOffsetZ`,
  `z: jetway.z,`,
  `targetZ,`,
  SOURCE_REGISTRATION_AUTHORITY,
  STATIC_SOURCE_HEADING_AUTHORITY,
  "sourceJetwayHeadingDegrees",
  "sourceJetwayYawRadians",
  "terminalPreferredX",
  "terminalPreferredZ",
  'yaw: jetway.g === "A1" ? yaw : sourceJetwayYaw',
]) {
  if (!source.includes(token)) {
    throw new Error(`${jetwayPath}: source-local/source-heading registration contract is missing ${token}`);
  }
}
for (const forbidden of [
  "z: jetway.z + sourceOffsetZ,",
  "targetZ: targetZ + sourceOffsetZ,",
  "exact-terminal4-jetway-source-registration-plus-6p2z-v1",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${jetwayPath}: double-applied jetway world offset remains: ${forbidden}`);
  }
}
fs.writeFileSync(jetwayPath, source, "utf8");

// The wall-registration pass may translate each replacement GLB parent so its
// authored Rotunda sits at the correct terminal wall, but it must not rotate a
// rigid static bridge away from the source BGL heading merely to point at a CRJ
// parking-door target. A1 is not processed by this static routine.
let staticRegistration = fs.readFileSync(staticRegistrationPath, "utf8");
const targetYawLine = "  const yaw = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;";
const preservedYawBlock = `  const targetYaw = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;
  const yaw = sourceYaw;
  const sourceHeadingTargetDeltaRadians = Math.abs(wrapYaw(THREE, targetYaw - sourceYaw));`;
if (!staticRegistration.includes("const sourceHeadingTargetDeltaRadians")) {
  if (!staticRegistration.includes(targetYawLine)) {
    throw new Error(`${staticRegistrationPath}: static target-yaw anchor is missing`);
  }
  staticRegistration = staticRegistration.replace(targetYawLine, preservedYawBlock);
}

const returnedAuthorityAnchor = `    staticFacadeRegistrationYawChangeRadians: yawChange,
    staticFacadeWallErrorMeters: wallError,`;
const returnedAuthorityPatch = `    staticFacadeRegistrationYawChangeRadians: yawChange,
    staticSourceHeadingTargetDeltaRadians: sourceHeadingTargetDeltaRadians,
    staticSourceHeadingAuthority: "${STATIC_SOURCE_HEADING_AUTHORITY}",
    staticFacadeWallErrorMeters: wallError,`;
if (!staticRegistration.includes("staticSourceHeadingTargetDeltaRadians:")) {
  if (!staticRegistration.includes(returnedAuthorityAnchor)) {
    throw new Error(`${staticRegistrationPath}: static registration return anchor is missing`);
  }
  staticRegistration = staticRegistration.replace(returnedAuthorityAnchor, returnedAuthorityPatch);
}

const aggregateAnchor = `  const maximumYawChange = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticFacadeRegistrationYawChangeRadians));`;
const aggregatePatch = `${aggregateAnchor}
  const maximumSourceHeadingTargetDelta = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticSourceHeadingTargetDeltaRadians));`;
if (!staticRegistration.includes("maximumSourceHeadingTargetDelta")) {
  if (!staticRegistration.includes(aggregateAnchor)) {
    throw new Error(`${staticRegistrationPath}: static yaw aggregate anchor is missing`);
  }
  staticRegistration = staticRegistration.replace(aggregateAnchor, aggregatePatch);
}

const errorAnchor = `  if (maximumWallError > 1e-6) throw new Error(\`Static Rotunda facade registration wall error is \${maximumWallError}\`);`;
const errorPatch = `  if (maximumYawChange > 1e-8) throw new Error(\`Static source-heading preservation changed a rigid bridge yaw by \${maximumYawChange} rad\`);
${errorAnchor}`;
if (!staticRegistration.includes("Static source-heading preservation changed a rigid bridge yaw")) {
  if (!staticRegistration.includes(errorAnchor)) throw new Error(`${staticRegistrationPath}: static wall error anchor is missing`);
  staticRegistration = staticRegistration.replace(errorAnchor, errorPatch);
}

const telemetryAnchor = `  group.userData.uploadedJetwayStaticFacadeMaximumYawChangeRadians = maximumYawChange;`;
const telemetryPatch = `${telemetryAnchor}
  group.userData.uploadedJetwayStaticSourceHeadingAuthority = "${STATIC_SOURCE_HEADING_AUTHORITY}";
  group.userData.uploadedJetwayStaticSourceHeadingPreservedGateCount = 57;
  group.userData.uploadedJetwayStaticMaximumSourceHeadingTargetDeltaRadians = maximumSourceHeadingTargetDelta;`;
if (!staticRegistration.includes("uploadedJetwayStaticSourceHeadingAuthority")) {
  if (!staticRegistration.includes(telemetryAnchor)) throw new Error(`${staticRegistrationPath}: static yaw telemetry anchor is missing`);
  staticRegistration = staticRegistration.replace(telemetryAnchor, telemetryPatch);
}

for (const required of [
  STATIC_SOURCE_HEADING_AUTHORITY,
  "const yaw = sourceYaw;",
  "staticSourceHeadingTargetDeltaRadians",
  "maximumSourceHeadingTargetDelta",
  "uploadedJetwayStaticSourceHeadingPreservedGateCount = 57",
  "maximumYawChange > 1e-8",
]) {
  if (!staticRegistration.includes(required)) {
    throw new Error(`${staticRegistrationPath}: static source-heading preservation is missing ${required}`);
  }
}
fs.writeFileSync(staticRegistrationPath, staticRegistration, "utf8");

console.log(`Prepared all 58 exact Terminal 4 jetways in original BGL-local coordinates under the +6.2 m source parent; A1 remains photo-registered and never targets T4_WALK, while all 57 rigid static supplied bridges preserve their decoded BGL heading and use that source heading to seek the terminal wall (${SOURCE_REGISTRATION_AUTHORITY}; ${STATIC_SOURCE_HEADING_AUTHORITY}).`);
