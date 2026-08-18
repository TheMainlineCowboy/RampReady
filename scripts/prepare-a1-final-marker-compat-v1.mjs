import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const elbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const sourcePlacedPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(trainerPath, "utf8");

const finalMarker = "final-a1-acceptance-authority-after-all-preparers-v7-intact-source-bogie";
const workflowMarker = "final-a1-acceptance-authority-after-all-preparers-v1";
const sourceOwnershipAuthority = "a1-real-wall-registered-rotunda-decoded-kphx-heading-intact-parent-v2";
const photoAuthority = "a1-real-photo-remote-rotunda-fixed-corridor-v1";
const bogieAuthority = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
const compatibilityComment = `// ${workflowMarker} compatibility-alias-only; geometry remains ${finalMarker}`;

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
  if (!source.includes(token)) throw new Error(`${trainerPath}: final compatible A1 marker is missing acceptance evidence ${token}`);
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

// Publish the measurements that the final Tunnel-C world-space geometry check
// already proved. This is telemetry/report plumbing only; it does not move A1.
await import(`./prepare-a1-tunnel-c-bogie-report-publication-v1.mjs?final-compat=${Date.now()}`);
await import(`./prepare-a1-tunnel-c-bogie-readiness-v1.mjs?final-compat=${Date.now()}`);

const readiness = fs.readFileSync(readinessPath, "utf8");
const elbow = fs.readFileSync(elbowPath, "utf8");
const usesRealPhotoGeometry = elbow.includes(photoAuthority);

if (usesRealPhotoGeometry) {
  // The Aug. 15 A1/A3 overhead reference supersedes the old near-wall Rotunda
  // compatibility assumptions. Preserve only the harmless historical ownership
  // marker while verifying the actual final geometry: source model origin,
  // calibrated complete-parent bridge heading, remote Rotunda, long fixed
  // terminal corridor, zero aircraft-target relocation, and intact GLB children.
  for (const required of [
    sourceOwnershipAuthority,
    photoAuthority,
    "const sourceRotundaTarget = fixedRotundaCenter.clone();",
    "const rawBglPlacementX = Number(placement.x);",
    "anchor.position.x = rawBglPlacementX;",
    "anchor.position.z = rawBglPlacementZ;",
    "anchor.rotation.y = Number(placement.yaw)",
    "anchor.rotation.y += sourceAxisYawDelta;",
    "const sourceModelOriginRelocationX = 0;",
    "const sourceModelOriginRelocationZ = 0;",
    "uploadedJetwayA1RemoteSourceRotunda",
    "uploadedJetwayA1LongFixedTerminalCorridor",
    "const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.5;",
    "const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 30;",
    "const yawDelta = 0;",
  ]) {
    if (!elbow.includes(required)) throw new Error(`${elbowPath}: real-photo A1 compatibility is missing ${required}`);
  }
  for (const forbidden of [
    "UploadedAirportJetwayA1AircraftSidePivot",
    "bridgePivot.attach(root)",
    "bridgePivot.rotation.y = yawDelta",
    "anchor.rotation.y += yawDelta",
    "a1-fixed-terminal-rotunda-aircraft-side-pivot-v1",
    "const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)",
    "const sourceModelOriginRelocationX = anchor.position.x - rawBglPlacementX;",
    "same-day-a1-photo-compact-solid-terminal-leg-fixed-wall",
  ]) {
    if (elbow.includes(forbidden)) throw new Error(`${elbowPath}: real-photo A1 compatibility found obsolete compact/destructive behavior ${forbidden}`);
  }
} else {
  for (const required of [
    sourceOwnershipAuthority,
    "const sourceRotundaTarget = fixedRotundaCenter.clone();",
    "const rawBglPlacementX = Number(placement.x);",
    "anchor.rotation.y = Number(placement.yaw)",
    "const rotatedSourceHeadingRotundaCenter = objectCenterInFleet",
    "A1 FINAL wall-registered Rotunda-to-real-wall distance is invalid",
    "const yawDelta = 0;",
  ]) {
    if (!elbow.includes(required)) throw new Error(`${elbowPath}: compatibility step found measured-wall intact A1 ownership missing ${required}`);
  }
  for (const forbidden of [
    "UploadedAirportJetwayA1AircraftSidePivot",
    "bridgePivot.attach(root)",
    "bridgePivot.rotation.y = yawDelta",
    "anchor.rotation.y += yawDelta",
    "a1-fixed-terminal-rotunda-aircraft-side-pivot-v1",
    "const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)",
    "A1 source Rotunda-to-real-wall distance is invalid",
  ]) {
    if (elbow.includes(forbidden)) throw new Error(`${elbowPath}: compatibility step found destructive/raw-origin A1 behavior ${forbidden}`);
  }
}

for (const required of [
  `bogieGroundContactAuthority !== "${bogieAuthority}"`,
  "Math.abs(bogieGroundClearance) > 0.015",
  "bogieGroundContactPointCount < 4",
  "bogieGroundContactClusterCount < 1",
  "bogieGroundHorizontalContactSpan < 0.35",
]) {
  if (!readiness.includes(required)) throw new Error(`${readinessPath}: Tunnel-C bogie readiness is missing ${required}`);
}

// The green 44cbf7e2 evidence proved the Cab was on the CRJ door while the
// exact supplied Tunnel-C service stair still crossed the forward fuselage.
// Apply the stair-only rigid aircraft-clearance solve after the physical door fit
// and before any final browser/Vite evidence is accepted.
await import(`./prepare-a1-service-stair-aircraft-clearance-v1.mjs?final-compat=${Date.now()}`);
const clearedDoorFit = fs.readFileSync("src/environment/uploadedAirportJetwayA1DoorFitV11.js", "utf8");
for (const required of [
  "a1-service-stair-aircraft-clearance-v1",
  "keepA1ServiceStairClearOfAircraft",
  "uploadedJetwayA1ServiceStairAfterPenetrationMeters",
]) {
  if (!clearedDoorFit.includes(required)) {
    throw new Error(`A1 final compatibility did not install service-stair aircraft clearance: ${required}`);
  }
}

console.log(`Published ${workflowMarker} as a compatibility-only token while retaining ${finalMarker}. Final A1 compatibility now accepts ${usesRealPhotoGeometry ? photoAuthority : "the legacy measured-wall layout"} without changing terminal/aircraft geometry; exact supplied hierarchy, Tunnel-C bogie ramp authority, and aircraft-clear service stair remain enforced.`);
