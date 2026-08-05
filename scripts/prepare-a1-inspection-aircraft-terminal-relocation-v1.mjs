import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "total-rigid-parent-relocated-a1-aircraft-pose-v2";
const markerLiteral = JSON.stringify(marker);
const poseAuthority = "total-rigid-parent-relocated-a1-exact-cab-registration-v2";

source = source.replace(
  /const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "[^"]+";/,
  `const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${poseAuthority}";`,
);

const staleBlockPattern = /        \/\/ Keep the inspection aircraft registered to the supplied Cab after the[\s\S]*?        return terminal;/;
const replacementBlock = `        // Keep the inspection aircraft registered to the supplied Cab after the
        // complete exact A1 parent is rotated about the Cab and translated by the
        // authored Rotunda to the real wall. The aircraft must receive the same
        // complete parent displacement, including cab-pivot compensation.
        const exactA1Fleet = environment.userData.authoredTerminal4Jetways;
        const exactA1TotalRelocationX = Number(exactA1Fleet?.userData?.uploadedJetwayA1TotalRelocationX) || 0;
        const exactA1TotalRelocationZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1TotalRelocationZ) || 0;
        const exactA1TerminalRelocationX = Number(exactA1Fleet?.userData?.uploadedJetwayA1TerminalRelocationX) || 0;
        const exactA1TerminalRelocationZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1TerminalRelocationZ) || 0;
        if (inspectionRef.current && !sim.aircraft.userData[${markerLiteral}]) {
          sim.aircraft.position.x += exactA1TotalRelocationX;
          sim.aircraft.position.z += exactA1TotalRelocationZ;
          sim.aircraft.userData[${markerLiteral}] = true;
          renderer.domElement.dataset.inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftExactParentRelocationX = exactA1TotalRelocationX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftExactParentRelocationZ = exactA1TotalRelocationZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftTerminalRelocationX = exactA1TerminalRelocationX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftTerminalRelocationZ = exactA1TerminalRelocationZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftPoseAuthority = A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY;
        }
        return terminal;`;

if (staleBlockPattern.test(source)) {
  source = source.replace(staleBlockPattern, replacementBlock);
} else if (!source.includes(marker)) {
  const anchor = "        return terminal;";
  if (!source.includes(anchor)) throw new Error(`${trainerPath}: terminal-load completion anchor is missing`);
  source = source.replace(anchor, replacementBlock);
}

source = source
  .replaceAll(
    "inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(3)",
    "inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(6)",
  )
  .replaceAll(
    "inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(3)",
    "inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(6)",
  );

for (const token of [
  marker,
  `A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${poseAuthority}"`,
  `userData[${markerLiteral}]`,
  "uploadedJetwayA1TotalRelocationX",
  "uploadedJetwayA1TotalRelocationZ",
  "inspectionAircraftExactParentRelocationX = exactA1TotalRelocationX.toFixed(6)",
  "inspectionAircraftExactParentRelocationZ = exactA1TotalRelocationZ.toFixed(6)",
  "inspectionAircraftTerminalRelocationX = exactA1TerminalRelocationX.toFixed(6)",
  "inspectionAircraftTerminalRelocationZ = exactA1TerminalRelocationZ.toFixed(6)",
  "inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(6)",
  "inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(6)",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: complete A1 parent-relocated aircraft output is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared millimetre-precision inspection-aircraft registration using the complete exact A1 rigid-parent displacement.");
