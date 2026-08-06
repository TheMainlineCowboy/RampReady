import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const registrationMarker = "authored-rendered-door-to-final-cab-a1-aircraft-pose-v4";
const lifecycleAuthority = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2";

if (!source.includes(registrationMarker)) {
  throw new Error(`${trainerPath}: measured A1 aircraft registration must be prepared before pose lifecycle wiring`);
}

const gatedRegistration = `        if (inspectionRef.current && !sim.aircraft.userData["${registrationMarker}"]) {`;
const persistentRegistration = `        if (!sim.aircraft.userData["${registrationMarker}"]) {`;
if (source.includes(gatedRegistration)) {
  source = source.replace(gatedRegistration, persistentRegistration);
} else if (!source.includes(persistentRegistration)) {
  throw new Error(`${trainerPath}: A1 aircraft registration gate is missing`);
}

const moveAnchor = `          sim.aircraft.position.x += aircraftRelocationX;
          sim.aircraft.position.z += aircraftRelocationZ;
          sim.aircraft.updateMatrixWorld(true);`;
const moveWithTrainingPose = `          const trainingAircraftPoseBeforeInspectionRegistration = {
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          };
          sim.aircraft.position.x += aircraftRelocationX;
          sim.aircraft.position.z += aircraftRelocationZ;
          sim.aircraft.updateMatrixWorld(true);`;
if (source.includes(moveAnchor) && !source.includes("trainingAircraftPoseBeforeInspectionRegistration")) {
  source = source.replace(moveAnchor, moveWithTrainingPose);
}

const markerAnchor = `          sim.aircraft.userData["${registrationMarker}"] = true;`;
const lifecycleBlock = `          const inspectionAircraftPose = Object.freeze({
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          });
          sim.aircraft.userData.a1InspectionPose = inspectionAircraftPose;
          sim.aircraft.userData.a1InspectionPoseAuthority = "${lifecycleAuthority}";
          sim.aircraft.userData["${registrationMarker}"] = true;
          renderer.domElement.dataset.inspectionAircraftPoseStored = "true";
          renderer.domElement.dataset.inspectionAircraftPoseAuthority = "${lifecycleAuthority}";
          if (!inspectionRef.current) {
            sim.aircraft.position.set(
              trainingAircraftPoseBeforeInspectionRegistration.x,
              trainingAircraftPoseBeforeInspectionRegistration.y,
              trainingAircraftPoseBeforeInspectionRegistration.z,
            );
            sim.aircraft.rotation.y = trainingAircraftPoseBeforeInspectionRegistration.yaw;
            sim.aircraft.updateMatrixWorld(true);
            renderedAircraft.updateMatrixWorld(true);
          }
          renderer.domElement.dataset.inspectionAircraftPoseApplied = String(inspectionRef.current);`;
if (source.includes(markerAnchor) && !source.includes("a1InspectionPoseAuthority")) {
  source = source.replace(markerAnchor, lifecycleBlock);
}

source = source
  .replaceAll(
    "renderer.domElement.dataset.inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(6);",
    "renderer.domElement.dataset.inspectionAircraftNoseGearX = inspectionAircraftPose.x.toFixed(6);",
  )
  .replaceAll(
    "renderer.domElement.dataset.inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(6);",
    "renderer.domElement.dataset.inspectionAircraftNoseGearZ = inspectionAircraftPose.z.toFixed(6);",
  );

const preparedResetBlock = `    const resetUsesInspectionAircraftPose = inspectionRef.current;
    sim.aircraft.position.set(
      resetUsesInspectionAircraftPose ? A1_INSPECTION_NOSE_GEAR_X : 0,
      0,
      resetUsesInspectionAircraftPose ? A1_INSPECTION_NOSE_GEAR_Z : NOSE_START_Z,
    );
    sim.aircraft.rotation.y = resetUsesInspectionAircraftPose ? A1_INSPECTION_AIRCRAFT_YAW : 0;`;
const measuredResetBlock = `    const resetUsesInspectionAircraftPose = inspectionRef.current;
    const storedResetAircraftPose = resetUsesInspectionAircraftPose
      ? sim.aircraft.userData.a1InspectionPose
      : null;
    sim.aircraft.position.set(
      storedResetAircraftPose?.x ?? (resetUsesInspectionAircraftPose ? A1_INSPECTION_NOSE_GEAR_X : 0),
      storedResetAircraftPose?.y ?? 0,
      storedResetAircraftPose?.z ?? (resetUsesInspectionAircraftPose ? A1_INSPECTION_NOSE_GEAR_Z : NOSE_START_Z),
    );
    sim.aircraft.rotation.y = storedResetAircraftPose?.yaw
      ?? (resetUsesInspectionAircraftPose ? A1_INSPECTION_AIRCRAFT_YAW : 0);
    sim.aircraft.updateMatrixWorld(true);
    sim.renderer.domElement.dataset.inspectionAircraftPoseApplied = String(
      resetUsesInspectionAircraftPose && Boolean(storedResetAircraftPose),
    );`;
if (source.includes(preparedResetBlock)) {
  source = source.replace(preparedResetBlock, measuredResetBlock);
} else if (!source.includes("const storedResetAircraftPose = resetUsesInspectionAircraftPose")) {
  throw new Error(`${trainerPath}: prepared inspection reset aircraft pose block is missing`);
}

const preparedToggleBlock = `      sim.aircraft.position.set(
        next ? A1_INSPECTION_NOSE_GEAR_X : 0,
        0,
        next ? A1_INSPECTION_NOSE_GEAR_Z : NOSE_START_Z,
      );
      sim.aircraft.rotation.y = next ? A1_INSPECTION_AIRCRAFT_YAW : 0;`;
const measuredToggleBlock = `      const storedToggleAircraftPose = next
        ? sim.aircraft.userData.a1InspectionPose
        : null;
      sim.aircraft.position.set(
        storedToggleAircraftPose?.x ?? (next ? A1_INSPECTION_NOSE_GEAR_X : 0),
        storedToggleAircraftPose?.y ?? 0,
        storedToggleAircraftPose?.z ?? (next ? A1_INSPECTION_NOSE_GEAR_Z : NOSE_START_Z),
      );
      sim.aircraft.rotation.y = storedToggleAircraftPose?.yaw
        ?? (next ? A1_INSPECTION_AIRCRAFT_YAW : 0);
      sim.aircraft.updateMatrixWorld(true);
      sim.renderer.domElement.dataset.inspectionAircraftPoseApplied = String(
        next && Boolean(storedToggleAircraftPose),
      );`;
if (source.includes(preparedToggleBlock)) {
  source = source.replace(preparedToggleBlock, measuredToggleBlock);
} else if (!source.includes("const storedToggleAircraftPose = next")) {
  throw new Error(`${trainerPath}: prepared inspection toggle aircraft pose block is missing`);
}

source = source.replaceAll(
  `sim.renderer.domElement.dataset.inspectionAircraftPoseAuthority = next
        ? A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY
        : "training-approach-start";`,
  `sim.renderer.domElement.dataset.inspectionAircraftPoseAuthority = next
        ? (sim.aircraft.userData.a1InspectionPoseAuthority || A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY)
        : "training-approach-start";`,
);
source = source.replaceAll(
  `canvas.dataset.inspectionAircraftPoseAuthority = inspectionActive
        ? A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY
        : "training-approach-start";`,
  `const liveStoredInspectionAircraftPose = sim.aircraft.userData.a1InspectionPose || null;
      const liveInspectionAircraftPoseError = liveStoredInspectionAircraftPose
        ? Math.hypot(
          sim.aircraft.position.x - liveStoredInspectionAircraftPose.x,
          sim.aircraft.position.z - liveStoredInspectionAircraftPose.z,
        )
        : Number.POSITIVE_INFINITY;
      const liveInspectionAircraftYawError = liveStoredInspectionAircraftPose
        ? Math.abs(Math.atan2(
          Math.sin(sim.aircraft.rotation.y - liveStoredInspectionAircraftPose.yaw),
          Math.cos(sim.aircraft.rotation.y - liveStoredInspectionAircraftPose.yaw),
        ))
        : Number.POSITIVE_INFINITY;
      const liveInspectionAircraftPoseApplied = inspectionActive
        && liveInspectionAircraftPoseError <= 0.01
        && liveInspectionAircraftYawError <= 0.001;
      canvas.dataset.inspectionAircraftPoseStored = String(Boolean(liveStoredInspectionAircraftPose));
      canvas.dataset.inspectionAircraftPoseApplied = String(liveInspectionAircraftPoseApplied);
      canvas.dataset.inspectionAircraftPoseErrorMeters = Number.isFinite(liveInspectionAircraftPoseError)
        ? liveInspectionAircraftPoseError.toFixed(6)
        : "missing";
      canvas.dataset.inspectionAircraftPoseAuthority = inspectionActive
        ? (sim.aircraft.userData.a1InspectionPoseAuthority || A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY)
        : "training-approach-start";`,
);

for (const token of [
  persistentRegistration,
  "trainingAircraftPoseBeforeInspectionRegistration",
  "sim.aircraft.userData.a1InspectionPose = inspectionAircraftPose",
  `a1InspectionPoseAuthority = "${lifecycleAuthority}"`,
  `inspectionAircraftPoseAuthority = "${lifecycleAuthority}"`,
  "inspectionAircraftPoseStored = \"true\"",
  "const storedResetAircraftPose = resetUsesInspectionAircraftPose",
  "const storedToggleAircraftPose = next",
  "const liveStoredInspectionAircraftPose = sim.aircraft.userData.a1InspectionPose || null",
  "liveInspectionAircraftPoseApplied",
  "inspectionAircraftPoseErrorMeters",
  "inspectionAircraftNoseGearX = inspectionAircraftPose.x.toFixed(6)",
  "inspectionAircraftNoseGearZ = inspectionAircraftPose.z.toFixed(6)",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: A1 inspection aircraft lifecycle token is missing: ${token}`);
  }
}
if (source.includes(gatedRegistration)
  || source.includes(preparedResetBlock)
  || source.includes(preparedToggleBlock)) {
  throw new Error(`${trainerPath}: stale fixed A1 inspection aircraft lifecycle remains`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Persisted the measured rendered-CRJ A1 Cab pose, reapplied it explicitly on inspection reset and mode entry, and exposed live per-frame pose equality instead of the obsolete fixed photo-stop constants.");