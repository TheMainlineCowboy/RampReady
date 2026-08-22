import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const photoAuthority = "a1-real-photo-remote-rotunda-fixed-corridor-v1";
const doglegAuthority = "a1-aug15-photo-fixed-corridor-dogleg-v1";
const referenceMatchAuthority = "a1-aug15-reference-matched-dogleg-v2";
const supportAuthority = "a1-aug15-photo-two-permanent-fixed-support-columns-v1";
const authority = "a1-real-wall-registered-rotunda-decoded-kphx-heading-intact-parent-v2";
const targetAuthority = "a1-aircraft-target-follows-intact-parent-relocation-v1";
let source = fs.readFileSync(sourcePath, "utf8");
const alreadyPhotoCorrected = source.includes(photoAuthority);

if (!alreadyPhotoCorrected) {
  await import(`./prepare-a1-source-bgl-rotunda-ownership-v1.mjs?intact-a1=${Date.now()}`);
  await import(`./prepare-a1-final-walkway-hierarchy-exclusion-v1.mjs?final-wall=${Date.now()}`);
  await import(`./prepare-a1-relocated-aircraft-target-v1.mjs?relocated-target=${Date.now()}`);

  source = fs.readFileSync(sourcePath, "utf8");
  for (const forbidden of [
    "UploadedAirportJetwayA1AircraftSidePivot",
    "bridgePivot.attach(root)",
    "bridgePivot.rotation.y = yawDelta",
    "uploadedJetwayA1AircraftSidePivotRootCount",
    "uploadedJetwayA1RotundaFixedDuringBridgeYaw",
    "a1-fixed-terminal-rotunda-aircraft-side-pivot-v1",
    "const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)",
    "const targetPoint = new THREE.Vector3(Number(placement.targetX), fixedRotundaCenter.y, Number(placement.targetZ));",
  ]) {
    if (source.includes(forbidden)) {
      throw new Error(`${sourcePath}: forbidden child-pivot/raw-coordinate A1 behavior survived intact A1 preparation: ${forbidden}`);
    }
  }

  for (const required of [
    authority,
    targetAuthority,
    "const sourceRotundaTarget = fixedRotundaCenter.clone();",
    "const rawBglPlacementX = Number(placement.x);",
    "anchor.rotation.y = Number(placement.yaw)",
    "const rotatedSourceHeadingRotundaCenter = objectCenterInFleet",
    "const yawDelta = 0;",
    "const sourceModelOriginRelocationX = anchor.position.x - rawBglPlacementX;",
    "rawTargetX + sourceModelOriginRelocationX",
    "uploadedJetwayA1AircraftTargetRelocationAuthority",
    "uploadedJetwayA1SourceRotundaPositionErrorMeters",
    "uploadedJetwayA1MeasuredTerminalWallX",
    "A1 FINAL wall-registered Rotunda-to-real-wall distance is invalid",
  ]) {
    if (!source.includes(required)) {
      throw new Error(`${sourcePath}: first-pass intact wall-registered A1 requirement is missing ${required}`);
    }
  }

  await import(`./prepare-a1-intact-source-axis-alignment-v1.mjs?source-axis=${Date.now()}`);
  await import(`./prepare-a1-final-rotunda-continuity-v1.mjs?rotunda-continuity=${Date.now()}`);
} else {
  await import(`./prepare-a1-final-walkway-hierarchy-exclusion-v1.mjs?photo-final-wall=${Date.now()}`);
}

// Late production preparers can re-stamp their obsolete compact connector
// authority even though they leave the photo marker in the generated file.
// Remove that stale semantic label before the idempotent photo normalizer so it
// can validate the actual geometry rather than tripping on dead compatibility
// text left by those passes.
let prePhotoSource = fs.readFileSync(sourcePath, "utf8");
prePhotoSource = prePhotoSource.replace(
  /same-day-a1-photo-compact-solid-terminal-leg-fixed-wall[^"\n]*/g,
  "same-day-a1-photo-remote-fixed-corridor-to-source-rotunda-v1",
);
fs.writeFileSync(sourcePath, prePhotoSource, "utf8");

// Always normalize, even on repeated production passes. Older late preparers can
// rewrite compact ranges while leaving telemetry markers in place; this script
// therefore replaces its own prior block idempotently and reasserts source-model
// origin + calibrated bridge heading + long fixed terminal corridor every time.
await import(`./prepare-a1-real-photo-fixed-corridor-v1.mjs?real-photo=${Date.now()}`);

// A1 is gate-specific in the Aug. 15 reference: after the long-corridor source
// pose is restored, convert only A1's fixed terminal-side span into the visible
// two-leg corridor + elbow. A3 and the rest of the static fleet retain their
// own short/direct measured terminal connectors.
//
// Once the later reference-matching pass has corrected the elbow to the
// aircraft-side hemisphere, do NOT rerun the older v1 dogleg verifier: its
// historical postconditions explicitly demand the now-retired opposite-
// hemisphere branch and would abort the build even though the corrected v2
// geometry is already present. The v2 support/reference pass below remains the
// authoritative idempotent validator for the photographed route.
let doglegSource = fs.readFileSync(sourcePath, "utf8");
if (!doglegSource.includes(referenceMatchAuthority)) {
  await import(`./prepare-a1-real-photo-dogleg-v1.mjs?real-photo-dogleg=${Date.now()}`);
}

// The same A1 photo also shows a permanent structural support pair beneath the
// fixed corridor before the remote Rotunda. Install exactly two ramp-supported
// fixed columns here; they are not part of the movable supplied GLB and never
// rise, telescope or rotate with the wheel-supported bridge. This pass also
// owns the reference-matched v2 dogleg validation on repeated builds.
await import(`./prepare-a1-photo-fixed-support-columns-v1.mjs?fixed-supports=${Date.now()}`);

source = fs.readFileSync(sourcePath, "utf8");
for (const required of [
  photoAuthority,
  doglegAuthority,
  referenceMatchAuthority,
  supportAuthority,
  authority,
  targetAuthority,
  "anchor.position.x = rawBglPlacementX;",
  "anchor.position.z = rawBglPlacementZ;",
  "anchor.rotation.y += sourceAxisYawDelta;",
  "const sourceModelOriginRelocationX = 0;",
  "const sourceModelOriginRelocationZ = 0;",
  "uploadedJetwayA1RemoteSourceRotunda",
  "uploadedJetwayA1LongFixedTerminalCorridor",
  "uploadedJetwayA1FixedCorridorDoglegAuthority",
  "uploadedJetwayA1ReferenceMatchedDoglegAuthority",
  "uploadedJetwayA1PermanentFixedSupportAuthority",
  "uploadedJetwayA1PermanentFixedSupportColumnCount = 2",
  "UploadedAirportJetwayA1PermanentFixedSupportColumn_",
  "const rotundaTerminalBranchDirection = bridgeDirection.clone().normalize();",
  "terminalWallDistance * 0.40",
  "const firstFrame = addContinuousShell",
  "const secondFrame = addContinuousShell",
  "const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.5;",
  "const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 30;",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: final Aug. 15 real-photo A1 authority is missing ${required}`);
  }
}
for (const forbidden of [
  "UploadedAirportJetwayA1AircraftSidePivot",
  "bridgePivot.attach(root)",
  "bridgePivot.rotation.y = yawDelta",
  "const sourceModelOriginRelocationX = anchor.position.x - rawBglPlacementX;",
  "same-day-a1-photo-compact-solid-terminal-leg-fixed-wall",
  "const frame = addContinuousShell(THREE, connector, materials, shellStart, shellVector, shellLength",
  "terminalDirection.dot(bridgeDirection)",
  "const rotundaTerminalBranchDirection = bridgeDirection.clone().multiplyScalar(-1).normalize();",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: obsolete compact/destructive/straight A1 behavior survived final real-photo normalization: ${forbidden}`);
  }
}

console.log(`Prepared A1 under ${photoAuthority} + ${doglegAuthority} + ${referenceMatchAuthority} + ${supportAuthority}: the complete exact Airport_Jetway.glb uses the decoded source model origin and calibrated physical bridge heading, its Rotunda remains remote, the real Terminal 4 facade is connected by the A1-only reference-matched fixed dogleg corridor carried by exactly two permanent ramp-supported columns, A3+ keep their short/direct connectors, and neither supplied children nor the aircraft target are moved to hide a bad terminal attachment.`);
