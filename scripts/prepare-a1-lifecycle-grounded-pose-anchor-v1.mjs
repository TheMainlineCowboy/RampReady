import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "grounded-a1-training-pose-before-inspection-registration-v1";
const moveBlock = `          sim.aircraft.position.x += aircraftRelocationX;
          sim.aircraft.position.y += aircraftRelocationY;
          sim.aircraft.position.z += aircraftRelocationZ;
          sim.aircraft.updateMatrixWorld(true);`;
const anchoredMoveBlock = `          // ${marker}
          const trainingAircraftPoseBeforeInspectionRegistration = {
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          };
          sim.aircraft.position.x += aircraftRelocationX;
          sim.aircraft.position.y += aircraftRelocationY;
          sim.aircraft.position.z += aircraftRelocationZ;
          sim.aircraft.updateMatrixWorld(true);`;

if (!source.includes(marker)) {
  if (!source.includes(moveBlock)) {
    throw new Error(`${trainerPath}: grounded X/Y/Z aircraft registration move is missing`);
  }
  source = source.replace(moveBlock, anchoredMoveBlock);
}

for (const token of [
  marker,
  "const trainingAircraftPoseBeforeInspectionRegistration =",
  "sim.aircraft.position.y += aircraftRelocationY",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: grounded lifecycle pose anchor is missing ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Captured the full grounded X/Y/Z aircraft pose before inspection registration so lifecycle persistence cannot drop the landing-gear height or reference an undefined pre-inspection pose.");
