import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "measured-final-cab-contact-a1-aircraft-pose-v3";
const markerLiteral = JSON.stringify(marker);
const poseAuthority = "measured-final-cab-contact-a1-registration-v3";
const doorAftOfNoseGearMeters = 7.32;
const doorLeftOfCenterlineMeters = 1.34;

source = source.replace(
  /const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "[^"]+";/,
  `const A1_INSPECTION_AIRCRAFT_POSE_AUTHORITY = "${poseAuthority}";`,
);

const staleBlockPattern = /        \/\/ Keep the inspection aircraft registered to the supplied Cab after the[\s\S]*?        return terminal;/;
const replacementBlock = `        // Register the aircraft to the actual final aircraft-facing end of the
        // supplied Cab mesh. Parent rotation is compensated around the Cab, so
        // its anchor displacement is not a physical Cab displacement and must
        // never be copied to the aircraft.
        const exactA1Fleet = environment.userData.authoredTerminal4Jetways;
        const exactA1CabContactX = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldX);
        const exactA1CabContactZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldZ);
        const exactA1CabDirectionX = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabDirectionWorldX);
        const exactA1CabDirectionZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabDirectionWorldZ);
        const exactA1WallRelocationX = Number(exactA1Fleet?.userData?.uploadedJetwayA1TerminalRelocationX) || 0;
        const exactA1WallRelocationZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1TerminalRelocationZ) || 0;
        if (![exactA1CabContactX, exactA1CabContactZ, exactA1CabDirectionX, exactA1CabDirectionZ].every(Number.isFinite)) {
          throw new Error("A1 inspection aircraft is missing the measured final Cab contact");
        }
        const exactA1CabDirectionLength = Math.hypot(exactA1CabDirectionX, exactA1CabDirectionZ);
        if (Math.abs(exactA1CabDirectionLength - 1) > 0.01) {
          throw new Error(\`A1 measured final Cab direction is not normalized: \${exactA1CabDirectionLength}\`);
        }
        if (inspectionRef.current && !sim.aircraft.userData[${markerLiteral}]) {
          const initialNoseGearX = sim.aircraft.position.x;
          const initialNoseGearZ = sim.aircraft.position.z;
          const aircraftYaw = sim.aircraft.rotation.y;
          const forwardX = Math.sin(aircraftYaw);
          const forwardZ = -Math.cos(aircraftYaw);
          const leftX = forwardZ;
          const leftZ = -forwardX;
          const finalNoseGearX = exactA1CabContactX
            + forwardX * ${doorAftOfNoseGearMeters}
            - leftX * ${doorLeftOfCenterlineMeters};
          const finalNoseGearZ = exactA1CabContactZ
            + forwardZ * ${doorAftOfNoseGearMeters}
            - leftZ * ${doorLeftOfCenterlineMeters};
          sim.aircraft.position.x = finalNoseGearX;
          sim.aircraft.position.z = finalNoseGearZ;
          const actualDoorX = sim.aircraft.position.x
            - forwardX * ${doorAftOfNoseGearMeters}
            + leftX * ${doorLeftOfCenterlineMeters};
          const actualDoorZ = sim.aircraft.position.z
            - forwardZ * ${doorAftOfNoseGearMeters}
            + leftZ * ${doorLeftOfCenterlineMeters};
          const cabContactErrorMeters = Math.hypot(
            actualDoorX - exactA1CabContactX,
            actualDoorZ - exactA1CabContactZ,
          );
          if (cabContactErrorMeters > 0.01) {
            throw new Error(\`A1 inspection aircraft missed the measured final Cab by \${cabContactErrorMeters} m\`);
          }
          const aircraftRelocationX = finalNoseGearX - initialNoseGearX;
          const aircraftRelocationZ = finalNoseGearZ - initialNoseGearZ;
          sim.aircraft.userData[${markerLiteral}] = true;
          renderer.domElement.dataset.inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftExactParentRelocationX = aircraftRelocationX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftExactParentRelocationZ = aircraftRelocationZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftTerminalRelocationX = aircraftRelocationX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftTerminalRelocationZ = aircraftRelocationZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftWallRelocationX = exactA1WallRelocationX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftWallRelocationZ = exactA1WallRelocationZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactX = exactA1CabContactX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactZ = exactA1CabContactZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabDirectionX = exactA1CabDirectionX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabDirectionZ = exactA1CabDirectionZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetX = actualDoorX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = actualDoorZ.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = cabContactErrorMeters.toFixed(6);
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
  "uploadedJetwayA1CabContactWorldX",
  "uploadedJetwayA1CabContactWorldZ",
  "uploadedJetwayA1CabDirectionWorldX",
  "uploadedJetwayA1CabDirectionWorldZ",
  `forwardX * ${doorAftOfNoseGearMeters}`,
  `leftX * ${doorLeftOfCenterlineMeters}`,
  "inspectionAircraftCabContactX = exactA1CabContactX.toFixed(6)",
  "inspectionAircraftCabContactZ = exactA1CabContactZ.toFixed(6)",
  "inspectionAircraftCabContactErrorMeters = cabContactErrorMeters.toFixed(6)",
  "inspectionAircraftExactParentRelocationX = aircraftRelocationX.toFixed(6)",
  "inspectionAircraftExactParentRelocationZ = aircraftRelocationZ.toFixed(6)",
  "inspectionAircraftNoseGearX = sim.aircraft.position.x.toFixed(6)",
  "inspectionAircraftNoseGearZ = sim.aircraft.position.z.toFixed(6)",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: measured final-Cab aircraft output is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared millimetre-precision inspection-aircraft registration to the measured final aircraft-facing Cab endpoint.");
