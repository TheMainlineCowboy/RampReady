import fs from "node:fs";

const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const placementsPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const REMOTE_AUTHORITY = "a1-aug15-photo-genuinely-remote-rotunda-placement-v2";
const TELEMETRY_AUTHORITY = "a1-final-photo-remote-rotunda-wall-telemetry-v1";
const MIN_WALL_METERS = 8.5;
const MAX_WALL_METERS = 15.5;

let elbow = fs.readFileSync(elbowPath, "utf8");
let placements = fs.readFileSync(placementsPath, "utf8");

// Publish the actual final endpoints used by the photo-authoritative A1 geometry.
// Older environment telemetry was computed before the complete A1 parent moved to
// its remote Rotunda, so it continued reporting the retired ~4 m compact sleeve.
const elbowAnchor = "  group.userData.uploadedJetwayA1PhotoRemoteRotundaWallDistanceMeters = terminalWallDistance;";
const elbowPatch = `${elbowAnchor}\n  group.userData.uploadedJetwayA1PhotoRemoteRotundaX = fixedRotundaCenter.x;\n  group.userData.uploadedJetwayA1PhotoRemoteRotundaZ = fixedRotundaCenter.z;\n  group.userData.uploadedJetwayA1PhotoRemoteTerminalDirectionX = terminalDirection.x;\n  group.userData.uploadedJetwayA1PhotoRemoteTerminalDirectionZ = terminalDirection.z;\n  group.userData.uploadedJetwayA1PhotoRemoteWallX = measuredWallX;\n  group.userData.uploadedJetwayA1PhotoRemoteWallZ = measuredWallZ;\n  group.userData.uploadedJetwayA1PhotoRemoteTelemetryAuthority = "${TELEMETRY_AUTHORITY}";`;
if (!elbow.includes(TELEMETRY_AUTHORITY)) {
  if (!elbow.includes(elbowAnchor)) throw new Error(`${elbowPath}: final remote-Rotunda wall telemetry anchor is missing`);
  elbow = elbow.replace(elbowAnchor, elbowPatch);
}

// installUploadedAirportJetwayFleet() executes the final A1 registration before
// sourcePlacedTerminal4Jetways publishes the environment-level wall evidence.
// Replace only that stale early-raycast evidence with the final remote-Rotunda
// endpoint/direction after installation. The early hit remains useful internally,
// but it must not masquerade as the final rendered wall/Rotunda measurement.
const installAnchor = "  const uploadedJetwayController = installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements, sourceTextures);";
const installPatch = `${installAnchor}\n  // ${TELEMETRY_AUTHORITY}\n  if (group.userData.uploadedJetwayA1PhotoRemoteRotundaPlacementAuthority === "${REMOTE_AUTHORITY}") {\n    const finalA1WallDistance = Number(group.userData.uploadedJetwayA1PhotoRemoteRotundaWallDistanceMeters);\n    const finalA1WallDirectionX = Number(group.userData.uploadedJetwayA1PhotoRemoteTerminalDirectionX);\n    const finalA1WallDirectionZ = Number(group.userData.uploadedJetwayA1PhotoRemoteTerminalDirectionZ);\n    const finalA1WallX = Number(group.userData.uploadedJetwayA1PhotoRemoteWallX);\n    const finalA1WallZ = Number(group.userData.uploadedJetwayA1PhotoRemoteWallZ);\n    const finalA1RotundaX = Number(group.userData.uploadedJetwayA1PhotoRemoteRotundaX);\n    const finalA1RotundaZ = Number(group.userData.uploadedJetwayA1PhotoRemoteRotundaZ);\n    const finalDirectionMagnitude = Math.hypot(finalA1WallDirectionX, finalA1WallDirectionZ);\n    const endpointDistance = Math.hypot(finalA1WallX - finalA1RotundaX, finalA1WallZ - finalA1RotundaZ);\n    if (!(finalA1WallDistance >= ${MIN_WALL_METERS} && finalA1WallDistance <= ${MAX_WALL_METERS}\n      && Math.abs(endpointDistance - finalA1WallDistance) <= 0.002\n      && finalDirectionMagnitude > 0.999 && finalDirectionMagnitude < 1.001)) {\n      throw new Error(\`A1 final photo wall telemetry is inconsistent: distance=\${finalA1WallDistance}; endpoint=\${endpointDistance}; direction=\${finalDirectionMagnitude}\`);\n    }\n    a1TerminalWallDistance = finalA1WallDistance;\n    a1TerminalConnectionDirection = [finalA1WallDirectionX, finalA1WallDirectionZ];\n    a1TerminalConnectionAuthority = "${TELEMETRY_AUTHORITY}";\n    group.userData.a1PhotoRemoteRotundaWallX = finalA1WallX;\n    group.userData.a1PhotoRemoteRotundaWallZ = finalA1WallZ;\n    group.userData.a1PhotoRemoteRotundaX = finalA1RotundaX;\n    group.userData.a1PhotoRemoteRotundaZ = finalA1RotundaZ;\n    group.userData.a1PhotoRemoteRotundaWallDistance = finalA1WallDistance;\n    group.userData.a1PhotoRemoteRotundaTelemetryAuthority = "${TELEMETRY_AUTHORITY}";\n  }`;
if (!placements.includes(TELEMETRY_AUTHORITY)) {
  if (!placements.includes(installAnchor)) throw new Error(`${placementsPath}: exact uploaded jetway installation anchor is missing`);
  placements = placements.replace(installAnchor, installPatch);
}

for (const required of [
  TELEMETRY_AUTHORITY,
  "uploadedJetwayA1PhotoRemoteRotundaX",
  "uploadedJetwayA1PhotoRemoteTerminalDirectionX",
  "uploadedJetwayA1PhotoRemoteWallX",
]) {
  if (!elbow.includes(required)) throw new Error(`${elbowPath}: final photo telemetry is missing ${required}`);
}
for (const required of [
  TELEMETRY_AUTHORITY,
  "a1TerminalWallDistance = finalA1WallDistance;",
  "a1TerminalConnectionDirection = [finalA1WallDirectionX, finalA1WallDirectionZ];",
  "a1TerminalConnectionAuthority =",
  "a1PhotoRemoteRotundaWallDistance",
]) {
  if (!placements.includes(required)) throw new Error(`${placementsPath}: final photo telemetry publication is missing ${required}`);
}

fs.writeFileSync(elbowPath, elbow, "utf8");
fs.writeFileSync(placementsPath, placements, "utf8");
console.log(`Prepared ${TELEMETRY_AUTHORITY}: browser/environment A1 wall evidence now follows the final ${REMOTE_AUTHORITY} Rotunda and explicit BGATE1 wall instead of the retired compact-sleeve raycast; geometry is unchanged.`);
