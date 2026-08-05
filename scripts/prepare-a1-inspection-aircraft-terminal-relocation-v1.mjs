import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "terminal-relocated-a1-aircraft-pose-v1";
const markerLiteral = JSON.stringify(marker);
const poseAuthority = "terminal-relocated-a1-exact-cab-registration-v1";

source = source.replace(
  /const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "[^"]+";/,
  `const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${poseAuthority}";`,
);

if (!source.includes(marker)) {
  const anchor = "        return terminal;";
  if (!source.includes(anchor)) throw new Error(`${trainerPath}: terminal-load completion anchor is missing`);
  source = source.replace(
    anchor,
    `        // Keep the inspection aircraft registered to the supplied Cab after the
        // complete exact A1 jetway is moved by its Rotunda to the real terminal wall.
        // This applies only the measured terminal relocation; the preceding cab-pivot
        // correction already preserves the aircraft-side endpoint.
        const exactA1Fleet = environment.userData.authoredTerminal4Jetways;
        const exactA1RelocationX = Number(exactA1Fleet?.userData?.uploadedJetwayA1TerminalRelocationX) || 0;
        const exactA1RelocationZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1TerminalRelocationZ) || 0;
        if (inspectionRef.current && !sim.aircraft.userData[${markerLiteral}]) {
          sim.aircraft.position.x += exactA1RelocationX;
          sim.aircraft.position.z += exactA1RelocationZ;
          sim.aircraft.userData[${markerLiteral}] = true;
          renderer.domElement.dataset.inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(3);
          renderer.domElement.dataset.inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(3);
          renderer.domElement.dataset.inspectionAircraftTerminalRelocationX = exactA1RelocationX.toFixed(3);
          renderer.domElement.dataset.inspectionAircraftTerminalRelocationZ = exactA1RelocationZ.toFixed(3);
          renderer.domElement.dataset.inspectionAircraftPoseAuthority = A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY;
        }
        return terminal;`,
  );
}

for (const token of [
  marker,
  `A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${poseAuthority}"`,
  `userData[${markerLiteral}]`,
  "uploadedJetwayA1TerminalRelocationX",
  "uploadedJetwayA1TerminalRelocationZ",
  "inspectionAircraftTerminalRelocationX",
  "inspectionAircraftTerminalRelocationZ",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: A1 terminal-relocated aircraft output is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared persistent inspection-aircraft registration to the exact A1 Cab after measured Rotunda-to-terminal relocation.");
