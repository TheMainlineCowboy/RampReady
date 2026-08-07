import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "source-a1-gate-stop-world-offset-persisted-no-cab-follow-v2";
const marker = "fixed-source-a1-gate-aircraft-pose-v2";
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
          // authored A1 stop are deliberately shifted +6.2 m in scene Z. Keep
          // the airplane at that real fixed stop; never move it to wherever an
          // incorrectly oriented jetway Cab happens to end.
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
          const renderedDoorAtSourceGate = renderedAircraft.localToWorld(authoredDoorLocal.clone());
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
            throw new Error(\`A1 fixed source-stop rendered door missed its exact target by \${sourceGateDoorTargetErrorMeters} m\`);
          }
          if (!(sourceGateCabSeparationMeters <= ${maximumCabContactErrorMeters})) {
            throw new Error(\`A1 exact Cab missed the fixed source-stop rendered door by \${sourceGateCabSeparationMeters} m\`);
          }
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
          renderer.domElement.dataset.inspectionAircraftCabContactAuthority = "source-gate-fixed-aircraft-exact-rendered-door-contact-v2";`;

if (!source.includes(marker)) {
  if (source.includes("fixed-source-a1-gate-aircraft-pose-v1")) {
    // A previous prepared copy may already contain the v1 block. Replace the
    // complete stored-pose section rather than layering another aircraft move.
    const v1Pattern = /          \/\/ fixed-source-a1-gate-aircraft-pose-v1[\s\S]*?          renderer\.domElement\.dataset\.inspectionAircraftCabContactAuthority = "source-gate-fixed-aircraft-does-not-follow-cab-v1";/;
    if (!v1Pattern.test(source)) throw new Error(`${trainerPath}: v1 fixed-source aircraft block could not be replaced safely`);
    source = source.replace(v1Pattern, fixedPoseBlock.trimStart());
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
source = source.replaceAll(
  'source-a1-gate-stop-persisted-no-cab-follow-v1',
  authority,
);

for (const token of [
  marker,
  `A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${authority}"`,
  "const sourceGateInspectionPose = Object.freeze({",
  "z: NOSE_START_Z,",
  "renderedDoorAtSourceGate",
  "uploadedJetwayA1SourceDoorTargetWorldX",
  "uploadedJetwayA1SourceDoorTargetWorldZ",
  `sourceGateDoorTargetErrorMeters <= ${maximumDoorTargetErrorMeters}`,
  `sourceGateCabSeparationMeters <= ${maximumCabContactErrorMeters}`,
  'inspectionAircraftCabContactAuthority = "source-gate-fixed-aircraft-exact-rendered-door-contact-v2"',
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: fixed world-offset source-gate aircraft pose is missing ${token}`);
}
if (source.includes("fixed-source-a1-gate-aircraft-pose-v1")) {
  throw new Error(`${trainerPath}: obsolete world-Z=0 A1 source-stop patch remains`);
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-a1-rendered-door-finalizer-v4.mjs?rendered-door=${Date.now()}`);
console.log("Prepared A1 inspection aircraft at the real +6.2 m world-Z source stop and required the exact Cab to meet the actual authored rendered forward-left door without relocating either the airplane or the real terminal/Rotunda joint.");
