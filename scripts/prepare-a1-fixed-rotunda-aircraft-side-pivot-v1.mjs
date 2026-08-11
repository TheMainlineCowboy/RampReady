import fs from "node:fs";

// The live A1 screenshot proved that selectively reparenting Tunnel A/B/C/Cab
// around a new runtime pivot can visually collapse the supplied jetway into the
// terminal corner and leave its support/wheel geometry suspended. Preserve the
// real-wall-registered Rotunda, apply decoded KPHX heading only to the COMPLETE
// supplied parent, and fail closed if any child-pivot rewrite is present.
await import(`./prepare-a1-source-bgl-rotunda-ownership-v1.mjs?intact-a1=${Date.now()}`);

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
let source = fs.readFileSync(sourcePath, "utf8");
const authority = "a1-real-wall-registered-rotunda-decoded-kphx-heading-intact-parent-v2";
const retiredTerminalOverlap = "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.70;";
const noPenetrationTerminalOverlap = "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.08;";

// The former 0.70 m 'hidden' overlap was visibly not hidden from the apron-side
// A1 view: the generated fixed terminal leg extended deep into the terminal mass.
// Keep only a small 8 cm seam overlap so the shell closes at the wall without a
// visibly buried second bridge segment. This pass runs last in terminal runtime
// preparation and is idempotent, so later production preparation cannot restore
// the deep wall penetration.
if (source.includes(retiredTerminalOverlap)) {
  source = source.replace(retiredTerminalOverlap, noPenetrationTerminalOverlap);
}
if (!source.includes(noPenetrationTerminalOverlap)) {
  throw new Error(`${sourcePath}: A1 terminal-wall overlap is not the required 0.08 m seam-only value`);
}
const overlapMatch = source.match(/const TERMINAL_HIDDEN_OVERLAP_METERS = ([0-9.]+);/);
const overlapMeters = Number(overlapMatch?.[1]);
if (!Number.isFinite(overlapMeters) || overlapMeters < 0.04 || overlapMeters > 0.12) {
  throw new Error(`${sourcePath}: A1 terminal shell would penetrate the terminal too deeply: ${overlapMeters}`);
}
fs.writeFileSync(sourcePath, source, "utf8");

for (const forbidden of [
  "UploadedAirportJetwayA1AircraftSidePivot",
  "bridgePivot.attach(root)",
  "bridgePivot.rotation.y = yawDelta",
  "uploadedJetwayA1AircraftSidePivotRootCount",
  "uploadedJetwayA1RotundaFixedDuringBridgeYaw",
  "a1-fixed-terminal-rotunda-aircraft-side-pivot-v1",
  "const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)",
  retiredTerminalOverlap,
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: forbidden child-pivot/raw-BGL-Rotunda/deep-wall behavior survived intact A1 preparation: ${forbidden}`);
  }
}

for (const required of [
  authority,
  "const sourceRotundaTarget = fixedRotundaCenter.clone();",
  "const rawBglPlacementX = Number(placement.x);",
  "anchor.rotation.y = Number(placement.yaw)",
  "const rotatedSourceHeadingRotundaCenter = objectCenterInFleet",
  "const yawDelta = 0;",
  "uploadedJetwayA1SourceRotundaPositionErrorMeters",
  "uploadedJetwayA1MeasuredTerminalWallX",
  "A1 FINAL wall-registered Rotunda-to-real-wall distance is invalid",
  noPenetrationTerminalOverlap,
]) {
  if (!source.includes(required)) {
    throw new Error(`${sourcePath}: intact wall-registered A1 requirement is missing ${required}`);
  }
}

console.log(`Prepared A1 as one intact supplied Airport_Jetway.glb assembly with ${overlapMeters.toFixed(2)} m terminal seam overlap: measured terminal-wall Rotunda position is preserved, the complete parent receives decoded KPHX heading, no Tunnel A/B/C/Cab child is reparented or independently yawed, and no jetway section is buried deep inside the terminal wall.`);
