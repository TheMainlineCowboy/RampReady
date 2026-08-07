import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "source-a1-gate-stop-world-offset-persisted-no-cab-follow-v3";
const marker = "fixed-source-a1-gate-aircraft-pose-v3";
const maximumDoorTargetErrorMeters = 0.06;
const maximumCabContactErrorMeters = 0.08;

const poseBlock = `          const inspectionAircraftPose = Object.freeze({
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          });`;
const fixedPoseBlock = `          // ${marker}
          // Source A1 parking is local (0,0), while Terminal 4 and the trainer's
          // authored A1 stop are shifted +6.2 m in scene Z. Keep the airplane at
          // that fixed source stop; never move it to wherever a bad bridge Cab
          // happens to end. Derive the passenger-door target independently from
          // the PHX parking heading and CRJ geometry used by the source placement:
          // 7.32 m aft of nose gear and 1.34 m left of centerline.
          const sourceGateInspectionPose = Object.freeze({
            x: 0,
            y: sim.aircraft.position.y,
            z: NOSE_START_Z,
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
          const sourceParkingHeadingRadians = THREE.MathUtils.degToRad(270.491);
          const sourceParkingForwardX = Math.cos(sourceParkingHeadingRadians);
          const sourceParkingForwardZ = Math.sin(sourceParkingHeadingRadians);
          const sourceParkingLeftX = sourceParkingForwardZ;
          const sourceParkingLeftZ = -sourceParkingForwardX;
          const sourceParkingDoorAtFixedGate = new THREE.Vector3(
            sourceGateInspectionPose.x
              - sourceParkingForwardX * 7.32
              + sourceParkingLeftX * 1.34,
            renderedAircraft.localToWorld(authoredDoorLocal.clone()).y,
            sourceGateInspectionPose.z
              - sourceParkingForwardZ * 7.32
              + sourceParkingLeftZ * 1.34,
          );
          // Keep this variable name for downstream telemetry compatibility; X/Z
          // now represent the actual source-parking forward-left door station.
          const renderedDoorAtSourceGate = sourceParkingDoorAtFixedGate;
          const sourceGateDoorTargetX = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldX);
          const sourceGateDoorTargetZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldZ);
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
          if (!(sourceGateDoorTargetErrorMeters <= ${maximumDoorTargetErrorMeters})) {
            throw new Error(\`A1 fixed source-stop PHX/CRJ door missed its exact target by \${sourceGateDoorTargetErrorMeters} m\`);
          }
          if (!(sourceGateCabSeparationMeters <= ${maximumCabContactErrorMeters})) {
            throw new Error(\`A1 exact Cab missed the fixed source-stop PHX/CRJ door by \${sourceGateCabSeparationMeters} m\`);
          }
          const inspectionAircraftPose = sourceGateInspectionPose;
          renderer.domElement.dataset.inspectionAircraftFixedSourceGateAuthority = "${authority}";
          renderer.domElement.dataset.inspectionAircraftNoseGearX = sourceGateInspectionPose.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftNoseGearZ = sourceGateInspectionPose.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetX = renderedDoorAtSourceGate.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAtSourceGate.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorStationAuthority = "phx-source-parking-7p32m-aft-1p34m-left-v1";
          renderer.domElement.dataset.inspectionAircraftDoorAftOfNoseGearMeters = "7.320";
          renderer.domElement.dataset.inspectionAircraftDoorLeftOfCenterlineMeters = "1.340";
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetX = Number.isFinite(sourceGateDoorTargetX) ? sourceGateDoorTargetX.toFixed(6) : "missing";
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetZ = Number.isFinite(sourceGateDoorTargetZ) ? sourceGateDoorTargetZ.toFixed(6) : "missing";
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetErrorMeters = Number.isFinite(sourceGateDoorTargetErrorMeters) ? sourceGateDoorTargetErrorMeters.toFixed(6) : "missing";
          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = sourceGateCabSeparationMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactAuthority = "source-gate-fixed-aircraft-phx-parking-door-contact-v3";`;

if (!source.includes(marker)) {
  const priorPatterns = [
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

for (const token of [
  marker,
  `A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${authority}"`,
  "const sourceGateInspectionPose = Object.freeze({",
  "z: NOSE_START_Z,",
  "const sourceParkingHeadingRadians = THREE.MathUtils.degToRad(270.491)",
  "sourceParkingForwardX * 7.32",
  "sourceParkingLeftX * 1.34",
  "const renderedDoorAtSourceGate = sourceParkingDoorAtFixedGate",
  "uploadedJetwayA1SourceDoorTargetWorldX",
  "uploadedJetwayA1SourceDoorTargetWorldZ",
  `sourceGateDoorTargetErrorMeters <= ${maximumDoorTargetErrorMeters}`,
  `sourceGateCabSeparationMeters <= ${maximumCabContactErrorMeters}`,
  'inspectionAircraftDoorStationAuthority = "phx-source-parking-7p32m-aft-1p34m-left-v1"',
  'inspectionAircraftCabContactAuthority = "source-gate-fixed-aircraft-phx-parking-door-contact-v3"',
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: fixed PHX source-gate aircraft pose is missing ${token}`);
}
for (const obsolete of [
  "fixed-source-a1-gate-aircraft-pose-v1",
  "fixed-source-a1-gate-aircraft-pose-v2",
  "source-gate-fixed-aircraft-exact-rendered-door-contact-v2",
]) {
  if (source.includes(obsolete)) throw new Error(`${trainerPath}: obsolete A1 source-stop door registration remains: ${obsolete}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-a1-rendered-door-finalizer-v4.mjs?rendered-door=${Date.now()}`);
console.log("Prepared A1 inspection aircraft at the fixed +6.2 m source stop and independently derived the PHX/CRJ forward-left door 7.32 m aft and 1.34 m left of nose gear; the bridge must meet that target without moving the airplane.");
