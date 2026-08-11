import fs from "node:fs";

await import(`./prepare-a1-supplied-tunnel-terminal-sleeve-v1.mjs?sleeve=${Date.now()}`);

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const authority = "a1-fixed-aircraft-calibrated-to-attached-live-cab-v1";
const marker = "a1-attached-state-owns-fixed-aircraft-calibration-v1";
let source = fs.readFileSync(trainerPath, "utf8");

if (!source.includes(marker)) {
  const measurementAnchor = `          if (!finalA1Anchor || !finalA1Model || !finalA1Rotunda || !finalA1TunnelA || !finalA1Cab) {
            throw new Error("A1 final live-Cab registration cannot resolve the visible Rotunda/Tunnel-A/Cab chain");
          }
          exactA1Fleet.updateWorldMatrix(true, true);`;
  const measurementReplacement = `          if (!finalA1Anchor || !finalA1Model || !finalA1Rotunda || !finalA1TunnelA || !finalA1Cab) {
            throw new Error("A1 final live-Cab registration cannot resolve the visible Rotunda/Tunnel-A/Cab chain");
          }
          // ${marker}
          // The fixed aircraft pose must be calibrated against the jetway's
          // fully ATTACHED visible Cab. Inspection normally parks A1 at
          // deployment 0, so measuring that state makes the later A1 evidence
          // preset extend the Cab away from the already-fixed aircraft. Sample
          // deployment 1 synchronously, lock the aircraft to that physical Cab,
          // then restore the prior jetway state without moving the aircraft.
          const a1RegistrationController = jetwayRef.current.controller;
          if (!a1RegistrationController?.setDeployment || !a1RegistrationController?.getDeployment) {
            throw new Error("A1 attached-state aircraft calibration is missing the exact jetway controller");
          }
          const a1RegistrationRestoreDeployment = Number(a1RegistrationController.getDeployment());
          if (!Number.isFinite(a1RegistrationRestoreDeployment)) {
            throw new Error(\`A1 pre-calibration deployment is invalid: \${a1RegistrationRestoreDeployment}\`);
          }
          a1RegistrationController.setDeployment(1);
          exactA1Fleet.updateWorldMatrix(true, true);`;
  if (!source.includes(measurementAnchor)) {
    throw new Error(`${trainerPath}: final live-Cab measurement anchor is missing`);
  }
  source = source.replace(measurementAnchor, measurementReplacement);

  const completionAnchor = `          renderer.domElement.dataset.inspectionAircraftDoorParentLocalDeltaZ = requiredParentLocalDelta.z.toFixed(6);`;
  const completionReplacement = `${completionAnchor}
          renderer.domElement.dataset.inspectionAircraftCalibrationAuthority = "${authority}";
          renderer.domElement.dataset.inspectionAircraftCalibrationJetwayDeployment = "1.000000";
          renderer.domElement.dataset.inspectionAircraftCalibrationJetwayRestoredDeployment = a1RegistrationRestoreDeployment.toFixed(6);
          a1RegistrationController.setDeployment(a1RegistrationRestoreDeployment);
          exactA1Fleet.updateWorldMatrix(true, true);`;
  if (!source.includes(completionAnchor)) {
    throw new Error(`${trainerPath}: final live-Cab calibration completion anchor is missing`);
  }
  source = source.replace(completionAnchor, completionReplacement);
}

for (const token of [
  marker,
  `inspectionAircraftCalibrationAuthority = "${authority}"`,
  "const a1RegistrationController = jetwayRef.current.controller",
  "const a1RegistrationRestoreDeployment = Number(a1RegistrationController.getDeployment())",
  "a1RegistrationController.setDeployment(1)",
  "inspectionAircraftCalibrationJetwayDeployment = \"1.000000\"",
  "a1RegistrationController.setDeployment(a1RegistrationRestoreDeployment)",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: attached-state A1 aircraft calibration is missing ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Calibrated the fixed A1 aircraft pose against the fully attached live Cab after matching the terminal sleeve to supplied Tunnel A, then restored the prior jetway deployment without moving the aircraft.");
