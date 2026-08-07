import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const declarationToken = "const trainingAircraftPoseBeforeInspectionRegistration =";
if (!source.includes(declarationToken)) {
  const relocationAnchor = "          sim.aircraft.position.x += aircraftRelocationX;";
  if (!source.includes(relocationAnchor)) {
    throw new Error(`${trainerPath}: A1 aircraft relocation anchor is missing before lifecycle preparation`);
  }

  const declaration = `          const trainingAircraftPoseBeforeInspectionRegistration = {
            x: sim.aircraft.position.x,
            y: sim.aircraft.position.y,
            z: sim.aircraft.position.z,
            yaw: sim.aircraft.rotation.y,
          };
`;
  source = source.replace(relocationAnchor, `${declaration}${relocationAnchor}`);
}

if (!source.includes(declarationToken)) {
  throw new Error(`${trainerPath}: failed to prepare the pre-registration training aircraft pose declaration`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared the A1 pre-registration training aircraft pose declaration idempotently before lifecycle wiring.");
