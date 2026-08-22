import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-exact-authored-crj-forward-left-door-target-v2-sill-and-center";
const legacyMarker = "a1-exact-authored-crj-forward-left-door-target-v1";
const finalVisibleMarker = "a1-final-visible-grounded-door-and-integrated-tunnel-c-v1";

// These values are measured directly from the committed user-painted CRJ GLB,
// not inferred from the nose or copied from a planning-manual station. The
// forward-left passenger-door component occupies x=-1.291842 at the exterior
// skin, is centered vertically at y=2.769294, has its physical lower sill at
// y=1.802860, and is centered longitudinally at z=2.240745 in the exact authored
// aircraft coordinate frame.
//
// The A1 aircraft itself is fixed at the decoded stand center. Do not retain the
// former Cab-derived outboard pose here: this target owns the final movable-bridge
// fit and therefore must describe the same immovable aircraft pose used at runtime.
const fixedAircraftPose = Object.freeze({
  x: 0,
  y: -0.002196,
  z: 6.2,
  yaw: 0.008570,
});
const authoredDoorLocal = Object.freeze({
  x: -1.291842,
  centerY: 2.769294,
  sillY: 1.802860,
  z: 2.240745,
});

let source = fs.readFileSync(path, "utf8");
if (!source.includes(finalVisibleMarker)) {
  throw new Error(`${path}: exact authored-door target must run after final visible normalization`);
}

source = source.replace(
  `  x: -1.34,\n  centerY: 2.62,\n  sillY: 1.73,\n  z: 7.32,`,
  `  x: ${authoredDoorLocal.x},\n  centerY: ${authoredDoorLocal.centerY},\n  sillY: ${authoredDoorLocal.sillY},\n  z: ${authoredDoorLocal.z},`,
);

if (!source.includes(marker)) {
  const oldTarget = `function toWorldTarget(THREE, group) {\n  // ${finalVisibleMarker}\n  // X/Z come from the fixed A1 aircraft registration. Y must match the actually\n  // rendered grounded CRJ door in WORLD space. The 1.73 m planning-manual sill\n  // dimension is aircraft-relative and must not be substituted for scene world Y.\n  const target = group.localToWorld(new THREE.Vector3(\n    CRJ_FORWARD_LEFT_DOOR.x,\n    0,\n    CRJ_FORWARD_LEFT_DOOR.z,\n  ));\n  target.y = 3;\n  return target;\n}`;
  if (!source.includes(oldTarget)) {
    throw new Error(`${path}: stale nose-derived/final-visible door target is missing`);
  }

  const exactTarget = `// ${finalVisibleMarker}\n// ${legacyMarker}\n// ${marker}\nconst FIXED_A1_RENDERED_AIRCRAFT_POSE = Object.freeze({\n  x: ${fixedAircraftPose.x},\n  y: ${fixedAircraftPose.y},\n  z: ${fixedAircraftPose.z},\n  yaw: ${fixedAircraftPose.yaw},\n});\nconst EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR = Object.freeze({\n  x: ${authoredDoorLocal.x},\n  centerY: ${authoredDoorLocal.centerY},\n  sillY: ${authoredDoorLocal.sillY},\n  z: ${authoredDoorLocal.z},\n});\n\nfunction toWorldTarget(THREE) {\n  // The aircraft is fixed at the decoded A1 stand center. X/Z come from the\n  // exact authored door component and Y is the physical door sill because this\n  // target drives tunnel pitch and boarding-floor height.\n  const cosYaw = Math.cos(FIXED_A1_RENDERED_AIRCRAFT_POSE.yaw);\n  const sinYaw = Math.sin(FIXED_A1_RENDERED_AIRCRAFT_POSE.yaw);\n  return new THREE.Vector3(\n    FIXED_A1_RENDERED_AIRCRAFT_POSE.x\n      + cosYaw * EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.x\n      + sinYaw * EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.z,\n    FIXED_A1_RENDERED_AIRCRAFT_POSE.y\n      + EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.sillY,\n    FIXED_A1_RENDERED_AIRCRAFT_POSE.z\n      - sinYaw * EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.x\n      + cosYaw * EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.z,\n  );\n}\n\nfunction exactAuthoredCrjDoorCenterWorldY() {\n  return FIXED_A1_RENDERED_AIRCRAFT_POSE.y\n    + EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.centerY;\n}`;
  source = source.replace(oldTarget, exactTarget);
}

for (const required of [
  finalVisibleMarker,
  marker,
  legacyMarker,
  "FIXED_A1_RENDERED_AIRCRAFT_POSE",
  "EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR",
  "x: -1.291842",
  "centerY: 2.769294",
  "sillY: 1.80286",
  "z: 2.240745",
  "x: 0",
  "z: 6.2",
  "EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.sillY",
  "exactAuthoredCrjDoorCenterWorldY",
]) {
  if (!source.includes(required)) throw new Error(`${path}: exact authored-door target is missing ${required}`);
}
for (const forbidden of [
  "target.y = 3;",
  "z: 7.32,",
  "x: -1.34,",
  "centerY: 2.62,",
  "sillY: 1.73,",
  "x: -3.822373",
  "z: 10.253820",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale inferred/outboard CRJ door target survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");

const cosYaw = Math.cos(fixedAircraftPose.yaw);
const sinYaw = Math.sin(fixedAircraftPose.yaw);
const worldX = fixedAircraftPose.x + cosYaw * authoredDoorLocal.x + sinYaw * authoredDoorLocal.z;
const worldSillY = fixedAircraftPose.y + authoredDoorLocal.sillY;
const worldCenterY = fixedAircraftPose.y + authoredDoorLocal.centerY;
const worldZ = fixedAircraftPose.z - sinYaw * authoredDoorLocal.x + cosYaw * authoredDoorLocal.z;
console.log(`Prepared ${marker}: centered fixed A1 aircraft pose remains [${fixedAircraftPose.x}, ${fixedAircraftPose.y}, ${fixedAircraftPose.z}]; exact authored CRJ forward-left door sill target is world [${worldX.toFixed(6)}, ${worldSillY.toFixed(6)}, ${worldZ.toFixed(6)}], while hood center Y=${worldCenterY.toFixed(6)} is retained as a separate coverage constraint.`);
