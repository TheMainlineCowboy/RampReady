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

// The animation loop used to declare the stored A1 pose invalid whenever the UI
// was in training mode even if the aircraft had not moved. Make the assertion
// physical: the pose is applied when its live X/Z/yaw matches the one stored A1
// gate pose, regardless of which UI mode is active.
source = source.replace(
  /const liveInspectionAircraftPoseApplied = inspectionActive\s*&& liveInspectionAircraftPoseError <= 0\.01\s*&& liveInspectionAircraftYawError <= 0\.001;/,
  `const liveInspectionAircraftPoseApplied = liveInspectionAircraftPoseError <= 0.01
        && liveInspectionAircraftYawError <= 0.001;`,
);

source = source.replaceAll(
  "renderer.domElement.dataset.inspectionAircraftPoseApplied = String(inspectionRef.current);",
  `renderer.domElement.dataset.inspectionAircraftPoseApplied = "true";\n          renderer.domElement.dataset.aircraftModePoseAuthority = "${authority}";`,
);

source = source.replaceAll(
  ': "training-approach-start";',
  `: "${authority}";`,
);

// Publish the actual physical position from the aircraft root each frame. This is
// intentionally not copied from the stored target so browser verification can
// catch any future mode-toggle code that moves the airplane again.
const liveTelemetryAnchor = `      canvas.dataset.inspectionAircraftPoseStored = String(Boolean(liveStoredInspectionAircraftPose));`;
const liveTelemetry = `${liveTelemetryAnchor}
      canvas.dataset.aircraftModePoseAuthority = "${authority}";
      canvas.dataset.aircraftModePoseLiveX = sim.aircraft.position.x.toFixed(6);
      canvas.dataset.aircraftModePoseLiveY = sim.aircraft.position.y.toFixed(6);
      canvas.dataset.aircraftModePoseLiveZ = sim.aircraft.position.z.toFixed(6);
      canvas.dataset.aircraftModePoseLiveYaw = sim.aircraft.rotation.y.toFixed(6);`;
if (source.includes(liveTelemetryAnchor) && !source.includes("aircraftModePoseLiveX")) {
  source = source.replace(liveTelemetryAnchor, liveTelemetry);
}

for (const token of [
  "const storedResetAircraftPose = sim.aircraft.userData.a1InspectionPose || null;",
  "const storedToggleAircraftPose = sim.aircraft.userData.a1InspectionPose || null;",
  `aircraftModePoseAuthority = "${authority}"`,
  "const liveInspectionAircraftPoseApplied = liveInspectionAircraftPoseError <= 0.01",
  "aircraftModePoseLiveX = sim.aircraft.position.x.toFixed(6)",
  "aircraftModePoseLiveZ = sim.aircraft.position.z.toFixed(6)",
  "aircraftModePoseLiveYaw = sim.aircraft.rotation.y.toFixed(6)",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: unified A1 aircraft pose is missing ${token}`);
}
if (restoreTrainingPattern.test(source)) {
  throw new Error(`${trainerPath}: training mode still restores a second A1 aircraft pose`);
}
if (/const liveInspectionAircraftPoseApplied = inspectionActive\s*&&/.test(source)) {
  throw new Error(`${trainerPath}: live A1 pose validation is still incorrectly gated by UI mode`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Locked A1 to one physical aircraft pose across training and free-drive inspection and published live root coordinates so mode-switch regressions are measurable.");
