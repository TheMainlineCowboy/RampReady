import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "a1-aircraft-apron-half-plane-model-axis-v1";
if (source.includes(marker)) {
  console.log("A1 aircraft terminal half-plane model-axis selection is already prepared.");
  process.exit(0);
}

const anchor = "          const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone());";
if (!source.includes(anchor)) {
  throw new Error(`${trainerPath}: rendered-door heading anchor is missing`);
}

const replacement = `          // ${marker}
          // The source A1 stand heading is authoritative, but exporter model-forward
          // can be 180 degrees ambiguous. Test both equivalent model-axis readings
          // after translating the authored forward-left door to the measured Cab.
          // Accept only the reading whose complete rendered aircraft remains on the
          // apron side of the measured terminal wall. This prevents a numerically
          // correct door registration from putting the fuselage through the terminal.
          const measuredWallX = Number(exactA1Fleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldX);
          const measuredWallZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldZ);
          if (![measuredWallX, measuredWallZ].every(Number.isFinite)) {
            throw new Error("A1 aircraft half-plane selection is missing the exact measured terminal wall");
          }
          const wallToCabX = exactA1CabContactX - measuredWallX;
          const wallToCabZ = exactA1CabContactZ - measuredWallZ;
          const wallToCabLength = Math.hypot(wallToCabX, wallToCabZ);
          if (!(wallToCabLength > 1)) {
            throw new Error(\`A1 wall-to-Cab direction is invalid: \${wallToCabLength} m\`);
          }
          const apronNormalX = wallToCabX / wallToCabLength;
          const apronNormalZ = wallToCabZ / wallToCabLength;
          const initialAircraftXForHeading = sim.aircraft.position.x;
          const initialAircraftZForHeading = sim.aircraft.position.z;
          const scoreA1AircraftHeading = (candidateYaw) => {
            sim.aircraft.position.x = initialAircraftXForHeading;
            sim.aircraft.position.z = initialAircraftZForHeading;
            sim.aircraft.rotation.y = candidateYaw;
            sim.aircraft.updateMatrixWorld(true);
            renderedAircraft.updateMatrixWorld(true);
            const candidateDoor = renderedAircraft.localToWorld(authoredDoorLocal.clone());
            sim.aircraft.position.x += exactA1CabContactX - candidateDoor.x;
            sim.aircraft.position.z += exactA1CabContactZ - candidateDoor.z;
            sim.aircraft.updateMatrixWorld(true);
            renderedAircraft.updateMatrixWorld(true);
            const candidateBounds = new THREE.Box3().setFromObject(renderedAircraft);
            const corners = [
              [candidateBounds.min.x, candidateBounds.min.z],
              [candidateBounds.min.x, candidateBounds.max.z],
              [candidateBounds.max.x, candidateBounds.min.z],
              [candidateBounds.max.x, candidateBounds.max.z],
            ];
            const minimumApronClearanceMeters = Math.min(...corners.map(([x, z]) => (
              (x - measuredWallX) * apronNormalX + (z - measuredWallZ) * apronNormalZ
            )));
            return { candidateYaw, minimumApronClearanceMeters };
          };
          const sourceAxisCandidate = scoreA1AircraftHeading(sourceStandAircraftYaw);
          const reversedAxisCandidate = scoreA1AircraftHeading(sourceStandAircraftYaw + Math.PI);
          const selectedHeadingCandidate = sourceAxisCandidate.minimumApronClearanceMeters
            >= reversedAxisCandidate.minimumApronClearanceMeters
            ? sourceAxisCandidate
            : reversedAxisCandidate;
          if (selectedHeadingCandidate.minimumApronClearanceMeters < -0.25) {
            throw new Error(
              \`A1 aircraft penetrates the terminal wall for both model-axis readings: source=\${sourceAxisCandidate.minimumApronClearanceMeters} m reversed=\${reversedAxisCandidate.minimumApronClearanceMeters} m\`,
            );
          }
          sim.aircraft.position.x = initialAircraftXForHeading;
          sim.aircraft.position.z = initialAircraftZForHeading;
          sim.aircraft.rotation.y = selectedHeadingCandidate.candidateYaw;
          sim.aircraft.updateMatrixWorld(true);
          renderedAircraft.updateMatrixWorld(true);
          renderer.domElement.dataset.inspectionAircraftTerminalHalfPlaneAuthority = "${marker}";
          renderer.domElement.dataset.inspectionAircraftTerminalHalfPlaneMinimumClearanceMeters = selectedHeadingCandidate.minimumApronClearanceMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftModelAxisFlipDegrees = Math.abs(
            selectedHeadingCandidate.candidateYaw - sourceStandAircraftYaw,
          ) > 1 ? "180" : "0";
          renderer.domElement.dataset.inspectionAircraftYaw = selectedHeadingCandidate.candidateYaw.toFixed(6);
          const renderedDoorBefore = renderedAircraft.localToWorld(authoredDoorLocal.clone());`;

source = source.replace(anchor, replacement);

for (const token of [
  marker,
  "uploadedJetwayA1FinalMeasuredWallWorldX",
  "const sourceAxisCandidate = scoreA1AircraftHeading(sourceStandAircraftYaw)",
  "const reversedAxisCandidate = scoreA1AircraftHeading(sourceStandAircraftYaw + Math.PI)",
  "inspectionAircraftTerminalHalfPlaneMinimumClearanceMeters",
  "inspectionAircraftModelAxisFlipDegrees",
  "A1 aircraft penetrates the terminal wall for both model-axis readings",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: terminal half-plane output is missing ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Selected the A1 CRJ exporter model-axis interpretation from the measured terminal wall half-plane and rejected terminal-penetrating aircraft poses.");
