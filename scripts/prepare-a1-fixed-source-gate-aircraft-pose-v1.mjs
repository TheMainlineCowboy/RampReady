import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "rendered-a1-door-world-to-parent-local-cab-registration-v5";
const marker = "rendered-a1-door-owns-visible-cab-registration-v5";
const maximumDoorTargetErrorMeters = 0.02;
const maximumCabContactErrorMeters = 0.03;

const poseBlock = `          const inspectionAircraftPose = Object.freeze({
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          });`;

const fixedPoseBlock = `          // ${marker}
          // The airport/jetway geometry owns A1. The earlier v4 path made two
          // mistakes that allowed a visibly disconnected airplane to report
          // 0.000 m error: it fed WORLD Cab coordinates directly into the
          // aircraft's LOCAL position, then validated a synthetic CRJ door point
          // instead of the actual rendered mesh door. Use the real rendered door
          // in world space, convert only the required world displacement through
          // the aircraft parent, and verify the visible door after movement.
          const sourceGateDoorTargetWorldX = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldX);
          const sourceGateDoorTargetWorldZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldZ);
          if (![sourceGateDoorTargetWorldX, sourceGateDoorTargetWorldZ].every(Number.isFinite)) {
            throw new Error("A1 exact rendered Cab world endpoint is missing before aircraft registration");
          }
          if (!sim.aircraft.parent) {
            throw new Error("A1 aircraft has no parent transform for world/local Cab registration");
          }

          // Preserve the authored/source parking orientation and the already
          // grounded aircraft Y. Height/lift remains a later jetway-rig concern;
          // this pass owns only the physically visible X/Z door contact.
          sim.aircraft.rotation.y = A1_INSPECTION_AIRCRAFT_YAW;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDoorBeforeSourceGate = renderedAircraft.localToWorld(authoredDoorLocal.clone());
          const requiredWorldDoorDelta = new THREE.Vector3(
            sourceGateDoorTargetWorldX - renderedDoorBeforeSourceGate.x,
            0,
            sourceGateDoorTargetWorldZ - renderedDoorBeforeSourceGate.z,
          );
          const parentLocalDoorStart = sim.aircraft.parent.worldToLocal(renderedDoorBeforeSourceGate.clone());
          const parentLocalDoorEnd = sim.aircraft.parent.worldToLocal(
            renderedDoorBeforeSourceGate.clone().add(requiredWorldDoorDelta),
          );
          const requiredParentLocalDelta = parentLocalDoorEnd.sub(parentLocalDoorStart);
          if (![requiredParentLocalDelta.x, requiredParentLocalDelta.z].every(Number.isFinite)
            || Math.hypot(requiredParentLocalDelta.x, requiredParentLocalDelta.z) > 60) {
            throw new Error(\`A1 rendered-door parent-local relocation is invalid: \${requiredParentLocalDelta.x}, \${requiredParentLocalDelta.z}\`);
          }
          sim.aircraft.position.x += requiredParentLocalDelta.x;
          sim.aircraft.position.z += requiredParentLocalDelta.z;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);

          const renderedDoorAtSourceGate = renderedAircraft.localToWorld(authoredDoorLocal.clone());
          const sourceGateDoorTargetErrorMeters = Math.hypot(
            renderedDoorAtSourceGate.x - sourceGateDoorTargetWorldX,
            renderedDoorAtSourceGate.z - sourceGateDoorTargetWorldZ,
          );
          const sourceGateCabSeparationMeters = Math.hypot(
            renderedDoorAtSourceGate.x - exactA1CabContactX,
            renderedDoorAtSourceGate.z - exactA1CabContactZ,
          );
          if (!(sourceGateDoorTargetErrorMeters <= ${maximumDoorTargetErrorMeters})) {
            throw new Error(\`A1 visible rendered door missed the exact Cab world target by \${sourceGateDoorTargetErrorMeters} m\`);
          }
          if (!(sourceGateCabSeparationMeters <= ${maximumCabContactErrorMeters})) {
            throw new Error(\`A1 visible rendered door missed the published exact Cab by \${sourceGateCabSeparationMeters} m\`);
          }

          const sourceGateInspectionPose = Object.freeze({
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          });
          const inspectionAircraftPose = sourceGateInspectionPose;
          renderer.domElement.dataset.inspectionAircraftFixedSourceGateAuthority = "${authority}";
          renderer.domElement.dataset.inspectionAircraftNoseGearX = sourceGateInspectionPose.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftNoseGearZ = sourceGateInspectionPose.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetX = renderedDoorAtSourceGate.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAtSourceGate.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorStationAuthority = "actual-rendered-door-world-to-parent-local-cab-v1";
          renderer.domElement.dataset.inspectionAircraftDoorAftOfNoseGearMeters = "7.320";
          renderer.domElement.dataset.inspectionAircraftDoorLeftOfCenterlineMeters = "1.340";
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetX = sourceGateDoorTargetWorldX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetZ = sourceGateDoorTargetWorldZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetErrorMeters = sourceGateDoorTargetErrorMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = sourceGateCabSeparationMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactAuthority = "actual-rendered-door-meets-fixed-jetway-cab-v5";
          renderer.domElement.dataset.inspectionAircraftDoorWorldDeltaX = requiredWorldDoorDelta.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorWorldDeltaZ = requiredWorldDoorDelta.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorParentLocalDeltaX = requiredParentLocalDelta.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorParentLocalDeltaZ = requiredParentLocalDelta.z.toFixed(6);`;

if (!source.includes(marker)) {
  const priorPatterns = [
    /          \/\/ source-a1-jetway-owned-aircraft-pose-v4[\s\S]*?          renderer\.domElement\.dataset\.inspectionAircraftCabContactAuthority = "source-jetway-fixed-aircraft-conforms-to-cab-v4";/,
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
source = source.replaceAll("source-a1-jetway-cab-endpoint-aircraft-conforms-v4", authority);

for (const token of [
  marker,
  `A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${authority}"`,
  "const sourceGateDoorTargetWorldX = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldX)",
  "const renderedDoorBeforeSourceGate = renderedAircraft.localToWorld(authoredDoorLocal.clone())",
  "sim.aircraft.parent.worldToLocal(renderedDoorBeforeSourceGate.clone())",
  "sim.aircraft.position.x += requiredParentLocalDelta.x",
  "const renderedDoorAtSourceGate = renderedAircraft.localToWorld(authoredDoorLocal.clone())",
  `sourceGateDoorTargetErrorMeters <= ${maximumDoorTargetErrorMeters}`,
  `sourceGateCabSeparationMeters <= ${maximumCabContactErrorMeters}`,
  'inspectionAircraftDoorStationAuthority = "actual-rendered-door-world-to-parent-local-cab-v1"',
  'inspectionAircraftCabContactAuthority = "actual-rendered-door-meets-fixed-jetway-cab-v5"',
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: rendered-door A1 aircraft pose is missing ${token}`);
}
for (const obsolete of [
  "fixed-source-a1-gate-aircraft-pose-v1",
  "fixed-source-a1-gate-aircraft-pose-v2",
  "fixed-source-a1-gate-aircraft-pose-v3",
  "source-a1-jetway-owned-aircraft-pose-v4",
  "const sourceParkingDoorAtJetway = new THREE.Vector3",
  "const renderedDoorAtSourceGate = sourceParkingDoorAtJetway",
]) {
  if (source.includes(obsolete)) throw new Error(`${trainerPath}: synthetic/mixed-coordinate A1 door registration remains: ${obsolete}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-a1-rendered-door-finalizer-v4.mjs?rendered-door=${Date.now()}`);
console.log("Registered the actual visible A1 aircraft door to the exact fixed jetway Cab in world space, converted the displacement through the aircraft parent transform, and rejected the former synthetic 0.000 m validation path.");