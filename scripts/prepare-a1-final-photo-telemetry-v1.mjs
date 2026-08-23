import fs from "node:fs";

const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const placementsPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const readyPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const REMOTE_AUTHORITY = "a1-aug15-photo-genuinely-remote-rotunda-placement-v2";
const TELEMETRY_AUTHORITY = "a1-final-photo-remote-rotunda-wall-telemetry-v1";
const FINAL_ENDPOINT_AUTHORITY = "a1-final-photo-remote-rotunda-endpoint-republication-v1";
const MIN_WALL_METERS = 18;
const MAX_WALL_METERS = 35;

let elbow = fs.readFileSync(elbowPath, "utf8");
let placements = fs.readFileSync(placementsPath, "utf8");
let ready = fs.readFileSync(readyPath, "utf8");

// Publish the actual final endpoints used by the photo-authoritative A1 geometry.
// Older environment telemetry was computed before the complete A1 parent moved to
// its remote Rotunda, so it continued reporting the retired ~4 m compact sleeve.
const elbowAnchor = "  group.userData.uploadedJetwayA1PhotoRemoteRotundaWallDistanceMeters = terminalWallDistance;";
const elbowPatch = `${elbowAnchor}\n  group.userData.uploadedJetwayA1PhotoRemoteRotundaX = fixedRotundaCenter.x;\n  group.userData.uploadedJetwayA1PhotoRemoteRotundaY = fixedRotundaCenter.y;\n  group.userData.uploadedJetwayA1PhotoRemoteRotundaZ = fixedRotundaCenter.z;\n  group.userData.uploadedJetwayA1PhotoRemoteTerminalDirectionX = terminalDirection.x;\n  group.userData.uploadedJetwayA1PhotoRemoteTerminalDirectionZ = terminalDirection.z;\n  group.userData.uploadedJetwayA1PhotoRemoteWallX = measuredWallX;\n  group.userData.uploadedJetwayA1PhotoRemoteWallY = fixedRotundaCenter.y;\n  group.userData.uploadedJetwayA1PhotoRemoteWallZ = measuredWallZ;\n  group.userData.uploadedJetwayA1PhotoRemoteTelemetryAuthority = "${TELEMETRY_AUTHORITY}";`;
if (!elbow.includes(TELEMETRY_AUTHORITY)) {
  if (!elbow.includes(elbowAnchor)) throw new Error(`${elbowPath}: final remote-Rotunda wall telemetry anchor is missing`);
  elbow = elbow.replace(elbowAnchor, elbowPatch);
}

// sourcePlacedTerminal4Jetways executes before the asynchronous exact GLB fleet
// finishes loading. Keep this publication for callers that already have the final
// photo telemetry, but do not rely on it as the final browser-time publication.
const installAnchor = "  const uploadedJetwayController = installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements, sourceTextures);";
const installPatch = `${installAnchor}\n  // ${TELEMETRY_AUTHORITY}\n  if (group.userData.uploadedJetwayA1PhotoRemoteRotundaPlacementAuthority === "${REMOTE_AUTHORITY}") {\n    const finalA1WallDistance = Number(group.userData.uploadedJetwayA1PhotoRemoteRotundaWallDistanceMeters);\n    const finalA1WallDirectionX = Number(group.userData.uploadedJetwayA1PhotoRemoteTerminalDirectionX);\n    const finalA1WallDirectionZ = Number(group.userData.uploadedJetwayA1PhotoRemoteTerminalDirectionZ);\n    const finalA1WallX = Number(group.userData.uploadedJetwayA1PhotoRemoteWallX);\n    const finalA1WallZ = Number(group.userData.uploadedJetwayA1PhotoRemoteWallZ);\n    const finalA1RotundaX = Number(group.userData.uploadedJetwayA1PhotoRemoteRotundaX);\n    const finalA1RotundaZ = Number(group.userData.uploadedJetwayA1PhotoRemoteRotundaZ);\n    const finalDirectionMagnitude = Math.hypot(finalA1WallDirectionX, finalA1WallDirectionZ);\n    const endpointDistance = Math.hypot(finalA1WallX - finalA1RotundaX, finalA1WallZ - finalA1RotundaZ);\n    if (!(finalA1WallDistance >= ${MIN_WALL_METERS} && finalA1WallDistance <= ${MAX_WALL_METERS}\n      && Math.abs(endpointDistance - finalA1WallDistance) <= 0.002\n      && finalDirectionMagnitude > 0.999 && finalDirectionMagnitude < 1.001)) {\n      throw new Error(\`A1 final photo wall telemetry is inconsistent: distance=\${finalA1WallDistance}; endpoint=\${endpointDistance}; direction=\${finalDirectionMagnitude}\`);\n    }\n    a1TerminalWallDistance = finalA1WallDistance;\n    a1TerminalConnectionDirection = [finalA1WallDirectionX, finalA1WallDirectionZ];\n    a1TerminalConnectionAuthority = "${TELEMETRY_AUTHORITY}";\n    group.userData.a1PhotoRemoteRotundaWallX = finalA1WallX;\n    group.userData.a1PhotoRemoteRotundaWallZ = finalA1WallZ;\n    group.userData.a1PhotoRemoteRotundaX = finalA1RotundaX;\n    group.userData.a1PhotoRemoteRotundaZ = finalA1RotundaZ;\n    group.userData.a1PhotoRemoteRotundaWallDistance = finalA1WallDistance;\n    group.userData.a1PhotoRemoteRotundaTelemetryAuthority = "${TELEMETRY_AUTHORITY}";\n  }`;
if (!placements.includes(TELEMETRY_AUTHORITY)) {
  if (!placements.includes(installAnchor)) throw new Error(`${placementsPath}: exact uploaded jetway installation anchor is missing`);
  placements = placements.replace(installAnchor, installPatch);
}

// correctUploadedJetwayInstallation() runs before the Aug. 15 remote-Rotunda
// source pass and therefore publishes a stale compact (~4 m) set of Final*
// endpoints. Browser evidence historically consumed those stale fields even
// after the complete A1 parent had been moved to the genuine remote Rotunda.
// Republish only the Final* wall/Rotunda evidence immediately after BOTH final
// A1 source passes have run. Do not rewrite the separate legacy/source-local
// a1TerminalWallDistance field: visual verifiers intentionally keep that metric
// distinct from the long rendered fixed-corridor endpoint evidence.
const readyAnchor = "          const renderedDoorA1Elbow = enforceRenderedDoorA1Elbow(THREE, group, fleet, placements);";
const readyPatch = `${readyAnchor}\n          // ${FINAL_ENDPOINT_AUTHORITY}\n          const photoRotundaLocal = new THREE.Vector3(\n            Number(group.userData.uploadedJetwayA1ExactRotundaWorldX),\n            Number(group.userData.uploadedJetwayA1ExactRotundaWorldY),\n            Number(group.userData.uploadedJetwayA1ExactRotundaWorldZ),\n          );\n          const photoWallLocal = new THREE.Vector3(\n            Number(group.userData.uploadedJetwayA1ExactMeasuredWallWorldX),\n            Number(group.userData.uploadedJetwayA1ExactMeasuredWallWorldY),\n            Number(group.userData.uploadedJetwayA1ExactMeasuredWallWorldZ),\n          );\n          if (![photoRotundaLocal.x, photoRotundaLocal.y, photoRotundaLocal.z, photoWallLocal.x, photoWallLocal.y, photoWallLocal.z].every(Number.isFinite)) {\n            throw new Error("A1 final photo endpoint republication is missing the remote Rotunda or explicit BGATE1 wall");\n          }\n          const photoRotundaWorld = fleet.localToWorld(photoRotundaLocal.clone());\n          const photoWallWorld = fleet.localToWorld(photoWallLocal.clone());\n          const photoWallDistance = photoRotundaWorld.distanceTo(photoWallWorld);\n          if (!(photoWallDistance >= ${MIN_WALL_METERS} && photoWallDistance <= ${MAX_WALL_METERS})) {\n            throw new Error(\`A1 final photo endpoint wall span is outside the genuine remote-Rotunda envelope: \${photoWallDistance}\`);\n          }\n          group.userData.uploadedJetwayA1FinalRotundaWorldX = photoRotundaWorld.x;\n          group.userData.uploadedJetwayA1FinalRotundaWorldY = photoRotundaWorld.y;\n          group.userData.uploadedJetwayA1FinalRotundaWorldZ = photoRotundaWorld.z;\n          group.userData.uploadedJetwayA1FinalMeasuredWallWorldX = photoWallWorld.x;\n          group.userData.uploadedJetwayA1FinalMeasuredWallWorldY = photoWallWorld.y;\n          group.userData.uploadedJetwayA1FinalMeasuredWallWorldZ = photoWallWorld.z;\n          group.userData.uploadedJetwayA1FinalRotundaToWallWorldMeters = photoWallDistance;\n          group.userData.uploadedJetwayA1FinalEndpointEvidenceAuthority = "${FINAL_ENDPOINT_AUTHORITY}";`;
if (!ready.includes(FINAL_ENDPOINT_AUTHORITY)) {
  if (!ready.includes(readyAnchor)) throw new Error(`${readyPath}: final rendered-door A1 anchor is missing`);
  ready = ready.replace(readyAnchor, readyPatch);
}

for (const required of [
  TELEMETRY_AUTHORITY,
  "uploadedJetwayA1PhotoRemoteRotundaX",
  "uploadedJetwayA1PhotoRemoteRotundaY",
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
for (const required of [
  FINAL_ENDPOINT_AUTHORITY,
  "uploadedJetwayA1FinalRotundaWorldX = photoRotundaWorld.x",
  "uploadedJetwayA1FinalMeasuredWallWorldX = photoWallWorld.x",
  "uploadedJetwayA1FinalRotundaToWallWorldMeters = photoWallDistance",
]) {
  if (!ready.includes(required)) throw new Error(`${readyPath}: final photo endpoint republication is missing ${required}`);
}

fs.writeFileSync(elbowPath, elbow, "utf8");
fs.writeFileSync(placementsPath, placements, "utf8");
fs.writeFileSync(readyPath, ready, "utf8");
console.log(`Prepared ${TELEMETRY_AUTHORITY}/${FINAL_ENDPOINT_AUTHORITY}: browser A1 Final* endpoint evidence now republishes the actually rendered Aug. 15 remote Rotunda and explicit BGATE1 wall after the final A1 source passes, while the separate source-local wall metric remains untouched; geometry is unchanged.`);
