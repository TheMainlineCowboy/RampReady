import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-exact-authored-crj-forward-left-door-target-v1";
const finalVisibleMarker = "a1-final-visible-grounded-door-and-integrated-tunnel-c-v1";

// These values are measured directly from the committed user-painted CRJ GLB,
// not inferred from the nose or copied from a planning-manual station. The
// forward-left passenger-door component occupies x=-1.291842 at the exterior
// skin, is centered vertically at y=2.769294, has a lower sill/bounds edge at
// y=1.802860, and is centered longitudinally at z=2.240745 in the exact authored
// aircraft coordinate frame. Jetway hood contact targets the door-opening center;
// the lower bounds edge is retained only as source telemetry, not as the hood aim.
const fixedAircraftPose = Object.freeze({
  x: -3.822373,
  y: -0.002196,
  z: 10.253820,
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

// Final visible normalization deliberately exposes its stale 7.32/1.34 target so
// this final source-authoritative stage can replace it with measurements from the
// actual rendered CRJ GLB. Do not leave the obsolete values available to later
// readiness or telemetry layers.
source = source.replace(
  `  x: -1.34,\n  centerY: 2.62,\n  sillY: 1.73,\n  z: 7.32,`,
  `  x: ${authoredDoorLocal.x},\n  centerY: ${authoredDoorLocal.centerY},\n  sillY: ${authoredDoorLocal.sillY},\n  z: ${authoredDoorLocal.z},`,
);

if (!source.includes(marker)) {
  const oldTarget = `function toWorldTarget(THREE, group) {\n  // ${finalVisibleMarker}\n  // X/Z come from the fixed A1 aircraft registration. Y must match the actually\n  // rendered grounded CRJ door in WORLD space. The 1.73 m planning-manual sill\n  // dimension is aircraft-relative and must not be substituted for scene world Y.\n  const target = group.localToWorld(new THREE.Vector3(\n    CRJ_FORWARD_LEFT_DOOR.x,\n    0,\n    CRJ_FORWARD_LEFT_DOOR.z,\n  ));\n  target.y = 3;\n  return target;\n}`;
  if (!source.includes(oldTarget)) {
    throw new Error(`${path}: stale nose-derived/final-visible door target is missing`);
  }

  const exactTarget = `// ${finalVisibleMarker}\n// ${marker}\nconst FIXED_A1_RENDERED_AIRCRAFT_POSE = Object.freeze({\n  x: ${fixedAircraftPose.x},\n  y: ${fixedAircraftPose.y},\n  z: ${fixedAircraftPose.z},\n  yaw: ${fixedAircraftPose.yaw},\n});\nconst EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR = Object.freeze({\n  x: ${authoredDoorLocal.x},\n  centerY: ${authoredDoorLocal.centerY},\n  sillY: ${authoredDoorLocal.sillY},\n  z: ${authoredDoorLocal.z},\n});\n\nfunction toWorldTarget(THREE) {\n  // The aircraft is fixed. Rotate the exact GLB door-opening contact center by the\n  // fixed A1 stand yaw and translate it by the fixed nose-gear/root pose. The\n  // jetway must reach this point; no terminal or aircraft transform is allowed to\n  // compensate. The lower door bounds edge is not the hood contact point.\n  const cosYaw = Math.cos(FIXED_A1_RENDERED_AIRCRAFT_POSE.yaw);\n  const sinYaw = Math.sin(FIXED_A1_RENDERED_AIRCRAFT_POSE.yaw);\n  return new THREE.Vector3(\n    FIXED_A1_RENDERED_AIRCRAFT_POSE.x\n      + cosYaw * EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.x\n      + sinYaw * EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.z,\n    FIXED_A1_RENDERED_AIRCRAFT_POSE.y\n      + EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.centerY,\n    FIXED_A1_RENDERED_AIRCRAFT_POSE.z\n      - sinYaw * EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.x\n      + cosYaw * EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.z,\n  );\n}`;
  source = source.replace(oldTarget, exactTarget);
}

for (const required of [
  finalVisibleMarker,
  marker,
  "FIXED_A1_RENDERED_AIRCRAFT_POSE",
  "EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR",
  "x: -1.291842",
  "centerY: 2.769294",
  "sillY: 1.80286",
  "z: 2.240745",
  "x: -3.822373",
  "z: 10.25382",
  "EXACT_AUTHORED_CRJ_FORWARD_LEFT_DOOR.centerY",
]) {
  if (!source.includes(required)) throw new Error(`${path}: exact authored-door target is missing ${required}`);
}
for (const forbidden of [
  "target.y = 3;",
  "z: 7.32,",
  "x: -1.34,",
  "centerY: 2.62,",
  "sillY: 1.73,",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale inferred CRJ door target survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");

const cosYaw = Math.cos(fixedAircraftPose.yaw);
const sinYaw = Math.sin(fixedAircraftPose.yaw);
const worldX = fixedAircraftPose.x + cosYaw * authoredDoorLocal.x + sinYaw * authoredDoorLocal.z;
const worldY = fixedAircraftPose.y + authoredDoorLocal.centerY;
const worldZ = fixedAircraftPose.z - sinYaw * authoredDoorLocal.x + cosYaw * authoredDoorLocal.z;
console.log(`Prepared ${marker}: fixed A1 aircraft pose stays unchanged; exact authored CRJ forward-left door contact-center target is world [${worldX.toFixed(6)}, ${worldY.toFixed(6)}, ${worldZ.toFixed(6)}].`);
