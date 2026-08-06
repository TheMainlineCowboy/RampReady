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

const defaultPoseBlock = `    sim.aircraft.position.set(0, 0, NOSE_START_Z);
    sim.aircraft.rotation.y = 0;`;
const lifecyclePoseBlock = `    const storedInspectionAircraftPose = inspectionRef.current
      ? sim.aircraft.userData.a1InspectionPose
      : null;
    if (storedInspectionAircraftPose) {
      sim.aircraft.position.set(
        storedInspectionAircraftPose.x,
        storedInspectionAircraftPose.y,
        storedInspectionAircraftPose.z,
      );
      sim.aircraft.rotation.y = storedInspectionAircraftPose.yaw;
      sim.renderer.domElement.dataset.inspectionAircraftPoseApplied = "true";
    } else {
      sim.aircraft.position.set(0, 0, NOSE_START_Z);
      sim.aircraft.rotation.y = 0;
      sim.renderer.domElement.dataset.inspectionAircraftPoseApplied = "false";
    }
    sim.aircraft.updateMatrixWorld(true);`;
let lifecycleReplacementCount = 0;
while (source.includes(defaultPoseBlock)) {
  source = source.replace(defaultPoseBlock, lifecyclePoseBlock);
  lifecycleReplacementCount += 1;
}
if (lifecycleReplacementCount < 2 && !source.includes("const storedInspectionAircraftPose = inspectionRef.current")) {
  throw new Error(`${trainerPath}: expected reset and inspection-toggle aircraft pose anchors`);
}

for (const token of [
  persistentRegistration,
  "trainingAircraftPoseBeforeInspectionRegistration",
  "sim.aircraft.userData.a1InspectionPose = inspectionAircraftPose",
  `a1InspectionPoseAuthority = "${lifecycleAuthority}"`,
  `inspectionAircraftPoseAuthority = "${lifecycleAuthority}"`,
  "inspectionAircraftPoseStored = \"true\"",
  "inspectionAircraftPoseApplied = String(inspectionRef.current)",
  "const storedInspectionAircraftPose = inspectionRef.current",
  "inspectionAircraftNoseGearX = inspectionAircraftPose.x.toFixed(6)",
  "inspectionAircraftNoseGearZ = inspectionAircraftPose.z.toFixed(6)",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: A1 inspection aircraft lifecycle token is missing: ${token}`);
  }
}
if (source.includes(gatedRegistration)) {
  throw new Error(`${trainerPath}: terminal-load-only A1 inspection registration gate remains`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log(`Persisted the measured rendered-CRJ A1 Cab pose and reapplied it across ${Math.max(2, lifecycleReplacementCount)} inspection reset/toggle path(s), while restoring the separate training pose outside inspection mode.`);