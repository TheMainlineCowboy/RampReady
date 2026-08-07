import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const authority = "a1-single-aircraft-pose-training-and-free-drive-v1";
let source = fs.readFileSync(trainerPath, "utf8");

// The live app was maintaining one stored A1 aircraft pose for inspection and
// then deliberately restoring a different training pose. That made the same A1
// aircraft jump when switching modes. Keep the source-gate pose that was already
// verified against the rendered aircraft and use it in BOTH modes.
source = source.replace(
  /const storedResetAircraftPose = resetUsesInspectionAircraftPose\s*\? sim\.aircraft\.userData\.a1InspectionPose\s*:\s*null;/,
  "const storedResetAircraftPose = sim.aircraft.userData.a1InspectionPose || null;",
);
source = source.replace(
  /const storedToggleAircraftPose = next\s*\? sim\.aircraft\.userData\.a1InspectionPose\s*:\s*null;/,
  "const storedToggleAircraftPose = sim.aircraft.userData.a1InspectionPose || null;",
);

source = source
  .replaceAll("storedResetAircraftPose?.x ?? (resetUsesInspectionAircraftPose ? A1_INSPECTION_NOSE_GEAR_X : 0)", "storedResetAircraftPose?.x ?? A1_INSPECTION_NOSE_GEAR_X")
  .replaceAll("storedResetAircraftPose?.z ?? (resetUsesInspectionAircraftPose ? A1_INSPECTION_NOSE_GEAR_Z : NOSE_START_Z)", "storedResetAircraftPose?.z ?? A1_INSPECTION_NOSE_GEAR_Z")
  .replaceAll("(resetUsesInspectionAircraftPose ? A1_INSPECTION_AIRCRAFT_YAW : 0)", "A1_INSPECTION_AIRCRAFT_YAW")
  .replaceAll("storedToggleAircraftPose?.x ?? (next ? A1_INSPECTION_NOSE_GEAR_X : 0)", "storedToggleAircraftPose?.x ?? A1_INSPECTION_NOSE_GEAR_X")
  .replaceAll("storedToggleAircraftPose?.z ?? (next ? A1_INSPECTION_NOSE_GEAR_Z : NOSE_START_Z)", "storedToggleAircraftPose?.z ?? A1_INSPECTION_NOSE_GEAR_Z")
  .replaceAll("(next ? A1_INSPECTION_AIRCRAFT_YAW : 0)", "A1_INSPECTION_AIRCRAFT_YAW");

const restoreTrainingPattern = /\n\s*if \(!inspectionRef\.current\) \{\n\s*sim\.aircraft\.position\.set\(\n\s*trainingAircraftPoseBeforeInspectionRegistration\.x,\n\s*trainingAircraftPoseBeforeInspectionRegistration\.y,\n\s*trainingAircraftPoseBeforeInspectionRegistration\.z,\n\s*\);\n\s*sim\.aircraft\.rotation\.y = trainingAircraftPoseBeforeInspectionRegistration\.yaw;\n\s*sim\.aircraft\.updateMatrixWorld\(true\);\n\s*renderedAircraft\.updateMatrixWorld\(true\);\n\s*\}/;
source = source.replace(restoreTrainingPattern, "");
source = source.replaceAll(
  "renderer.domElement.dataset.inspectionAircraftPoseApplied = String(inspectionRef.current);",
  `renderer.domElement.dataset.inspectionAircraftPoseApplied = "true";\n          renderer.domElement.dataset.aircraftModePoseAuthority = "${authority}";`,
);

// Keep the telemetry truthful: switching UI modes must not imply a second
// physical aircraft pose when the aircraft itself is intentionally unchanged.
source = source.replaceAll(
  ': "training-approach-start";',
  `: "${authority}";`,
);

for (const token of [
  "const storedResetAircraftPose = sim.aircraft.userData.a1InspectionPose || null;",
  "const storedToggleAircraftPose = sim.aircraft.userData.a1InspectionPose || null;",
  `aircraftModePoseAuthority = "${authority}"`,
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: unified A1 aircraft pose is missing ${token}`);
}
if (restoreTrainingPattern.test(source)) {
  throw new Error(`${trainerPath}: training mode still restores a second A1 aircraft pose`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Locked A1 to one physical aircraft pose across training and free-drive inspection; mode changes no longer move the airplane.");
