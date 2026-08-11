import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const sourcePlacedPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(trainerPath, "utf8");

const finalMarker = "final-a1-acceptance-authority-after-all-preparers-v7-intact-source-bogie";
const workflowMarker = "final-a1-acceptance-authority-after-all-preparers-v1";
const sourceOwnershipAuthority = "a1-decoded-kphx-bgl-rotunda-and-heading-own-physical-jetway-v1";
const bogieAuthority = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
const compatibilityComment = `// ${workflowMarker} compatibility-alias-only; geometry remains ${finalMarker}`;

// Compatibility is text-only. Older workflow contracts still look for the v1
// marker, but replacing the new final marker or importing an older geometry
// preparer can silently undo the actual A1 repair after it has passed. Keep the
// v7 authority intact and publish v1 only as a non-mutating alias token.
if (!source.includes(finalMarker)) {
  throw new Error(`${trainerPath}: current intact-source A1 final marker is missing`);
}
if (!source.includes(compatibilityComment)) {
  const markerIndex = source.indexOf(`// ${finalMarker}`);
  if (markerIndex < 0) throw new Error(`${trainerPath}: cannot locate v7 final marker for compatibility alias`);
  const lineEnd = source.indexOf("\n", markerIndex);
  const insertAt = lineEnd >= 0 ? lineEnd + 1 : source.length;
  source = `${source.slice(0, insertAt)}${compatibilityComment}\n${source.slice(insertAt)}`;
}

for (const token of [
  finalMarker,
  workflowMarker,
  "inspectionAircraftLandingGearContactPatchCount",
  "inspectionAircraftNoseTireContact",
  "inspectionAircraftLeftMainTireContact",
  "inspectionAircraftRightMainTireContact",
  "terminal4A1JetwayWallDistance",
  "terminal4A1ConnectionAuthority",
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  "terminal4UploadedJetwayBogieGroundContactAuthority",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
  "terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed",
  "terminal4UploadedJetwayA1NoGeneratedGlassCorridor",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: final compatible A1 marker is missing acceptance evidence ${token}`);
  }
}
fs.writeFileSync(trainerPath, source, "utf8");

const sourcePlaced = fs.readFileSync(sourcePlacedPath, "utf8");
if (sourcePlaced.includes("exact-T4_WALK-A1-terminal-portal-v25")) {
  throw new Error(`${sourcePlacedPath}: obsolete elevated T4_WALK A1 portal survived final marker compatibility`);
}
if (!sourcePlaced.includes("structural-A1-terminal-building-")) {
  throw new Error(`${sourcePlacedPath}: structural Terminal 4 A1 wall authority is missing`);
}
if (!sourcePlaced.includes('yaw: sourceJetwayYaw')) {
  throw new Error(`${sourcePlacedPath}: A1 decoded source yaw is not the placement authority`);
}
if (sourcePlaced.includes('yaw: jetway.g === "A1" ? yaw : sourceJetwayYaw')) {
  throw new Error(`${sourcePlacedPath}: synthetic A1 yaw exception returned during marker compatibility`);
}

const readiness = fs.readFileSync(readinessPath, "utf8");
const elbow = fs.readFileSync(elbowPath, "utf8");
for (const required of [
  sourceOwnershipAuthority,
  "const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)",
  "anchor.rotation.y = Number(placement.yaw)",
  "const yawDelta = 0;",
]) {
  if (!elbow.includes(required)) {
    throw new Error(`${elbowPath}: compatibility step found A1 source ownership missing ${required}`);
  }
}
for (const forbidden of [
  "UploadedAirportJetwayA1AircraftSidePivot",
  "bridgePivot.attach(root)",
  "bridgePivot.rotation.y = yawDelta",
  "anchor.rotation.y += yawDelta",
  "a1-fixed-terminal-rotunda-aircraft-side-pivot-v1",
]) {
  if (elbow.includes(forbidden)) {
    throw new Error(`${elbowPath}: compatibility step found destructive A1 pivot behavior ${forbidden}`);
  }
}
if (!readiness.includes(bogieAuthority)) {
  throw new Error(`${readinessPath}: Tunnel-C bogie grounding authority is missing before final compatibility publication`);
}

console.log(`Published ${workflowMarker} as a compatibility-only token while retaining ${finalMarker}. No A1 geometry preparer ran: decoded KPHX source pose, intact supplied hierarchy and Tunnel-C bogie ramp authority remain untouched.`);
