import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const staticRegistrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const SOURCE_REGISTRATION_AUTHORITY = "exact-terminal4-jetway-source-local-under-parent-offset-v2";
const STATIC_SOURCE_HEADING_AUTHORITY = "57-static-bgl-jetway-heading-preserved-v1";
const STATIC_TERMINAL_SEARCH_MARKER = "static-bgl-heading-terminal-search-v1";
let source = fs.readFileSync(jetwayPath, "utf8");

// The source-placed jetway GROUP already owns the KPHX +6.2 m Z world offset.
// Child placement remains in original BGL-local x/z coordinates.
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
      sourceHeadingAuthority: jetway.g === "A1" ? "a1-photo-registered-animated-exception" : "${STATIC_SOURCE_HEADING_AUTHORITY}",
      sourceRegistrationAuthority: "${SOURCE_REGISTRATION_AUTHORITY}",`;

source = source
  .replace("      z: jetway.z + sourceOffsetZ,", "      z: jetway.z,")
  .replace("      targetZ: targetZ + sourceOffsetZ,", "      targetZ,")
  .replace(/      sourceRegistrationAuthority: "exact-terminal4-jetway-source-registration-plus-6p2z-v1",\n/g, "");

// Legacy FSX heading h is clockwise from north. In the browser's reflected
// Terminal 4 frame the supplied bridge longitudinal yaw is 180deg-h. Preserve
// that source-authored parked angle for the 57 rigid scenery bridges. A1 remains
// the independently photo-registered animated bridge.
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

// Preserve the exact original A1 terminalConnection declaration because the
// grounded A1 building preparer replaces that byte-for-byte later. Apply the
// BGL-heading terminal search as a separate non-A1 override immediately after it.
const originalTerminalConnection = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    ) || {};`;
const transientPreferredTerminalConnection = `    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      terminalPreferredX,
      terminalPreferredZ,
      rotundaY,
    ) || {};`;
if (source.includes(transientPreferredTerminalConnection)) {
  source = source.replace(transientPreferredTerminalConnection, originalTerminalConnection);
}
const staticTerminalOverride = `${originalTerminalConnection}
    if (jetway.g !== "A1") {
      // ${STATIC_TERMINAL_SEARCH_MARKER}
      const sourceHeadingTerminalConnection = findTerminalWallConnection(
        THREE,
        terminal,
        jetway.x,
        jetway.z + sourceOffsetZ,
        terminalPreferredX,
        terminalPreferredZ,
        rotundaY,
      );
      if (sourceHeadingTerminalConnection) {
        Object.assign(terminalConnection, sourceHeadingTerminalConnection);
      }
    }`;
if (!source.includes(STATIC_TERMINAL_SEARCH_MARKER)) {
  if (!source.includes(originalTerminalConnection)) {
    throw new Error(`${jetwayPath}: original A1-compatible terminalConnection declaration is missing`);
  }
  source = source.replace(originalTerminalConnection, staticTerminalOverride);
}

source = source
  .replace("    const connectorTowardX = terminalConnection?.towardX ?? -ux;", "    const connectorTowardX = terminalConnection?.towardX ?? terminalPreferredX;")
  .replace("    const connectorTowardZ = terminalConnection?.towardZ ?? -uz;", "    const connectorTowardZ = terminalConnection?.towardZ ?? terminalPreferredZ;");

if (!source.includes(STATIC_SOURCE_HEADING_AUTHORITY)) {
  const registeredPlacement = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw,
      targetX,
      targetZ,
      sourceRegistrationAuthority: "${SOURCE_REGISTRATION_AUTHORITY}",`;
  if (source.includes(registeredPlacement)) {
    source = source.replace(registeredPlacement, sourceLocalPlacement);
  } else if (source.includes(unregisteredPlacement)) {
    source = source.replace(unregisteredPlacement, sourceLocalPlacement);
  } else {
    throw new Error(`${jetwayPath}: exact uploaded jetway placement anchor is missing`);
  }
}

// A1 must never be redirected to the elevated T4_WALK.
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
  STATIC_TERMINAL_SEARCH_MARKER,
  "sourceJetwayHeadingDegrees",
  "sourceJetwayYawRadians",
  "terminalPreferredX",
  "terminalPreferredZ",
  'yaw: jetway.g === "A1" ? yaw : sourceJetwayYaw',
  originalTerminalConnection,
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

// Static wall registration may translate the complete replacement parent so the
// authored Rotunda sits at the correct wall, but it may not rotate a rigid bridge
// away from its decoded BGL heading merely to point at a generic CRJ door target.
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

console.log(`Prepared all 58 exact Terminal 4 jetways in original BGL-local coordinates under the +6.2 m source parent; A1 keeps its grounded building handoff and never targets T4_WALK, while all 57 rigid static supplied bridges preserve their decoded BGL heading and independently use that heading to seek the terminal wall (${SOURCE_REGISTRATION_AUTHORITY}; ${STATIC_SOURCE_HEADING_AUTHORITY}).`);
