import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "grounded-a1-training-pose-before-inspection-registration-v1";
const declarationToken = "const trainingAircraftPoseBeforeInspectionRegistration =";
const fullDeclaration = `          const trainingAircraftPoseBeforeInspectionRegistration = {
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          };`;
const moveBlock = `          sim.aircraft.position.x += aircraftRelocationX;
          sim.aircraft.position.y += aircraftRelocationY;
          sim.aircraft.position.z += aircraftRelocationZ;
          sim.aircraft.updateMatrixWorld(true);`;

if (!source.includes(marker)) {
  if (source.includes(fullDeclaration)) {
    source = source.replace(fullDeclaration, `          // ${marker}\n${fullDeclaration}`);
  } else if (source.includes(moveBlock)) {
    source = source.replace(
      moveBlock,
      `          // ${marker}
${fullDeclaration}
${moveBlock}`,
    );
  } else {
    throw new Error(`${trainerPath}: full grounded X/Y/Z pose declaration and aircraft registration move are both missing`);
  }
}

const declarationCount = (source.match(/const trainingAircraftPoseBeforeInspectionRegistration =/g) || []).length;
if (declarationCount !== 1) {
  throw new Error(`${trainerPath}: expected one grounded pre-inspection pose declaration, received ${declarationCount}`);
}

for (const token of [
  marker,
  declarationToken,
  "y: sim.aircraft.position.y",
  "sim.aircraft.position.y += aircraftRelocationY",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: grounded lifecycle pose anchor is missing ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Reused the single full X/Y/Z/yaw pre-inspection pose declaration, marked it as the grounded lifecycle anchor, and rejected duplicate declarations before lifecycle wiring.");
