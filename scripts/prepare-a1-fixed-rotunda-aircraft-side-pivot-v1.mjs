import fs from "node:fs";

// The live A1 screenshot proved that selectively reparenting Tunnel A/B/C/Cab
// around a new runtime pivot can visually collapse the supplied jetway into the
// terminal corner and leave its support/wheel geometry suspended. The airport
// source owns the complete supplied assembly. Apply the existing decoded-KPHX
// whole-parent ownership pass, then fail closed if any child-pivot rewrite is
// present. The aircraft must conform to the jetway; the jetway is never broken
// apart to chase the aircraft door.
await import(`./prepare-a1-source-bgl-rotunda-ownership-v1.mjs?intact-a1=${Date.now()}`);

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const source = fs.readFileSync(sourcePath, "utf8");
const authority = "a1-decoded-kphx-bgl-rotunda-and-heading-own-physical-jetway-v1";

for (const forbidden of [
  "UploadedAirportJetwayA1AircraftSidePivot",
  "bridgePivot.attach(root)",
  "bridgePivot.rotation.y = yawDelta",
  "uploadedJetwayA1AircraftSidePivotRootCount",
  "uploadedJetwayA1RotundaFixedDuringBridgeYaw",
  "a1-fixed-terminal-rotunda-aircraft-side-pivot-v1",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: forbidden child-pivot/reparenting survived intact A1 preparation: ${forbidden}`);
  }
}

for (const required of [
  authority,
  "const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)",
  "anchor.rotation.y = Number(placement.yaw)",
  "const yawDelta = 0;",
  "uploadedJetwayA1SourceRotundaPositionErrorMeters",
  "uploadedJetwayA1MeasuredTerminalWallX",
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: intact source-owned A1 requirement is missing ${required}`);
  }
}

console.log("Prepared A1 as one intact supplied Airport_Jetway.glb assembly at the decoded KPHX gate pose. No Tunnel A/B/C/Cab child is reparented or independently yawed; the aircraft must conform to the fixed source jetway.");
