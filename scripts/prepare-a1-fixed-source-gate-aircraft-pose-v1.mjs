import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "source-a1-gate-stop-persisted-no-cab-follow-v1";
const marker = "fixed-source-a1-gate-aircraft-pose-v1";

const poseBlock = `          const inspectionAircraftPose = Object.freeze({
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          });`;
const fixedPoseBlock = `          // ${marker}
          // The A1 stand is authored at the source parking stop. Earlier code
          // moved the airplane to wherever the incorrectly oriented Cab ended
          // up, which could make door-contact telemetry perfect while the
          // entire jetway ran underneath the elevated corridor. The gate/plane
          // is authoritative: store and apply the source A1 nose-gear stop and
          // let the Rotunda/bridge rotate toward it.
          const sourceGateInspectionPose = Object.freeze({
            x: 0,
            y: sim.aircraft.position.y,
            z: 0,
            yaw: A1_INSPECTION_AIRCRAFT_YAW,
          });
          sim.aircraft.position.set(
            sourceGateInspectionPose.x,
            sourceGateInspectionPose.y,
            sourceGateInspectionPose.z,
          );
          sim.aircraft.rotation.y = sourceGateInspectionPose.yaw;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDoorAtSourceGate = renderedAircraft.localToWorld(authoredDoorLocal.clone());
          const sourceGateDoorTargetX = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetX);
          const sourceGateDoorTargetZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetZ);
          const sourceGateDoorTargetErrorMeters = [sourceGateDoorTargetX, sourceGateDoorTargetZ].every(Number.isFinite)
            ? Math.hypot(
              renderedDoorAtSourceGate.x - sourceGateDoorTargetX,
              renderedDoorAtSourceGate.z - sourceGateDoorTargetZ,
            )
            : Number.POSITIVE_INFINITY;
          const sourceGateCabSeparationMeters = Math.hypot(
            renderedDoorAtSourceGate.x - exactA1CabContactX,
            renderedDoorAtSourceGate.z - exactA1CabContactZ,
          );
          const inspectionAircraftPose = sourceGateInspectionPose;
          renderer.domElement.dataset.inspectionAircraftFixedSourceGateAuthority = "${authority}";
          renderer.domElement.dataset.inspectionAircraftNoseGearX = sourceGateInspectionPose.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftNoseGearZ = sourceGateInspectionPose.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetX = renderedDoorAtSourceGate.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAtSourceGate.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetX = Number.isFinite(sourceGateDoorTargetX) ? sourceGateDoorTargetX.toFixed(6) : "missing";
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetZ = Number.isFinite(sourceGateDoorTargetZ) ? sourceGateDoorTargetZ.toFixed(6) : "missing";
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetErrorMeters = Number.isFinite(sourceGateDoorTargetErrorMeters) ? sourceGateDoorTargetErrorMeters.toFixed(6) : "missing";
          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = sourceGateCabSeparationMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactAuthority = "source-gate-fixed-aircraft-does-not-follow-cab-v1";`;

if (!source.includes(marker)) {
  if (!source.includes(poseBlock)) {
    throw new Error(`${trainerPath}: persisted A1 inspection pose block is missing`);
  }
  source = source.replace(poseBlock, fixedPoseBlock);
}

source = source.replaceAll(
  'const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2";',
  `const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${authority}";`,
);
source = source.replaceAll(
  'a1InspectionPoseAuthority = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2"',
  `a1InspectionPoseAuthority = "${authority}"`,
);
source = source.replaceAll(
  'inspectionAircraftPoseAuthority = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2"',
  `inspectionAircraftPoseAuthority = "${authority}"`,
);

for (const token of [
  marker,
  `A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${authority}"`,
  "const sourceGateInspectionPose = Object.freeze({",
  "x: 0,",
  "z: 0,",
  "renderedDoorAtSourceGate",
  "uploadedJetwayA1SourceDoorTargetX",
  "uploadedJetwayA1SourceDoorTargetZ",
  "inspectionAircraftSourceGateDoorTargetErrorMeters",
  'inspectionAircraftCabContactAuthority = "source-gate-fixed-aircraft-does-not-follow-cab-v1"',
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: fixed source-gate aircraft pose is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared A1 inspection aircraft at the authored source gate stop (nose gear 0/0) and persisted that pose across reset/mode toggles. The airplane no longer follows an incorrectly oriented jetway Cab.");
