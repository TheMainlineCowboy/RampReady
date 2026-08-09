import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const staticRegistrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const SOURCE_REGISTRATION_AUTHORITY = "exact-terminal4-jetway-source-local-under-parent-offset-v2";
const STATIC_SOURCE_HEADING_AUTHORITY = "57-static-bgl-jetway-heading-preserved-v2";
const STATIC_TERMINAL_SEARCH_MARKER = "static-bgl-heading-terminal-search-v2-non-a1-resolved";
let source = fs.readFileSync(jetwayPath, "utf8");

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

const yawAnchor = "    const yaw = Math.atan2(ux, uz);";
const yawPatch = `    const yaw = Math.atan2(ux, uz);
    const sourceJetwayHeadingDegrees = Number(jetway.h);
    if (!Number.isFinite(sourceJetwayHeadingDegrees)) {
      throw new Error(\`Jetway \${jetway.g} is missing its decoded KPHX BGL heading\`);
    }
    const sourceJetwayYaw = THREE.MathUtils.degToRad(180 - sourceJetwayHeadingDegrees);
    const sourceJetwayForwardX = Math.sin(sourceJetwayYaw);
    const sourceJetwayForwardZ = Math.cos(sourceJetwayYaw);
    const terminalPreferredX = -sourceJetwayForwardX;
    const terminalPreferredZ = -sourceJetwayForwardZ;`;
if (!source.includes("const sourceJetwayYaw = THREE.MathUtils.degToRad(180 - sourceJetwayHeadingDegrees);")) {
  if (!source.includes(yawAnchor)) throw new Error(`${jetwayPath}: source bridge yaw anchor is missing`);
  source = source.replace(yawAnchor, yawPatch);
}

const terminalConnectionVariants = [
`    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    ) || {};`,
`    const terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );`,
`    let terminalConnection = findTerminalWallConnection(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sourceOffsetZ,
      -ux,
      -uz,
      rotundaY,
    );`,
];
if (!source.includes(STATIC_TERMINAL_SEARCH_MARKER)) {
  const declaration = terminalConnectionVariants.find((candidate) => source.includes(candidate));
  if (!declaration) throw new Error(`${jetwayPath}: no compatible A1 terminalConnection declaration is present for static source-heading registration`);
  const staticOverride = `${declaration}
    // ${STATIC_TERMINAL_SEARCH_MARKER}
    const sourceHeadingTerminalConnection = jetway.g === "A1"
      ? null
      : findTerminalWallConnection(
        THREE,
        terminal,
        jetway.x,
        jetway.z + sourceOffsetZ,
        terminalPreferredX,
        terminalPreferredZ,
        rotundaY,
      );`;
  source = source.replace(declaration, staticOverride);
}

const wallDistanceLine = "    const terminalWallDistance = terminalConnection?.distance ?? null;";
const resolvedConnectionBlock = `    const resolvedTerminalConnection = jetway.g === "A1"
      ? terminalConnection
      : (sourceHeadingTerminalConnection || terminalConnection);
    const terminalWallDistance = resolvedTerminalConnection?.distance ?? null;`;
if (!source.includes("const resolvedTerminalConnection = jetway.g === \"A1\"")) {
  if (!source.includes(wallDistanceLine)) throw new Error(`${jetwayPath}: terminal wall-distance anchor is missing`);
  source = source.replace(wallDistanceLine, resolvedConnectionBlock);
}
source = source
  .replace("    const connectorTowardX = terminalConnection?.towardX ?? -ux;", "    const connectorTowardX = resolvedTerminalConnection?.towardX ?? (jetway.g === \"A1\" ? -ux : terminalPreferredX);")
  .replace("    const connectorTowardZ = terminalConnection?.towardZ ?? -uz;", "    const connectorTowardZ = resolvedTerminalConnection?.towardZ ?? (jetway.g === \"A1\" ? -uz : terminalPreferredZ);");

if (!source.includes(STATIC_SOURCE_HEADING_AUTHORITY)) {
  const registeredPlacement = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw,
      targetX,
      targetZ,
      sourceRegistrationAuthority: "${SOURCE_REGISTRATION_AUTHORITY}",`;
  if (source.includes(registeredPlacement)) source = source.replace(registeredPlacement, sourceLocalPlacement);
  else if (source.includes(unregisteredPlacement)) source = source.replace(unregisteredPlacement, sourceLocalPlacement);
  else {
    // A previous preparation pass may already contain the v1 heading authority.
    source = source.replaceAll("57-static-bgl-jetway-heading-preserved-v1", STATIC_SOURCE_HEADING_AUTHORITY);
  }
}

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
  STATIC_TERMINAL_SEARCH_MARKER,
  "sourceJetwayHeadingDegrees",
  "sourceJetwayYawRadians",
  "terminalPreferredX",
  "terminalPreferredZ",
  "sourceHeadingTerminalConnection",
  "resolvedTerminalConnection",
  'yaw: jetway.g === "A1" ? yaw : sourceJetwayYaw',
]) {
  if (!source.includes(token)) throw new Error(`${jetwayPath}: source-local/source-heading registration contract is missing ${token}`);
}
for (const forbidden of [
  "z: jetway.z + sourceOffsetZ,",
  "targetZ: targetZ + sourceOffsetZ,",
  "exact-terminal4-jetway-source-registration-plus-6p2z-v1",
]) {
  if (source.includes(forbidden)) throw new Error(`${jetwayPath}: double-applied jetway world offset remains: ${forbidden}`);
}

let staticRegistration = fs.readFileSync(staticRegistrationPath, "utf8");
const legacyTargetYawLine = "  const yaw = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;";
const preservedYawBlock = `  const targetYaw = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;
  const sourceHeadingTargetDeltaRadians = Math.abs(wrapYaw(THREE, targetYaw - sourceYaw));
  const yaw = sourceYaw;`;
const rigidParentYawLine = "  const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);";
const rigidParentPreservedPatch = `  const targetRegistrationYaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);
  const sourceHeadingTargetDeltaRadians = Math.abs(wrapYaw(THREE, targetRegistrationYaw - sourceYaw));
  // Fleet evidence showed the synthetic aircraft-target yaw crossing bridges and
  // forcing invented terminal corridors. Preserve the decoded KPHX BGL heading
  // for every non-A1 exact GLB; aircraft placement can be solved independently.
  const yaw = sourceYaw;`;
if (staticRegistration.includes(rigidParentYawLine)) {
  staticRegistration = staticRegistration.replace(rigidParentYawLine, rigidParentPreservedPatch);
} else if (staticRegistration.includes(legacyTargetYawLine)) {
  staticRegistration = staticRegistration.replace(legacyTargetYawLine, preservedYawBlock);
} else if (staticRegistration.includes("const targetRegistrationYaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);")) {
  staticRegistration = staticRegistration.replaceAll("57-static-bgl-jetway-heading-preserved-v1", STATIC_SOURCE_HEADING_AUTHORITY);
} else if (!staticRegistration.includes("const yaw = sourceYaw;")) {
  throw new Error(`${staticRegistrationPath}: no compatible static source-heading registration anchor is present`);
}

const returnedAuthorityAnchor = `    staticFacadeRegistrationYawChangeRadians: yawChange,
    staticFacadeWallErrorMeters: wallError,`;
const returnedAuthorityPatch = `    staticFacadeRegistrationYawChangeRadians: yawChange,
    staticSourceHeadingTargetDeltaRadians: sourceHeadingTargetDeltaRadians,
    staticSourceHeadingAuthority: "${STATIC_SOURCE_HEADING_AUTHORITY}",
    staticFacadeWallErrorMeters: wallError,`;
if (!staticRegistration.includes("staticSourceHeadingTargetDeltaRadians:")) {
  if (!staticRegistration.includes(returnedAuthorityAnchor)) throw new Error(`${staticRegistrationPath}: static registration return anchor is missing`);
  staticRegistration = staticRegistration.replace(returnedAuthorityAnchor, returnedAuthorityPatch);
}
staticRegistration = staticRegistration.replaceAll("57-static-bgl-jetway-heading-preserved-v1", STATIC_SOURCE_HEADING_AUTHORITY);

const aggregateAnchor = `  const maximumYawChange = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticFacadeRegistrationYawChangeRadians));`;
const aggregatePatch = `${aggregateAnchor}
  const maximumSourceHeadingTargetDelta = Math.max(...staticRegisteredPlacements.map((placement) => placement.staticSourceHeadingTargetDeltaRadians));`;
if (!staticRegistration.includes("maximumSourceHeadingTargetDelta")) {
  if (!staticRegistration.includes(aggregateAnchor)) throw new Error(`${staticRegistrationPath}: static yaw aggregate anchor is missing`);
  staticRegistration = staticRegistration.replace(aggregateAnchor, aggregatePatch);
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
staticRegistration = staticRegistration.replaceAll("57-static-bgl-jetway-heading-preserved-v1", STATIC_SOURCE_HEADING_AUTHORITY);

for (const required of [
  STATIC_SOURCE_HEADING_AUTHORITY,
  "staticSourceHeadingTargetDeltaRadians",
  "maximumSourceHeadingTargetDelta",
  "uploadedJetwayStaticSourceHeadingPreservedGateCount = 57",
  "const yaw = sourceYaw;",
]) {
  if (!staticRegistration.includes(required)) throw new Error(`${staticRegistrationPath}: static source-heading telemetry is missing ${required}`);
}
if (staticRegistration.includes(rigidParentYawLine)) {
  throw new Error(`${staticRegistrationPath}: synthetic aircraft-target yaw still owns the static exact GLB fleet`);
}

fs.writeFileSync(jetwayPath, source, "utf8");
fs.writeFileSync(staticRegistrationPath, staticRegistration, "utf8");

console.log(`Prepared all 58 exact Terminal 4 jetways in original BGL-local coordinates under the +6.2 m source parent; A1 keeps the grounded/photo terminalConnection stage and never targets T4_WALK. All 57 static exact GLBs now preserve the decoded KPHX BGL heading instead of being re-aimed at synthetic CRJ door targets (${SOURCE_REGISTRATION_AUTHORITY}; ${STATIC_SOURCE_HEADING_AUTHORITY}).`);
