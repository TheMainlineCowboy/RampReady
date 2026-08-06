import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "measured-cab-normal-aircraft-heading-v1";
const anchor = `          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone());`;
const replacement = `          // The prior registration translated the authored door onto the Cab but
          // preserved the training-start heading. That can produce a mathematically
          // zero door error while the aircraft is visibly parked across the terminal
          // walkway and disconnected from the bridge. Rotate the complete aircraft
          // root first so its authored left side faces back toward the Cab, then
          // measure and translate the real rendered door.
          const cabRegisteredAircraftYaw = Math.atan2(
            -exactA1CabDirectionZ,
            exactA1CabDirectionX,
          );
          sim.aircraft.rotation.y = cabRegisteredAircraftYaw;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone());
          renderer.domElement.dataset.inspectionAircraftHeadingAuthority = "${authority}";
          renderer.domElement.dataset.inspectionAircraftYaw = cabRegisteredAircraftYaw.toFixed(6);`;

if (source.includes(anchor)) {
  source = source.replace(anchor, replacement);
} else if (!source.includes(`inspectionAircraftHeadingAuthority = "${authority}"`)) {
  throw new Error(`${trainerPath}: authored-door registration anchor is missing`);
}

for (const token of [
  "const cabRegisteredAircraftYaw = Math.atan2(",
  "-exactA1CabDirectionZ",
  "exactA1CabDirectionX",
  "sim.aircraft.rotation.y = cabRegisteredAircraftYaw",
  `inspectionAircraftHeadingAuthority = "${authority}"`,
  "inspectionAircraftYaw = cabRegisteredAircraftYaw.toFixed(6)",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: measured Cab-normal aircraft heading token is missing: ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Aligned the complete inspection aircraft root to the measured A1 Cab normal before rendered-door registration.");
