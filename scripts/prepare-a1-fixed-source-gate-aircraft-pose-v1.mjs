import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "source-a1-jetway-cab-endpoint-aircraft-conforms-v4";
const marker = "source-a1-jetway-owned-aircraft-pose-v4";
const maximumDoorTargetErrorMeters = 0.02;
const maximumCabContactErrorMeters = 0.03;

const poseBlock = `          const inspectionAircraftPose = Object.freeze({
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          });`;
const fixedPoseBlock = `          // ${marker}
          // The decoded PHX jetway now owns A1. Do not rotate or translate the
          // complete bridge to chase a synthetic CRJ door. Read the exact source
          // Cab endpoint published by the final jetway stage and place the
          // aircraft so its forward-left door lands there. Aircraft position is
          // intentionally the adjustable side of this relationship.
          const sourceGateDoorTargetX = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldX);
          const sourceGateDoorTargetZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldZ);
          if (![sourceGateDoorTargetX, sourceGateDoorTargetZ].every(Number.isFinite)) {
            throw new Error("A1 source-jetway Cab endpoint is missing before aircraft registration");
          }
          const sourceParkingHeadingRadians = THREE.MathUtils.degToRad(270.491);
          const sourceParkingForwardX = Math.cos(sourceParkingHeadingRadians);
          const sourceParkingForwardZ = Math.sin(sourceParkingHeadingRadians);
          const sourceParkingLeftX = sourceParkingForwardZ;
          const sourceParkingLeftZ = -sourceParkingForwardX;
          const sourceGateInspectionPose = Object.freeze({
            x: sourceGateDoorTargetX
              + sourceParkingForwardX * 7.32
              - sourceParkingLeftX * 1.34,
            y: sim.aircraft.position.y,
            z: sourceGateDoorTargetZ
              + sourceParkingForwardZ * 7.32
              - sourceParkingLeftZ * 1.34,
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
          const sourceParkingDoorAtJetway = new THREE.Vector3(
            sourceGateInspectionPose.x
              - sourceParkingForwardX * 7.32
              + sourceParkingLeftX * 1.34,
            renderedAircraft.localToWorld(authoredDoorLocal.clone()).y,
            sourceGateInspectionPose.z
              - sourceParkingForwardZ * 7.32
              + sourceParkingLeftZ * 1.34,
          );
          // Keep this variable name for downstream telemetry compatibility. X/Z
          // are the actual door location after the aircraft conforms to the
          // source-authored A1 Cab endpoint.
          const renderedDoorAtSourceGate = sourceParkingDoorAtJetway;
          const sourceGateDoorTargetErrorMeters = Math.hypot(
            renderedDoorAtSourceGate.x - sourceGateDoorTargetX,
            renderedDoorAtSourceGate.z - sourceGateDoorTargetZ,
          );
          const sourceGateCabSeparationMeters = Math.hypot(
            renderedDoorAtSourceGate.x - exactA1CabContactX,
            renderedDoorAtSourceGate.z - exactA1CabContactZ,
          );
          if (!(sourceGateDoorTargetErrorMeters <= ${maximumDoorTargetErrorMeters})) {
            throw new Error(\`A1 aircraft-conformed door missed the source jetway target by \${sourceGateDoorTargetErrorMeters} m\`);
          }
          if (!(sourceGateCabSeparationMeters <= ${maximumCabContactErrorMeters})) {
            throw new Error(\`A1 aircraft-conformed door missed the source jetway Cab by \${sourceGateCabSeparationMeters} m\`);
          }
          const inspectionAircraftPose = sourceGateInspectionPose;
          renderer.domElement.dataset.inspectionAircraftFixedSourceGateAuthority = "${authority}";
          renderer.domElement.dataset.inspectionAircraftNoseGearX = sourceGateInspectionPose.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftNoseGearZ = sourceGateInspectionPose.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetX = renderedDoorAtSourceGate.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAtSourceGate.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorStationAuthority = "source-jetway-cab-plus-crj-door-offset-v1";
          renderer.domElement.dataset.inspectionAircraftDoorAftOfNoseGearMeters = "7.320";
          renderer.domElement.dataset.inspectionAircraftDoorLeftOfCenterlineMeters = "1.340";
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetX = sourceGateDoorTargetX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetZ = sourceGateDoorTargetZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetErrorMeters = sourceGateDoorTargetErrorMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = sourceGateCabSeparationMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactAuthority = "source-jetway-fixed-aircraft-conforms-to-cab-v4";`;

if (!source.includes(marker)) {
  const priorPatterns = [
    /          \/\/ fixed-source-a1-gate-aircraft-pose-v3[\s\S]*?          renderer\.domElement\.dataset\.inspectionAircraftCabContactAuthority = "source-gate-fixed-aircraft-phx-parking-door-contact-v3";/,
    /          \/\/ fixed-source-a1-gate-aircraft-pose-v2[\s\S]*?          renderer\.domElement\.dataset\.inspectionAircraftCabContactAuthority = "source-gate-fixed-aircraft-exact-rendered-door-contact-v2";/,
    /          \/\/ fixed-source-a1-gate-aircraft-pose-v1[\s\S]*?          renderer\.domElement\.dataset\.inspectionAircraftCabContactAuthority = "source-gate-fixed-aircraft-does-not-follow-cab-v1";/,
  ];
  const priorPattern = priorPatterns.find((pattern) => pattern.test(source));
  if (priorPattern) {
    source = source.replace(priorPattern, fixedPoseBlock.trimStart());
  } else {
    if (!source.includes(poseBlock)) throw new Error(`${trainerPath}: persisted A1 inspection pose block is missing`);
    source = source.replace(poseBlock, fixedPoseBlock);
  }
}

source = source.replace(
  /const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "[^"]+";/,
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
source = source.replaceAll("source-a1-gate-stop-persisted-no-cab-follow-v1", authority);
source = source.replaceAll("source-a1-gate-stop-world-offset-persisted-no-cab-follow-v2", authority);
source = source.replaceAll("source-a1-gate-stop-world-offset-persisted-no-cab-follow-v3", authority);

for (const token of [
  marker,
  `A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${authority}"`,
  "const sourceGateDoorTargetX = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldX)",
  "const sourceGateDoorTargetZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldZ)",
  "sourceParkingForwardX * 7.32",
  "sourceParkingLeftX * 1.34",
  "sourceParkingForwardZ * 7.32",
  "sourceParkingLeftZ * 1.34",
  "const renderedDoorAtSourceGate = sourceParkingDoorAtJetway",
  `sourceGateDoorTargetErrorMeters <= ${maximumDoorTargetErrorMeters}`,
  `sourceGateCabSeparationMeters <= ${maximumCabContactErrorMeters}`,
  'inspectionAircraftDoorStationAuthority = "source-jetway-cab-plus-crj-door-offset-v1"',
  'inspectionAircraftCabContactAuthority = "source-jetway-fixed-aircraft-conforms-to-cab-v4"',
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: source-jetway-owned A1 aircraft pose is missing ${token}`);
}
for (const obsolete of [
  "fixed-source-a1-gate-aircraft-pose-v1",
  "fixed-source-a1-gate-aircraft-pose-v2",
  "fixed-source-a1-gate-aircraft-pose-v3",
  "source-gate-fixed-aircraft-exact-rendered-door-contact-v2",
  "source-gate-fixed-aircraft-phx-parking-door-contact-v3",
]) {
  if (source.includes(obsolete)) throw new Error(`${trainerPath}: obsolete aircraft-owned A1 source-stop registration remains: ${obsolete}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-a1-rendered-door-finalizer-v4.mjs?rendered-door=${Date.now()}`);
console.log("Prepared A1 inspection aircraft from the fixed decoded PHX jetway Cab endpoint: the bridge/Rotunda remains at the airport source pose and the aircraft nose position is derived so its forward-left door meets the jetway, never the reverse.");
