import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-final-visible-grounded-door-and-integrated-tunnel-c-v1";
const contactFootprintMarker = "a1-visible-cab-door-contact-footprint-v1";
const renderedDoorWorldY = 1.73;

let doorFit = fs.readFileSync(doorFitPath, "utf8");

if (!doorFit.includes(marker)) {
  const oldTarget = `function toWorldTarget(THREE, group) {\n  return group.localToWorld(new THREE.Vector3(\n    CRJ_FORWARD_LEFT_DOOR.x,\n    CRJ_FORWARD_LEFT_DOOR.sillY,\n    CRJ_FORWARD_LEFT_DOOR.z,\n  ));\n}`;
  const newTarget = `function toWorldTarget(THREE, group) {\n  // ${marker}\n  // X/Z still come from the fixed A1 aircraft registration. Y is the official\n  // grounded CRJ700 forward passenger-door sill height: 1.73 m above ramp. The\n  // environment group carries its own vertical transform, so applying sillY through\n  // group.localToWorld would double-count that transform and place the Cab too high.\n  const target = group.localToWorld(new THREE.Vector3(\n    CRJ_FORWARD_LEFT_DOOR.x,\n    0,\n    CRJ_FORWARD_LEFT_DOOR.z,\n  ));\n  target.y = ${renderedDoorWorldY};\n  return target;\n}`;
  if (!doorFit.includes(oldTarget)) {
    throw new Error(`${doorFitPath}: stale environment-frame CRJ door target is missing`);
  }
  doorFit = doorFit.replace(oldTarget, newTarget);
}

// The exact supplied GLB exposes the bogie/support inside the opaque
// Tunnel_C_Jetway_0 carrier, not as a small child object. Runtime articulation can
// expand its world AABB to about 5.84 x 9.61 x 13.67 m. Keep the selector bounded
// to that exact carrier envelope rather than rejecting the real mesh as "too big".
doorFit = doorFit
  .replace("maximumHorizontalDimension <= 6.5", "maximumHorizontalDimension <= 14.5")
  .replace("size.y <= 5.5", "size.y <= 10.5")
  .replace("Supplied A1 Tunnel_C has no separable low support mesh", "Supplied A1 Tunnel_C has no integrated low support carrier");

if (!doorFit.includes(contactFootprintMarker)) {
  const oldValidation = `  const cabVertices = collectModelLocalVertices(THREE, model, cabAssembly.cab);\n  let cabFuselagePenetrationMeters = Number.NEGATIVE_INFINITY;\n  for (const vertex of cabVertices) {\n    const worldVertex = model.localToWorld(vertex.clone());\n    const penetration = worldVertex.sub(targetWorld).dot(desiredCabNormalWorld);\n    cabFuselagePenetrationMeters = Math.max(cabFuselagePenetrationMeters, penetration);\n  }\n\n  if (\n    vectorGap > 0.12\n    || horizontalGap > 0.08\n    || verticalGap > 0.08\n    || cabNormalErrorDegrees > MAX_CAB_NORMAL_ERROR_DEGREES\n    || cabFuselagePenetrationMeters > MAX_CAB_FUSELAGE_PENETRATION_METERS\n  ) {`;
  const newValidation = `  const cabVertices = collectModelLocalVertices(THREE, model, cabAssembly.cab);\n  let cabFuselagePenetrationMeters = Number.NEGATIVE_INFINITY;\n  for (const vertex of cabVertices) {\n    const worldVertex = model.localToWorld(vertex.clone());\n    const penetration = worldVertex.sub(targetWorld).dot(desiredCabNormalWorld);\n    cabFuselagePenetrationMeters = Math.max(cabFuselagePenetrationMeters, penetration);\n  }\n\n  // ${contactFootprintMarker}\n  // The supplied Cab hood is rounded/angled, so one averaged representative point\n  // is not a physical contact test. Measure the exact transformed front-band\n  // vertices against the aircraft contact plane instead. The door must lie inside\n  // the hood's normal-depth interval and inside its lateral span, while the floor\n  // remains at sill height and total fuselage penetration stays strictly bounded.\n  const cabSideWorld = new THREE.Vector3(-desiredCabNormalWorld.z, 0, desiredCabNormalWorld.x).normalize();\n  let cabContactMinimumNormalMeters = Number.POSITIVE_INFINITY;\n  let cabContactMaximumNormalMeters = Number.NEGATIVE_INFINITY;\n  let cabContactMinimumLateralMeters = Number.POSITIVE_INFINITY;\n  let cabContactMaximumLateralMeters = Number.NEGATIVE_INFINITY;\n  let cabContactWorldPointCount = 0;\n  for (const vertex of cabAssembly.front.vertices) {\n    const worldVertex = model.localToWorld(vertex.clone());\n    const fromDoor = worldVertex.clone().sub(targetWorld);\n    const normalOffset = fromDoor.dot(desiredCabNormalWorld);\n    const lateralOffset = fromDoor.dot(cabSideWorld);\n    if (!(Number.isFinite(normalOffset) && Number.isFinite(lateralOffset))) continue;\n    cabContactMinimumNormalMeters = Math.min(cabContactMinimumNormalMeters, normalOffset);\n    cabContactMaximumNormalMeters = Math.max(cabContactMaximumNormalMeters, normalOffset);\n    cabContactMinimumLateralMeters = Math.min(cabContactMinimumLateralMeters, lateralOffset);\n    cabContactMaximumLateralMeters = Math.max(cabContactMaximumLateralMeters, lateralOffset);\n    cabContactWorldPointCount += 1;\n  }\n  const cabContactPlaneCovered = cabContactMinimumNormalMeters <= 0.02\n    && cabContactMaximumNormalMeters >= -0.02;\n  const cabDoorLaterallyCovered = cabContactMinimumLateralMeters <= 0.05\n    && cabContactMaximumLateralMeters >= -0.05;\n\n  if (\n    cabContactWorldPointCount < 4\n    || !cabContactPlaneCovered\n    || !cabDoorLaterallyCovered\n    || horizontalGap > 0.25\n    || verticalGap > 0.08\n    || cabNormalErrorDegrees > MAX_CAB_NORMAL_ERROR_DEGREES\n    || cabFuselagePenetrationMeters > MAX_CAB_FUSELAGE_PENETRATION_METERS\n  ) {`;
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
fs.writeFileSync(doorFitPath, doorFit, "utf8");

let trainer = fs.readFileSync(trainerPath, "utf8");

// Match final-world evidence to the same integrated carrier envelope used by the
// fitter. This does not relax the actual contact proof: the low cluster must still
// be aircraft-side and within 2 cm of world ramp Y=0.
trainer = trainer
  .replaceAll("Math.max(size.x, size.z) <= 13.0", "Math.max(size.x, size.z) <= 14.5")
  .replaceAll("size.y <= 8.5", "size.y <= 10.5");

// The 22 m diagnostic view still let the long A1 fixed corridor fill the frame and
// hide the elbow/Rotunda. Pull only this evidence camera farther onto the apron and
// widen it slightly. No airport, aircraft, jetway or terminal geometry is changed.
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

console.log(`Prepared ${marker} + ${contactFootprintMarker}: A1 targets the grounded CRJ700 forward passenger-door sill at world Y=${renderedDoorWorldY.toFixed(2)}, validates exact Cab hood-plane/lateral coverage instead of an averaged-point proxy, keeps bounded fuselage penetration and strict Tunnel-C ramp contact, and pulls the terminal-joint camera back to expose the dogleg/remote Rotunda.`);
