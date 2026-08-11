import fs from "node:fs";

await import(`./prepare-a1-visible-airframe-world-registration-v1.mjs?visible-world-registration=${Date.now()}`);

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "final-live-cab-mesh-visible-door-registration-v7";
const marker = "final-live-cab-mesh-owns-a1-aircraft-registration-v7";
const maximumDoorTargetErrorMeters = 0.02;
const maximumCabContactErrorMeters = 0.03;

const poseBlock = `          const inspectionAircraftPose = Object.freeze({
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          });`;

const fixedPoseBlock = `          // ${marker}
          // Never trust an earlier cached Cab endpoint for final A1 placement.
          // Late wall/Rotunda preparation can legitimately move the exact A1
          // parent after that value was published. Resolve the FINAL live exact
          // Cab mesh now, in world space, using the visible Rotunda->Tunnel-A
          // bridge axis and the aircraft-facing endpoint band of the actual Cab
          // vertices. The visible CRJ door is then moved to that same live point.
          if (!sim.aircraft.parent || typeof measureVisibleAirframeDoor !== "function") {
            throw new Error("A1 final live-Cab registration is missing the aircraft parent or visible-door measurer");
          }
          const finalA1Anchor = exactA1Fleet?.getObjectByName?.("UploadedAirportJetway_A1");
          const finalA1Model = finalA1Anchor?.getObjectByName?.("UploadedAirportJetwayModel_A1");
          const finalA1Rotunda = finalA1Model?.getObjectByName?.("Rotunda")
            || finalA1Model?.getObjectByName?.("Rotunda_Jetway_0");
          const finalA1TunnelA = finalA1Model?.getObjectByName?.("Tunnel_A")
            || finalA1Model?.getObjectByName?.("Tunnel_A_Jetway_0");
          const finalA1Cab = finalA1Model?.getObjectByName?.("Cab")
            || finalA1Model?.getObjectByName?.("Cab_Jetway_0");
          if (!finalA1Anchor || !finalA1Model || !finalA1Rotunda || !finalA1TunnelA || !finalA1Cab) {
            throw new Error("A1 final live-Cab registration cannot resolve the visible Rotunda/Tunnel-A/Cab chain");
          }
          exactA1Fleet.updateWorldMatrix(true, true);
          finalA1Model.updateWorldMatrix(true, true);
          finalA1Rotunda.updateWorldMatrix(true, true);
          finalA1TunnelA.updateWorldMatrix(true, true);
          finalA1Cab.updateWorldMatrix(true, true);

          const finalRotundaWorld = new THREE.Box3().setFromObject(finalA1Rotunda).getCenter(new THREE.Vector3());
          const finalTunnelAWorld = new THREE.Box3().setFromObject(finalA1TunnelA).getCenter(new THREE.Vector3());
          const finalBridgeDirectionWorld = finalTunnelAWorld.clone().sub(finalRotundaWorld).setY(0);
          if (finalBridgeDirectionWorld.lengthSq() < 0.25) {
            throw new Error("A1 final live bridge axis is degenerate");
          }
          finalBridgeDirectionWorld.normalize();

          const finalCabVerticesWorld = [];
          const finalCabVertex = new THREE.Vector3();
          finalA1Cab.traverse((entry) => {
            if (!entry?.isMesh || entry.visible === false) return;
            const positionAttribute = entry.geometry?.getAttribute?.("position");
            if (!positionAttribute) return;
            entry.updateWorldMatrix(true, false);
            for (let index = 0; index < positionAttribute.count; index += 1) {
              finalCabVertex.fromBufferAttribute(positionAttribute, index).applyMatrix4(entry.matrixWorld);
              finalCabVerticesWorld.push(finalCabVertex.clone());
            }
          });
          if (finalCabVerticesWorld.length < 100) {
            throw new Error(\`A1 final live Cab has too few visible vertices: \${finalCabVerticesWorld.length}\`);
          }
          let finalCabMaximumProjection = Number.NEGATIVE_INFINITY;
          for (const point of finalCabVerticesWorld) {
            finalCabMaximumProjection = Math.max(
              finalCabMaximumProjection,
              point.clone().sub(finalRotundaWorld).dot(finalBridgeDirectionWorld),
            );
          }
          const finalCabEndpointBand = finalCabVerticesWorld.filter((point) => (
            finalCabMaximumProjection - point.clone().sub(finalRotundaWorld).dot(finalBridgeDirectionWorld)
          ) <= 0.16);
          if (finalCabEndpointBand.length < 3) {
            throw new Error("A1 final live Cab aircraft-facing endpoint band is empty");
          }
          const finalVisibleCabWorld = new THREE.Vector3();
          for (const point of finalCabEndpointBand) finalVisibleCabWorld.add(point);
          finalVisibleCabWorld.multiplyScalar(1 / finalCabEndpointBand.length);
          const sourceGateDoorTargetWorldX = finalVisibleCabWorld.x;
          const sourceGateDoorTargetWorldZ = finalVisibleCabWorld.z;
          const cachedCabWorldX = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldX);
          const cachedCabWorldZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldZ);
          const cachedCabStalenessMeters = [cachedCabWorldX, cachedCabWorldZ].every(Number.isFinite)
            ? Math.hypot(sourceGateDoorTargetWorldX - cachedCabWorldX, sourceGateDoorTargetWorldZ - cachedCabWorldZ)
            : Number.NaN;

          // Preserve the actual A1 source stand orientation and grounded Y.
          // Height/lift remains a later physical bridge-lift concern; this pass
          // owns only the physically visible horizontal door/Cab relationship.
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
            throw new Error(\`A1 final live-Cab parent-local relocation is invalid: \${requiredParentLocalDelta.x}, \${requiredParentLocalDelta.z}\`);
          }
          sim.aircraft.position.x += requiredParentLocalDelta.x;
          sim.aircraft.position.z += requiredParentLocalDelta.z;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateWorldMatrix(true, true);

          const renderedDoorAtSourceGate = measureVisibleAirframeDoor().point;
          const sourceGateDoorTargetErrorMeters = Math.hypot(
            renderedDoorAtSourceGate.x - sourceGateDoorTargetWorldX,
            renderedDoorAtSourceGate.z - sourceGateDoorTargetWorldZ,
          );
          const sourceGateCabSeparationMeters = renderedDoorAtSourceGate.distanceTo(
            new THREE.Vector3(finalVisibleCabWorld.x, renderedDoorAtSourceGate.y, finalVisibleCabWorld.z),
          );
          if (!(sourceGateDoorTargetErrorMeters <= ${maximumDoorTargetErrorMeters})) {
            throw new Error(\`A1 visible rendered door missed the FINAL live Cab target by \${sourceGateDoorTargetErrorMeters} m\`);
          }
          if (!(sourceGateCabSeparationMeters <= ${maximumCabContactErrorMeters})) {
            throw new Error(\`A1 visible rendered door missed the FINAL visible Cab by \${sourceGateCabSeparationMeters} m\`);
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
          renderer.domElement.dataset.inspectionAircraftDoorStationAuthority = "final-live-cab-mesh-visible-door-v3";
          renderer.domElement.dataset.inspectionAircraftDoorAftOfNoseGearMeters = "7.320";
          renderer.domElement.dataset.inspectionAircraftDoorLeftOfCenterlineMeters = "1.340";
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetX = sourceGateDoorTargetWorldX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetZ = sourceGateDoorTargetWorldZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftSourceGateDoorTargetErrorMeters = sourceGateDoorTargetErrorMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = sourceGateCabSeparationMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactAuthority = "final-visible-cab-mesh-door-contact-v7";
          renderer.domElement.dataset.inspectionAircraftFinalVisibleCabWorldX = finalVisibleCabWorld.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftFinalVisibleCabWorldY = finalVisibleCabWorld.y.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftFinalVisibleCabWorldZ = finalVisibleCabWorld.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftFinalVisibleCabVertexCount = String(finalCabVerticesWorld.length);
          renderer.domElement.dataset.inspectionAircraftFinalVisibleCabEndpointVertexCount = String(finalCabEndpointBand.length);
          renderer.domElement.dataset.inspectionAircraftCachedCabStalenessMeters = Number.isFinite(cachedCabStalenessMeters)
            ? cachedCabStalenessMeters.toFixed(6)
            : "missing";
          renderer.domElement.dataset.inspectionAircraftDoorWorldDeltaX = requiredWorldDoorDelta.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorWorldDeltaZ = requiredWorldDoorDelta.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorParentLocalDeltaX = requiredParentLocalDelta.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorParentLocalDeltaZ = requiredParentLocalDelta.z.toFixed(6);`;

if (!source.includes(marker)) {
  const priorPatterns = [
    /          \/\/ visible-a1-door-owns-final-cab-registration-v6[\s\S]*?          renderer\.domElement\.dataset\.inspectionAircraftCabContactAuthority = "visible-mesh-door-meets-fixed-jetway-cab-v6";/,
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
  "visible-a1-door-world-axis-parent-local-cab-registration-v6",
]) {
  source = source.replaceAll(staleAuthority, authority);
}

for (const token of [
  marker,
  `A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${authority}"`,
  'getObjectByName?.("UploadedAirportJetwayModel_A1")',
  'getObjectByName?.("Cab")',
  "const finalCabVerticesWorld = []",
  "const finalCabEndpointBand = finalCabVerticesWorld.filter",
  "const finalVisibleCabWorld = new THREE.Vector3()",
  "const renderedDoorBeforeSourceGate = measureVisibleAirframeDoor().point",
  "sim.aircraft.parent.worldToLocal(renderedDoorBeforeSourceGate.clone())",
  "const renderedDoorAtSourceGate = measureVisibleAirframeDoor().point",
  `sourceGateDoorTargetErrorMeters <= ${maximumDoorTargetErrorMeters}`,
  `sourceGateCabSeparationMeters <= ${maximumCabContactErrorMeters}`,
  'inspectionAircraftDoorStationAuthority = "final-live-cab-mesh-visible-door-v3"',
  'inspectionAircraftCabContactAuthority = "final-visible-cab-mesh-door-contact-v7"',
  "inspectionAircraftFinalVisibleCabWorldX",
  "inspectionAircraftCachedCabStalenessMeters",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: final live-Cab A1 aircraft pose is missing ${token}`);
}
for (const obsolete of [
  "fixed-source-a1-gate-aircraft-pose-v1",
  "fixed-source-a1-gate-aircraft-pose-v2",
  "fixed-source-a1-gate-aircraft-pose-v3",
  "source-a1-jetway-owned-aircraft-pose-v4",
  "rendered-a1-door-owns-visible-cab-registration-v5",
  "visible-a1-door-owns-final-cab-registration-v6",
  "const sourceGateDoorTargetWorldX = Number(exactA1Fleet?.userData?.uploadedJetwayA1SourceDoorTargetWorldX)",
]) {
  if (source.includes(obsolete)) throw new Error(`${trainerPath}: stale cached/synthetic A1 Cab registration remains: ${obsolete}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-a1-rendered-door-finalizer-v4.mjs?rendered-door=${Date.now()}`);
console.log("Registered the visible A1 aircraft door directly to the final live exact Cab mesh endpoint after all current A1 transforms, and published cached-Cab staleness evidence so a moved jetway can never validate against an invisible old point again.");
