import fs from "node:fs";

const path = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const authority = "a1-visible-airframe-world-axis-parent-local-translation-v1";
let source = fs.readFileSync(path, "utf8");

// The visible-door derivation samples rendered mesh bounds in WORLD space. Its
// forward/left axes therefore also have to be WORLD-space axes. Using only the
// aircraft root's local quaternion silently ignored any parent transform and
// produced a numerically plausible 'door' that did not sit on the visible CRJ.
const oldAxisBlock = `            const forwardAxis = new THREE.Vector3(0, 0, -1)
              .applyQuaternion(sim.aircraft.quaternion)
              .setY(0)
              .normalize();
            const leftAxis = new THREE.Vector3(-1, 0, 0)
              .applyQuaternion(sim.aircraft.quaternion)
              .setY(0)
              .normalize();`;
const worldAxisBlock = `            const aircraftWorldQuaternion = sim.aircraft.getWorldQuaternion(new THREE.Quaternion());
            const forwardAxis = new THREE.Vector3(0, 0, -1)
              .applyQuaternion(aircraftWorldQuaternion)
              .setY(0)
              .normalize();
            const leftAxis = new THREE.Vector3(-1, 0, 0)
              .applyQuaternion(aircraftWorldQuaternion)
              .setY(0)
              .normalize();`;
if (source.includes(oldAxisBlock)) {
  source = source.replace(oldAxisBlock, worldAxisBlock);
} else if (!source.includes("const aircraftWorldQuaternion = sim.aircraft.getWorldQuaternion(new THREE.Quaternion())")) {
  throw new Error(`${path}: visible-airframe world-axis anchor is missing`);
}

// The old visible-door relocation also added a WORLD X/Z delta directly to the
// aircraft's LOCAL position. Convert the two endpoints through the aircraft
// parent so this stays correct regardless of airport/environment transform.
const oldRelocationBlock = `          const visibleDoorBefore = measureVisibleAirframeDoor();
          const aircraftRelocationX = exactA1CabContactX - visibleDoorBefore.point.x;
          const aircraftRelocationY = -landingGearContactBefore.minimumY;
          const aircraftRelocationZ = exactA1CabContactZ - visibleDoorBefore.point.z;
          // grounded-a1-training-pose-before-inspection-registration-v1
          const trainingAircraftPoseBeforeInspectionRegistration = {
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          };
          sim.aircraft.position.x += aircraftRelocationX;
          sim.aircraft.position.y += aircraftRelocationY;
          sim.aircraft.position.z += aircraftRelocationZ;`;
const parentLocalRelocationBlock = `          const visibleDoorBefore = measureVisibleAirframeDoor();
          if (!sim.aircraft.parent) {
            throw new Error("A1 visible-airframe registration requires an aircraft parent transform");
          }
          const aircraftRelocationWorld = new THREE.Vector3(
            exactA1CabContactX - visibleDoorBefore.point.x,
            0,
            exactA1CabContactZ - visibleDoorBefore.point.z,
          );
          const visibleDoorParentLocalStart = sim.aircraft.parent.worldToLocal(visibleDoorBefore.point.clone());
          const visibleDoorParentLocalEnd = sim.aircraft.parent.worldToLocal(
            visibleDoorBefore.point.clone().add(aircraftRelocationWorld),
          );
          const visibleDoorParentLocalDelta = visibleDoorParentLocalEnd.sub(visibleDoorParentLocalStart);
          const aircraftRelocationX = visibleDoorParentLocalDelta.x;
          const aircraftRelocationY = -landingGearContactBefore.minimumY;
          const aircraftRelocationZ = visibleDoorParentLocalDelta.z;
          if (![aircraftRelocationX, aircraftRelocationY, aircraftRelocationZ].every(Number.isFinite)
            || Math.hypot(aircraftRelocationX, aircraftRelocationZ) > 60) {
            throw new Error(\`A1 visible-airframe parent-local relocation is invalid: \${aircraftRelocationX}, \${aircraftRelocationY}, \${aircraftRelocationZ}\`);
          }
          // grounded-a1-training-pose-before-inspection-registration-v1
          const trainingAircraftPoseBeforeInspectionRegistration = {
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          };
          sim.aircraft.position.x += aircraftRelocationX;
          sim.aircraft.position.y += aircraftRelocationY;
          sim.aircraft.position.z += aircraftRelocationZ;`;
if (source.includes(oldRelocationBlock)) {
  source = source.replace(oldRelocationBlock, parentLocalRelocationBlock);
} else if (!source.includes("const visibleDoorParentLocalDelta = visibleDoorParentLocalEnd.sub(visibleDoorParentLocalStart)")) {
  throw new Error(`${path}: visible-airframe parent-local relocation anchor is missing`);
}

// The model-axis half-plane scorer performs a temporary door-to-Cab move before
// the visible-mesh registration. Make that temporary move parent-correct too so
// the 0/180-degree selection cannot be biased by the same coordinate-space bug.
const oldCandidateMove = `            const candidateDoor = renderedAircraft.localToWorld(authoredDoorLocal.clone());
            sim.aircraft.position.x += exactA1CabContactX - candidateDoor.x;
            sim.aircraft.position.z += exactA1CabContactZ - candidateDoor.z;`;
const parentCandidateMove = `            const candidateDoor = renderedAircraft.localToWorld(authoredDoorLocal.clone());
            if (!sim.aircraft.parent) throw new Error("A1 heading scorer lost the aircraft parent transform");
            const candidateWorldDelta = new THREE.Vector3(
              exactA1CabContactX - candidateDoor.x,
              0,
              exactA1CabContactZ - candidateDoor.z,
            );
            const candidateParentStart = sim.aircraft.parent.worldToLocal(candidateDoor.clone());
            const candidateParentEnd = sim.aircraft.parent.worldToLocal(candidateDoor.clone().add(candidateWorldDelta));
            const candidateParentDelta = candidateParentEnd.sub(candidateParentStart);
            sim.aircraft.position.x += candidateParentDelta.x;
            sim.aircraft.position.z += candidateParentDelta.z;`;
if (source.includes(oldCandidateMove)) {
  source = source.replace(oldCandidateMove, parentCandidateMove);
} else if (!source.includes("const candidateParentDelta = candidateParentEnd.sub(candidateParentStart)")) {
  throw new Error(`${path}: A1 model-axis scorer parent-local migration anchor is missing`);
}

const telemetryAnchor = `          renderer.domElement.dataset.inspectionAircraftVisibleDoorSampleCount = String(visibleDoorAfter.sampleCount);`;
const telemetryPatch = `${telemetryAnchor}
          renderer.domElement.dataset.inspectionAircraftVisibleDoorWorldRegistrationAuthority = "${authority}";
          renderer.domElement.dataset.inspectionAircraftVisibleDoorRelocationWorldX = aircraftRelocationWorld.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftVisibleDoorRelocationWorldZ = aircraftRelocationWorld.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftVisibleDoorRelocationParentLocalX = aircraftRelocationX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftVisibleDoorRelocationParentLocalZ = aircraftRelocationZ.toFixed(6);`;
if (!source.includes("inspectionAircraftVisibleDoorWorldRegistrationAuthority")) {
  if (!source.includes(telemetryAnchor)) throw new Error(`${path}: visible-airframe telemetry anchor is missing`);
  source = source.replace(telemetryAnchor, telemetryPatch);
}

for (const required of [
  "const aircraftWorldQuaternion = sim.aircraft.getWorldQuaternion(new THREE.Quaternion())",
  "const aircraftRelocationWorld = new THREE.Vector3(",
  "const visibleDoorParentLocalDelta = visibleDoorParentLocalEnd.sub(visibleDoorParentLocalStart)",
  "const candidateParentDelta = candidateParentEnd.sub(candidateParentStart)",
  `inspectionAircraftVisibleDoorWorldRegistrationAuthority = "${authority}"`,
]) {
  if (!source.includes(required)) throw new Error(`${path}: A1 visible-airframe world registration is missing ${required}`);
}
for (const forbidden of [oldAxisBlock, oldRelocationBlock, oldCandidateMove]) {
  if (source.includes(forbidden)) throw new Error(`${path}: A1 mixed world/local visible-airframe behavior survived`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Fixed A1 visible-airframe registration: rendered mesh samples and aircraft axes now share world space, while every Cab-alignment displacement is converted through the aircraft parent before changing local position.");
