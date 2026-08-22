import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-visible-grounded-door-and-integrated-tunnel-c-v1";
const contactFootprintMarker = "a1-visible-cab-door-contact-footprint-v1";
// This is a WORLD-space coordinate in the rendered RampReady scene, not the
// aircraft-relative CRJ700 sill dimension. Fresh accepted-head telemetry places
// the visible grounded forward door at ~2.998 m world Y. Using 1.73 here treated
// an aircraft-relative planning-manual dimension as an absolute scene coordinate
// and pulled the articulated bridge down into a visibly broken stacked pose.
const renderedDoorWorldY = 3.0;

let doorFit = fs.readFileSync(doorFitPath, "utf8");

// Keep the final physical fitter on the same measured/source-registered CRJ700
// longitudinal door location already enforced by the airport/jetway contract.
// The stale 2.22 m longitudinal value visibly pulled the Cab/hood over the cockpit.
doorFit = doorFit.replace(
  `  x: -1.35,\n  centerY: 2.62,\n  sillY: 1.73,\n  z: 2.22,`,
  `  x: -1.34,\n  centerY: 2.62,\n  sillY: 1.73,\n  z: 7.32,`,
);

if (!doorFit.includes(marker)) {
  const oldTarget = `function toWorldTarget(THREE, group) {\n  return group.localToWorld(new THREE.Vector3(\n    CRJ_FORWARD_LEFT_DOOR.x,\n    CRJ_FORWARD_LEFT_DOOR.sillY,\n    CRJ_FORWARD_LEFT_DOOR.z,\n  ));\n}`;
  const newTarget = `function toWorldTarget(THREE, group) {\n  // ${marker}\n  // X/Z come from the fixed A1 aircraft registration. Y must match the actually\n  // rendered grounded CRJ door in WORLD space. The 1.73 m planning-manual sill\n  // dimension is aircraft-relative and must not be substituted for scene world Y.\n  const target = group.localToWorld(new THREE.Vector3(\n    CRJ_FORWARD_LEFT_DOOR.x,\n    0,\n    CRJ_FORWARD_LEFT_DOOR.z,\n  ));\n  target.y = ${renderedDoorWorldY};\n  return target;\n}`;
  if (!doorFit.includes(oldTarget)) {
    throw new Error(`${doorFitPath}: stale environment-frame CRJ door target is missing`);
  }
  doorFit = doorFit.replace(oldTarget, newTarget);
}

// The exact supplied GLB exposes the bogie/support inside the opaque
// Tunnel_C_Jetway_0 carrier, not as a small child object. Runtime articulation can
// expand its world AABB to about 5.84 x 9.61 x 13.67 m. This selector is measurement
// authority only; a later integrity stage forbids translating this whole carrier.
doorFit = doorFit
  .replace("maximumHorizontalDimension <= 6.5", "maximumHorizontalDimension <= 14.5")
  .replace("size.y <= 5.5", "size.y <= 10.5")
  .replace("Supplied A1 Tunnel_C has no separable low support mesh", "Supplied A1 Tunnel_C has no integrated low support carrier");

if (!doorFit.includes(contactFootprintMarker)) {
  const oldValidation = `  const cabVertices = collectModelLocalVertices(THREE, model, cabAssembly.cab);\n  let cabFuselagePenetrationMeters = Number.NEGATIVE_INFINITY;\n  for (const vertex of cabVertices) {\n    const worldVertex = model.localToWorld(vertex.clone());\n    const penetration = worldVertex.sub(targetWorld).dot(desiredCabNormalWorld);\n    cabFuselagePenetrationMeters = Math.max(cabFuselagePenetrationMeters, penetration);\n  }\n\n  if (\n    vectorGap > 0.12\n    || horizontalGap > 0.08\n    || verticalGap > 0.08\n    || cabNormalErrorDegrees > MAX_CAB_NORMAL_ERROR_DEGREES\n    || cabFuselagePenetrationMeters > MAX_CAB_FUSELAGE_PENETRATION_METERS\n  ) {`;
  const newValidation = `  const cabVertices = collectModelLocalVertices(THREE, model, cabAssembly.cab);\n  let cabFuselagePenetrationMeters = Number.NEGATIVE_INFINITY;\n  for (const vertex of cabVertices) {\n    const worldVertex = model.localToWorld(vertex.clone());\n    const penetration = worldVertex.sub(targetWorld).dot(desiredCabNormalWorld);\n    cabFuselagePenetrationMeters = Math.max(cabFuselagePenetrationMeters, penetration);\n  }\n\n  // ${contactFootprintMarker}\n  // The supplied Cab hood is rounded/angled, so one averaged representative point\n  // is not a physical contact test. Measure the exact transformed front-band\n  // vertices against the aircraft contact plane instead. The door must lie inside\n  // the hood's normal-depth interval and inside its lateral span, while the floor\n  // remains at the rendered door height and total fuselage penetration stays bounded.\n  const cabSideWorld = new THREE.Vector3(-desiredCabNormalWorld.z, 0, desiredCabNormalWorld.x).normalize();\n  let cabContactMinimumNormalMeters = Number.POSITIVE_INFINITY;\n  let cabContactMaximumNormalMeters = Number.NEGATIVE_INFINITY;\n  let cabContactMinimumLateralMeters = Number.POSITIVE_INFINITY;\n  let cabContactMaximumLateralMeters = Number.NEGATIVE_INFINITY;\n  let cabContactWorldPointCount = 0;\n  for (const vertex of cabAssembly.front.vertices) {\n    const worldVertex = model.localToWorld(vertex.clone());\n    const fromDoor = worldVertex.clone().sub(targetWorld);\n    const normalOffset = fromDoor.dot(desiredCabNormalWorld);\n    const lateralOffset = fromDoor.dot(cabSideWorld);\n    if (!(Number.isFinite(normalOffset) && Number.isFinite(lateralOffset))) continue;\n    cabContactMinimumNormalMeters = Math.min(cabContactMinimumNormalMeters, normalOffset);\n    cabContactMaximumNormalMeters = Math.max(cabContactMaximumNormalMeters, normalOffset);\n    cabContactMinimumLateralMeters = Math.min(cabContactMinimumLateralMeters, lateralOffset);\n    cabContactMaximumLateralMeters = Math.max(cabContactMaximumLateralMeters, lateralOffset);\n    cabContactWorldPointCount += 1;\n  }\n  const cabContactPlaneCovered = cabContactMinimumNormalMeters <= 0.02\n    && cabContactMaximumNormalMeters >= -0.02;\n  const cabDoorLaterallyCovered = cabContactMinimumLateralMeters <= 0.05\n    && cabContactMaximumLateralMeters >= -0.05;\n\n  if (\n    cabContactWorldPointCount < 4\n    || !cabContactPlaneCovered\n    || !cabDoorLaterallyCovered\n    || horizontalGap > 0.25\n    || verticalGap > 0.08\n    || cabNormalErrorDegrees > MAX_CAB_NORMAL_ERROR_DEGREES\n    || cabFuselagePenetrationMeters > MAX_CAB_FUSELAGE_PENETRATION_METERS\n  ) {`;
  if (!doorFit.includes(oldValidation)) {
    throw new Error(`${doorFitPath}: stale Cab point-gap validation block is missing before contact-footprint normalization`);
  }
  doorFit = doorFit.replace(oldValidation, newValidation);

  const resultNeedle = `    cabFuselagePenetrationMeters,\n    contactWidthMeters: cabAssembly.contactWidth,`;
  const resultReplacement = `    cabFuselagePenetrationMeters,\n    cabContactPlaneCovered,\n    cabDoorLaterallyCovered,\n    cabContactWorldPointCount,\n    cabContactMinimumNormalMeters,\n    cabContactMaximumNormalMeters,\n    cabContactMinimumLateralMeters,\n    cabContactMaximumLateralMeters,\n    contactWidthMeters: cabAssembly.contactWidth,`;
  if (!doorFit.includes(resultNeedle)) throw new Error(`${doorFitPath}: V11 result telemetry anchor is missing`);
  doorFit = doorFit.replace(resultNeedle, resultReplacement);

  const telemetryNeedle = `  group.userData.uploadedJetwayA1DoorFitCabFuselagePenetrationMeters = cabFuselagePenetrationMeters;\n  group.userData.uploadedJetwayA1DoorFitContactWidthMeters = cabAssembly.contactWidth;`;
  const telemetryReplacement = `  group.userData.uploadedJetwayA1DoorFitCabFuselagePenetrationMeters = cabFuselagePenetrationMeters;\n  group.userData.uploadedJetwayA1DoorFitCabContactPlaneCovered = cabContactPlaneCovered;\n  group.userData.uploadedJetwayA1DoorFitCabDoorLaterallyCovered = cabDoorLaterallyCovered;\n  group.userData.uploadedJetwayA1DoorFitCabContactWorldPointCount = cabContactWorldPointCount;\n  group.userData.uploadedJetwayA1DoorFitCabContactMinimumNormalMeters = cabContactMinimumNormalMeters;\n  group.userData.uploadedJetwayA1DoorFitCabContactMaximumNormalMeters = cabContactMaximumNormalMeters;\n  group.userData.uploadedJetwayA1DoorFitCabContactMinimumLateralMeters = cabContactMinimumLateralMeters;\n  group.userData.uploadedJetwayA1DoorFitCabContactMaximumLateralMeters = cabContactMaximumLateralMeters;\n  group.userData.uploadedJetwayA1DoorFitContactWidthMeters = cabAssembly.contactWidth;`;
  if (!doorFit.includes(telemetryNeedle)) throw new Error(`${doorFitPath}: V11 contact telemetry anchor is missing`);
  doorFit = doorFit.replace(telemetryNeedle, telemetryReplacement);
}

for (const required of [
  marker,
  contactFootprintMarker,
  "x: -1.34",
  "z: 7.32",
  `target.y = ${renderedDoorWorldY};`,
  "maximumHorizontalDimension <= 14.5",
  "size.y <= 10.5",
  "cabContactPlaneCovered",
  "cabDoorLaterallyCovered",
  "cabContactWorldPointCount < 4",
  "horizontalGap > 0.25",
]) {
  if (!doorFit.includes(required)) throw new Error(`${doorFitPath}: final visible geometry normalization is missing ${required}`);
}
if (doorFit.includes("a1-measured-door-low-slope-pitch-envelope-v1")) {
  throw new Error(`${doorFitPath}: obsolete 1.73-world-Y shallow-pitch workaround survived final normalization`);
}
fs.writeFileSync(doorFitPath, doorFit, "utf8");

let trainer = fs.readFileSync(trainerPath, "utf8");

// Match final-world evidence to the same integrated carrier envelope used by the
// fitter. This is measurement only; carrier integrity is enforced before bundling.
trainer = trainer
  .replaceAll("Math.max(size.x, size.z) <= 13.0", "Math.max(size.x, size.z) <= 14.5")
  .replaceAll("size.y <= 8.5", "size.y <= 10.5");

// Pull only this evidence camera farther onto the apron and widen it slightly so
// the long fixed corridor/elbow/remote Rotunda remain visible in one frame.
trainer = trainer
  .replace("const exactA1JointSideDistance = 22;", "const exactA1JointSideDistance = 34;")
  .replace("inspectionCamera.fov = 50;", "inspectionCamera.fov = 55;");

for (const required of [
  "Math.max(size.x, size.z) <= 14.5",
  "size.y <= 10.5",
  "const exactA1JointSideDistance = 34;",
]) {
  if (!trainer.includes(required)) throw new Error(`${trainerPath}: final visible evidence normalization is missing ${required}`);
}
for (const stale of [
  "Math.max(size.x, size.z) <= 13.0",
  "size.y <= 8.5",
  "const exactA1JointSideDistance = 22;",
]) {
  if (trainer.includes(stale)) throw new Error(`${trainerPath}: stale final A1 evidence normalization remains: ${stale}`);
}
fs.writeFileSync(trainerPath, trainer, "utf8");

console.log(`Prepared ${marker} + ${contactFootprintMarker}: A1 targets the source-registered CRJ forward door at 7.32 m aft / 1.34 m left and the measured rendered world Y=${renderedDoorWorldY.toFixed(2)}, validates exact Cab hood-plane/lateral coverage, preserves the normal physical pitch guard, and keeps final evidence framed on the dogleg/remote Rotunda.`);
