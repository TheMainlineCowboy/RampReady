import fs from "node:fs";

await import(`./prepare-a1-visible-airframe-world-registration-v1.mjs?visible-world-registration=${Date.now()}`);

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "visible-a1-door-world-axis-parent-local-cab-registration-v6";
const marker = "visible-a1-door-owns-final-cab-registration-v6";
const maximumDoorTargetErrorMeters = 0.02;
const maximumCabContactErrorMeters = 0.03;

const poseBlock = `          const inspectionAircraftPose = Object.freeze({
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          });`;

const fixedPoseBlock = `          // ${marker}
          // Final A1 X/Z registration is measured from the VISIBLE CRJ mesh,
          // not an exporter-local authored point. The preceding world-registration
          // pass fixes measureVisibleAirframeDoor() so its sampled world bounds,
          // aircraft axes and parent-local translation all use one coordinate
          // system. Re-measure here after every late A1 preparer, then move the
          // complete grounded aircraft only by the remaining parent-local delta.
          const sourceGateDoorTargetWorldX = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldX);
          const sourceGateDoorTargetWorldZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldZ);
          if (![sourceGateDoorTargetWorldX, sourceGateDoorTargetWorldZ].every(Number.isFinite)) {
            throw new Error("A1 exact rendered Cab world endpoint is missing before visible-airframe registration");
          }
          if (!sim.aircraft.parent || typeof measureVisibleAirframeDoor !== "function") {
            throw new Error("A1 visible-airframe registration is missing the aircraft parent or visible-door measurer");
          }

          // Keep the actual A1 source stand orientation and already grounded Y.
          // Height is a later physical bridge-lift concern; this pass owns only
          // the visible horizontal door/Cab connection.
          sim.aircraft.rotation.y = A1_INSPECTION_AIRCRAFT_YAW;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDoorBeforeSourceGate = measureVisibleAirframeDoor().point;
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
            throw new Error(\`A1 visible-door parent-local relocation is invalid: \${requiredParentLocalDelta.x}, \${requiredParentLocalDelta.z}\`);
          }
          sim.aircraft.position.x += requiredParentLocalDelta.x;
          sim.aircraft.position.z += requiredParentLocalDelta.z;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);

          const renderedDoorAtSourceGate = measureVisibleAirframeDoor().point;
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
          renderer.domElement.dataset.inspectionAircraftDoorStationAuthority = "visible-mesh-world-axis-parent-local-cab-v2";
          renderer.domElement.dataset.inspectionAircraftDoorAftOfNoseGearMeters = "7.320";
          renderer.domElement.dataset.inspectionAircraftDoorLeftOfCenterlineMeters = "1.340";
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetX = sourceGateDoorTargetWorldX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetZ = sourceGateDoorTargetWorldZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetErrorMeters = sourceGateDoorTargetErrorMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = sourceGateCabSeparationMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactAuthority = "visible-mesh-door-meets-fixed-jetway-cab-v6";
          renderer.domElement.dataset.inspectionAircraftDoorWorldDeltaX = requiredWorldDoorDelta.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorWorldDeltaZ = requiredWorldDoorDelta.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorParentLocalDeltaX = requiredParentLocalDelta.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorParentLocalDeltaZ = requiredParentLocalDelta.z.toFixed(6);`;

if (!source.includes(marker)) {
  const priorPatterns = [
    /          \/\/ rendered-a1-door-owns-visible-cab-registration-v5[\s\S]*?          renderer\.domElement\.dataset\.inspectionAircraftCabContactAuthority = "actual-rendered-door-meets-fixed-jetway-cab-v5";/,
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
for (const staleAuthority of [
  "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2",
  "source-a1-gate-stop-persisted-no-cab-follow-v1",
  "source-a1-gate-stop-world-offset-persisted-no-cab-follow-v2",
  "source-a1-gate-stop-world-offset-persisted-no-cab-follow-v3",
  "source-a1-jetway-cab-endpoint-aircraft-conforms-v4",
  "rendered-a1-door-world-to-parent-local-cab-registration-v5",
]) {
  source = source.replaceAll(staleAuthority, authority);
}

for (const token of [
  marker,
  `A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${authority}"`,
  "const renderedDoorBeforeSourceGate = measureVisibleAirframeDoor().point",
  "sim.aircraft.parent.worldToLocal(renderedDoorBeforeSourceGate.clone())",
  "sim.aircraft.position.x += requiredParentLocalDelta.x",
  "const renderedDoorAtSourceGate = measureVisibleAirframeDoor().point",
  `sourceGateDoorTargetErrorMeters <= ${maximumDoorTargetErrorMeters}`,
  `sourceGateCabSeparationMeters <= ${maximumCabContactErrorMeters}`,
  'inspectionAircraftDoorStationAuthority = "visible-mesh-world-axis-parent-local-cab-v2"',
  'inspectionAircraftCabContactAuthority = "visible-mesh-door-meets-fixed-jetway-cab-v6"',
  "inspectionAircraftVisibleDoorWorldRegistrationAuthority",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: visible-mesh A1 aircraft pose is missing ${token}`);
}
for (const obsolete of [
  "fixed-source-a1-gate-aircraft-pose-v1",
  "fixed-source-a1-gate-aircraft-pose-v2",
  "fixed-source-a1-gate-aircraft-pose-v3",
  "source-a1-jetway-owned-aircraft-pose-v4",
  "rendered-a1-door-owns-visible-cab-registration-v5",
  "const renderedDoorBeforeSourceGate = renderedAircraft.localToWorld(authoredDoorLocal.clone())",
  "const renderedDoorAtSourceGate = renderedAircraft.localToWorld(authoredDoorLocal.clone())",
]) {
  if (source.includes(obsolete)) throw new Error(`${trainerPath}: synthetic/mixed-coordinate A1 door registration remains: ${obsolete}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-a1-rendered-door-finalizer-v4.mjs?rendered-door=${Date.now()}`);
console.log("Registered the actual visible A1 airframe door to the exact fixed jetway Cab using world-space mesh axes and parent-local aircraft translation; synthetic exporter-local door validation is no longer accepted.");
