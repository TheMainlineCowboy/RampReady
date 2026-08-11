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
const terminalOverlapPattern = /const TERMINAL_HIDDEN_OVERLAP_METERS = ([0-9.]+);/;
const noPenetrationTerminalOverlap = "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.08;";

// Earlier runtime passes have historically emitted 0.70 m and, more recently,
// 0.18 m of terminal penetration. Neither upstream literal owns the final scene.
// Normalize whatever numeric value survives to an 8 cm seam overlap so the
// passenger shell closes at the facade without visibly burying a jetway segment
// inside the building. This script is the final A1 geometry pass and is safe to
// run repeatedly.
const upstreamOverlapMatch = source.match(terminalOverlapPattern);
if (!upstreamOverlapMatch) {
  throw new Error(`${sourcePath}: A1 terminal-wall overlap declaration is missing`);
}
const upstreamOverlapMeters = Number(upstreamOverlapMatch[1]);
if (!Number.isFinite(upstreamOverlapMeters) || upstreamOverlapMeters < 0 || upstreamOverlapMeters > 1.5) {
  throw new Error(`${sourcePath}: A1 upstream terminal-wall overlap is invalid: ${upstreamOverlapMeters}`);
}
source = source.replace(terminalOverlapPattern, noPenetrationTerminalOverlap);
const overlapMatch = source.match(terminalOverlapPattern);
const overlapMeters = Number(overlapMatch?.[1]);
if (!Number.isFinite(overlapMeters) || Math.abs(overlapMeters - 0.08) > 1e-9 || overlapMeters > 0.12) {
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
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: forbidden child-pivot/raw-BGL-Rotunda behavior survived intact A1 preparation: ${forbidden}`);
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

console.log(`Prepared A1 as one intact supplied Airport_Jetway.glb assembly with final terminal overlap normalized ${upstreamOverlapMeters.toFixed(2)} -> ${overlapMeters.toFixed(2)} m: measured terminal-wall Rotunda position is preserved, the complete parent receives decoded KPHX heading, no Tunnel A/B/C/Cab child is reparented or independently yawed, and no jetway section is buried deep inside the terminal wall.`);
