import fs from "node:fs";

await import(`./prepare-a1-attached-state-aircraft-calibration-v1.mjs?attached-calibration=${Date.now()}`);

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const authority = "live-final-visible-a1-door-cab-monitor-v1";
let source = fs.readFileSync(trainerPath, "utf8");

const anchor = `          renderer.domElement.dataset.inspectionAircraftDoorParentLocalDeltaZ = requiredParentLocalDelta.z.toFixed(6);`;
const monitor = `${anchor}

          // Browser-time visual truth. Several older readiness layers still
          // overwrite compatibility telemetry after the aircraft is positioned.
          // Never use those cached values to decide whether A1 is visually
          // connected. Re-measure the FINAL visible Cab mesh and visible aircraft
          // door repeatedly, after every late transform and animation update.
          const publishLiveA1VisibleContact = () => {
            try {
              exactA1Fleet.updateWorldMatrix(true, true);
              finalA1Rotunda.updateWorldMatrix(true, true);
              finalA1TunnelA.updateWorldMatrix(true, true);
              finalA1Cab.updateWorldMatrix(true, true);
              renderedAircraft.updateWorldMatrix(true, true);

              const liveRotundaWorld = new THREE.Box3().setFromObject(finalA1Rotunda).getCenter(new THREE.Vector3());
              const liveTunnelAWorld = new THREE.Box3().setFromObject(finalA1TunnelA).getCenter(new THREE.Vector3());
              const liveBridgeDirectionWorld = liveTunnelAWorld.clone().sub(liveRotundaWorld).setY(0);
              if (liveBridgeDirectionWorld.lengthSq() < 0.25) throw new Error("live A1 bridge axis is degenerate");
              liveBridgeDirectionWorld.normalize();

              const livePoint = new THREE.Vector3();
              let liveMaximumProjection = Number.NEGATIVE_INFINITY;
              let liveCabVertexCount = 0;
              finalA1Cab.traverse((entry) => {
                if (!entry?.isMesh || entry.visible === false) return;
                const positionAttribute = entry.geometry?.getAttribute?.("position");
                if (!positionAttribute) return;
                entry.updateWorldMatrix(true, false);
                for (let index = 0; index < positionAttribute.count; index += 1) {
                  livePoint.fromBufferAttribute(positionAttribute, index).applyMatrix4(entry.matrixWorld);
                  liveMaximumProjection = Math.max(
                    liveMaximumProjection,
                    livePoint.clone().sub(liveRotundaWorld).dot(liveBridgeDirectionWorld),
                  );
                  liveCabVertexCount += 1;
                }
              });
              if (liveCabVertexCount < 100 || !Number.isFinite(liveMaximumProjection)) {
                throw new Error(\`live A1 Cab sample is invalid: \${liveCabVertexCount}\`);
              }

              const liveCabEndpointWorld = new THREE.Vector3();
              let liveEndpointCount = 0;
              finalA1Cab.traverse((entry) => {
                if (!entry?.isMesh || entry.visible === false) return;
                const positionAttribute = entry.geometry?.getAttribute?.("position");
                if (!positionAttribute) return;
                entry.updateWorldMatrix(true, false);
                for (let index = 0; index < positionAttribute.count; index += 1) {
                  livePoint.fromBufferAttribute(positionAttribute, index).applyMatrix4(entry.matrixWorld);
                  const projection = livePoint.clone().sub(liveRotundaWorld).dot(liveBridgeDirectionWorld);
                  if (liveMaximumProjection - projection <= 0.16) {
                    liveCabEndpointWorld.add(livePoint);
                    liveEndpointCount += 1;
                  }
                }
              });
              if (liveEndpointCount < 3) throw new Error("live A1 Cab endpoint band is empty");
              liveCabEndpointWorld.multiplyScalar(1 / liveEndpointCount);

              const liveVisibleDoorWorld = measureVisibleAirframeDoor().point;
              const liveHorizontalErrorMeters = Math.hypot(
                liveVisibleDoorWorld.x - liveCabEndpointWorld.x,
                liveVisibleDoorWorld.z - liveCabEndpointWorld.z,
              );
              renderer.domElement.dataset.inspectionAircraftLiveVisibleContactAuthority = "${authority}";
              renderer.domElement.dataset.inspectionAircraftLiveVisibleCabWorldX = liveCabEndpointWorld.x.toFixed(6);
              renderer.domElement.dataset.inspectionAircraftLiveVisibleCabWorldY = liveCabEndpointWorld.y.toFixed(6);
              renderer.domElement.dataset.inspectionAircraftLiveVisibleCabWorldZ = liveCabEndpointWorld.z.toFixed(6);
              renderer.domElement.dataset.inspectionAircraftLiveVisibleDoorWorldX = liveVisibleDoorWorld.x.toFixed(6);
              renderer.domElement.dataset.inspectionAircraftLiveVisibleDoorWorldY = liveVisibleDoorWorld.y.toFixed(6);
              renderer.domElement.dataset.inspectionAircraftLiveVisibleDoorWorldZ = liveVisibleDoorWorld.z.toFixed(6);
              renderer.domElement.dataset.inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters = liveHorizontalErrorMeters.toFixed(6);
              renderer.domElement.dataset.inspectionAircraftLiveVisibleCabVertexCount = String(liveCabVertexCount);
              renderer.domElement.dataset.inspectionAircraftLiveVisibleCabEndpointVertexCount = String(liveEndpointCount);
              renderer.domElement.dataset.inspectionAircraftLiveVisibleContactError = "";
            } catch (error) {
              renderer.domElement.dataset.inspectionAircraftLiveVisibleContactAuthority = "error";
              renderer.domElement.dataset.inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters = "error";
              renderer.domElement.dataset.inspectionAircraftLiveVisibleContactError = error?.message || String(error);
            }
          };
          if (sim.aircraft.userData.a1LiveVisibleContactIntervalId) {
            clearInterval(sim.aircraft.userData.a1LiveVisibleContactIntervalId);
          }
          publishLiveA1VisibleContact();
          sim.aircraft.userData.a1LiveVisibleContactIntervalId = setInterval(publishLiveA1VisibleContact, 250);`;

if (!source.includes(`inspectionAircraftLiveVisibleContactAuthority = "${authority}"`)) {
  if (!source.includes(anchor)) throw new Error(`${trainerPath}: live A1 visible-contact monitor anchor is missing`);
  source = source.replace(anchor, monitor);
}

for (const token of [
  "a1-attached-state-owns-fixed-aircraft-calibration-v1",
  `inspectionAircraftLiveVisibleContactAuthority = "${authority}"`,
  "const publishLiveA1VisibleContact = () =>",
  "const liveVisibleDoorWorld = measureVisibleAirframeDoor().point",
  "inspectionAircraftLiveVisibleDoorCabHorizontalErrorMeters",
  "setInterval(publishLiveA1VisibleContact, 250)",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: live A1 visible-contact monitor is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Installed live browser-time A1 visual truth after attached-state aircraft calibration: the actual final Cab mesh endpoint and visible CRJ door are re-measured every 250 ms, so stale or parked-state telemetry cannot make a disconnected screenshot pass.");
