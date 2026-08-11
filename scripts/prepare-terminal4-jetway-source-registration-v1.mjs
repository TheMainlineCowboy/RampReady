import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const staticRegistrationPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const SOURCE_REGISTRATION_AUTHORITY = "exact-terminal4-jetway-source-local-under-parent-offset-v2";
const STATIC_SOURCE_HEADING_AUTHORITY = "57-static-bgl-jetway-heading-provenance-v3";
const A1_SOURCE_HEADING_AUTHORITY = "a1-decoded-kphx-bgl-heading-preserved-v1";
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
      // The decoded airport heading owns the physical placement for ALL gates,
      // including animated A1. Aircraft/door fitting happens later by moving the
      // aircraft, never by inventing a separate A1 jetway heading.
      yaw: sourceJetwayYaw,
      targetX,
      targetZ,
      sourceJetwayHeadingDegrees: Number(jetway.h),
      sourceJetwayYawRadians: sourceJetwayYaw,
      sourceHeadingAuthority: jetway.g === "A1" ? "${A1_SOURCE_HEADING_AUTHORITY}" : "${STATIC_SOURCE_HEADING_AUTHORITY}",
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
    // Source heading is useful for finding the building-side facade from the
    // decoded source point. A1 uses its dedicated measured wall result; static
    // gates may use the source-heading wall search while retaining own-gate
    // aircraft-side target registration later.
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

const oldA1Exception = 'yaw: jetway.g === "A1" ? yaw : sourceJetwayYaw';
if (source.includes(oldA1Exception)) {
  source = source.replaceAll(oldA1Exception, "yaw: sourceJetwayYaw");
}
source = source.replaceAll(
  'sourceHeadingAuthority: jetway.g === "A1" ? "a1-photo-registered-animated-exception" : "57-static-bgl-jetway-heading-provenance-v3"',
  `sourceHeadingAuthority: jetway.g === "A1" ? "${A1_SOURCE_HEADING_AUTHORITY}" : "${STATIC_SOURCE_HEADING_AUTHORITY}"`,
);

if (!source.includes("yaw: sourceJetwayYaw")) {
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
  else throw new Error(`${jetwayPath}: no compatible placement block exists for source-owned yaw`);
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
  "yaw: sourceJetwayYaw",
  A1_SOURCE_HEADING_AUTHORITY,
]) {
  if (!source.includes(token)) throw new Error(`${jetwayPath}: source-local/source-heading provenance contract is missing ${token}`);
}
for (const forbidden of [
  "z: jetway.z + sourceOffsetZ,",
  "targetZ: targetZ + sourceOffsetZ,",
  "exact-terminal4-jetway-source-registration-plus-6p2z-v1",
  oldA1Exception,
  "a1-photo-registered-animated-exception",
]) {
  if (source.includes(forbidden)) throw new Error(`${jetwayPath}: obsolete source-registration behavior remains: ${forbidden}`);
}

let staticRegistration = fs.readFileSync(staticRegistrationPath, "utf8");
const legacyTargetYawLine = "  const yaw = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;";
const rigidParentYawLine = "  const yaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);";
const targetYawBlock = `  const targetRegistrationYaw = wrapYaw(THREE, targetHeading - sourceBridgeAxisHeading);
  const sourceHeadingTargetDeltaRadians = Math.abs(wrapYaw(THREE, targetRegistrationYaw - sourceYaw));
  // Static gates keep source heading as provenance only because their fixed
  // Rotundas are facade-registered and their aircraft-side bridge must point at
  // that same gate's authored target. A1 is excluded from this static path.
  const yaw = targetRegistrationYaw;`;

if (staticRegistration.includes(rigidParentYawLine)) {
  staticRegistration = staticRegistration.replace(rigidParentYawLine, targetYawBlock);
} else if (staticRegistration.includes(legacyTargetYawLine)) {
  staticRegistration = staticRegistration.replace(legacyTargetYawLine, `  const targetHeading = bridgeDistance > 2 ? Math.atan2(bridgeDx, bridgeDz) : sourceYaw;
  const sourceBridgeAxisHeading = Number(authoredRotundaOffset.bridgeAxisHeadingRadians);
  if (!Number.isFinite(sourceBridgeAxisHeading)) throw new Error(\`Static jetway \${placement.gate} is missing exact supplied bridge-axis heading\`);
${targetYawBlock}`);
} else if (staticRegistration.includes("  const yaw = sourceYaw;")) {
  staticRegistration = staticRegistration.replaceAll("  const yaw = sourceYaw;", "  const yaw = targetRegistrationYaw;");
} else if (!staticRegistration.includes("  const yaw = targetRegistrationYaw;")) {
  throw new Error(`${staticRegistrationPath}: no compatible static own-gate registration anchor is present`);
}

staticRegistration = staticRegistration.replaceAll("  const yaw = sourceYaw;", "  const yaw = targetRegistrationYaw;");
staticRegistration = staticRegistration
  .replaceAll("57-static-bgl-jetway-heading-preserved-v1", STATIC_SOURCE_HEADING_AUTHORITY)
  .replaceAll("57-static-bgl-jetway-heading-preserved-v2", STATIC_SOURCE_HEADING_AUTHORITY);

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
  group.userData.uploadedJetwayStaticSourceHeadingProvenanceGateCount = 57;
  group.userData.uploadedJetwayStaticMaximumSourceHeadingTargetDeltaRadians = maximumSourceHeadingTargetDelta;`;
if (!staticRegistration.includes("uploadedJetwayStaticSourceHeadingAuthority")) {
  if (!staticRegistration.includes(telemetryAnchor)) throw new Error(`${staticRegistrationPath}: static yaw telemetry anchor is missing`);
  staticRegistration = staticRegistration.replace(telemetryAnchor, telemetryPatch);
}
staticRegistration = staticRegistration
  .replaceAll("uploadedJetwayStaticSourceHeadingPreservedGateCount", "uploadedJetwayStaticSourceHeadingProvenanceGateCount")
  .replaceAll("57-static-bgl-jetway-heading-preserved-v1", STATIC_SOURCE_HEADING_AUTHORITY)
  .replaceAll("57-static-bgl-jetway-heading-preserved-v2", STATIC_SOURCE_HEADING_AUTHORITY);

for (const required of [
  STATIC_SOURCE_HEADING_AUTHORITY,
  "staticSourceHeadingTargetDeltaRadians",
  "maximumSourceHeadingTargetDelta",
  "uploadedJetwayStaticSourceHeadingProvenanceGateCount = 57",
  "const yaw = targetRegistrationYaw;",
]) {
  if (!staticRegistration.includes(required)) throw new Error(`${staticRegistrationPath}: static source-heading provenance/own-gate yaw telemetry is missing ${required}`);
}
if (staticRegistration.includes("  const yaw = sourceYaw;")) {
  throw new Error(`${staticRegistrationPath}: decoded source heading still owns final static rendered yaw`);
}

fs.writeFileSync(jetwayPath, source, "utf8");
fs.writeFileSync(staticRegistrationPath, staticRegistration, "utf8");

console.log(`Prepared all 58 exact Terminal 4 jetways in original BGL-local coordinates. A1 keeps the decoded KPHX source yaw as physical authority; the 57 static bridges retain source heading as provenance while their aircraft-side yaw remains own-gate target registered (${SOURCE_REGISTRATION_AUTHORITY}; ${A1_SOURCE_HEADING_AUTHORITY}; ${STATIC_SOURCE_HEADING_AUTHORITY}).`);
