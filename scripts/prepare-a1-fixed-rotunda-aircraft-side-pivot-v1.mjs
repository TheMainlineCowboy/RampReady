import fs from "node:fs";

// The live A1 screenshot proved that selectively reparenting Tunnel A/B/C/Cab
// around a new runtime pivot can visually collapse the supplied jetway into the
// terminal corner and leave its support/wheel geometry suspended. Preserve the
// real-wall-registered Rotunda, apply decoded KPHX heading only to the COMPLETE
// supplied parent, and fail closed if any child-pivot rewrite is present.
await import(`./prepare-a1-source-bgl-rotunda-ownership-v1.mjs?intact-a1=${Date.now()}`);

// Run this after every older terminal/facade preparer. The converted airport can
// expose BGATE/DGATE-looking child meshes whose ancestor/source metadata still
// belongs to T4_WALK. A1 must never accept one of those as the terminal wall.
await import(`./prepare-a1-final-walkway-hierarchy-exclusion-v1.mjs?final-wall=${Date.now()}`);

// The real-wall pass can translate the complete supplied model origin away from
// the original BGL stop. Keep the aircraft/door target in that same translated
// frame instead of making the fixed airport chase a stale source-space target.
await import(`./prepare-a1-relocated-aircraft-target-v1.mjs?relocated-target=${Date.now()}`);

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const source = fs.readFileSync(sourcePath, "utf8");
const authority = "a1-real-wall-registered-rotunda-decoded-kphx-heading-intact-parent-v2";
const targetAuthority = "a1-aircraft-target-follows-intact-parent-relocation-v1";

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
    throw new Error(`${sourcePath}: intact wall-registered A1 requirement is missing ${required}`);
  }
}

console.log("Prepared A1 as one intact supplied Airport_Jetway.glb assembly: measured terminal-wall Rotunda position is preserved, decoded KPHX heading owns the complete parent, the aircraft target follows the same parent relocation, the complete T4_WALK source hierarchy is forbidden as its wall, and no Tunnel A/B/C/Cab child is reparented or independently yawed.");
