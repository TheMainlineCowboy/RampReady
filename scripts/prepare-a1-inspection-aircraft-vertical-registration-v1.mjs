import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "rendered-a1-door-grounded-horizontal-cab-registration-v2";
if (source.includes(marker)) {
  console.log("A1 rendered-aircraft grounded Cab registration is already prepared.");
  process.exit(0);
}

const cabDeclarations = `        const exactA1CabContactX = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldX);
        const exactA1CabContactZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldZ);`;
const cabDeclarations3d = `        const exactA1CabContactX = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldX);
        const exactA1CabContactY = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldY); // ${marker}
        const exactA1CabContactZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1CabContactWorldZ);`;
if (!source.includes(cabDeclarations)) {
  throw new Error(`${trainerPath}: A1 Cab X/Z declaration anchor is missing`);
}
source = source.replace(cabDeclarations, cabDeclarations3d);

const finiteValidation = `        if (![exactA1CabContactX, exactA1CabContactZ, exactA1CabDirectionX, exactA1CabDirectionZ].every(Number.isFinite)) {`;
const finiteValidation3d = `        if (![exactA1CabContactX, exactA1CabContactY, exactA1CabContactZ, exactA1CabDirectionX, exactA1CabDirectionZ].every(Number.isFinite)) {`;
if (!source.includes(finiteValidation)) {
  throw new Error(`${trainerPath}: A1 Cab finite-value validation anchor is missing`);
}
source = source.replace(finiteValidation, finiteValidation3d);

const relocationBlock = `          const aircraftRelocationX = exactA1CabContactX - renderedDoorBefore.x;
          const aircraftRelocationZ = exactA1CabContactZ - renderedDoorBefore.z;
          sim.aircraft.position.x += aircraftRelocationX;
          sim.aircraft.position.z += aircraftRelocationZ;`;
const relocationBlockGrounded = `          const renderedBoundsBefore = new THREE.Box3().setFromObject(renderedAircraft);
          const aircraftRelocationX = exactA1CabContactX - renderedDoorBefore.x;
          // Keep the aircraft landing gear on the ramp. The jetway must meet a grounded
          // aircraft; lifting the complete CRJ to the Cab creates a visually false floating pose.
          const aircraftRelocationY = -renderedBoundsBefore.min.y;
          const aircraftRelocationZ = exactA1CabContactZ - renderedDoorBefore.z;
          sim.aircraft.position.x += aircraftRelocationX;
          sim.aircraft.position.y += aircraftRelocationY;
          sim.aircraft.position.z += aircraftRelocationZ;`;
if (!source.includes(relocationBlock)) {
  throw new Error(`${trainerPath}: rendered aircraft X/Z relocation anchor is missing`);
}
source = source.replace(relocationBlock, relocationBlockGrounded);

const errorBlock = `          const cabContactErrorMeters = Math.hypot(
            renderedDoorAfter.x - exactA1CabContactX,
            renderedDoorAfter.z - exactA1CabContactZ,
          );`;
const errorBlockGrounded = `          const cabContactErrorMeters = Math.hypot(
            renderedDoorAfter.x - exactA1CabContactX,
            renderedDoorAfter.z - exactA1CabContactZ,
          );`;
if (!source.includes(errorBlock)) {
  throw new Error(`${trainerPath}: rendered aircraft X/Z Cab error anchor is missing`);
}
source = source.replace(errorBlock, errorBlockGrounded);

const boundsAnchor = `          const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft);
          const renderedDimensions = renderedBounds.getSize(new THREE.Vector3());`;
const boundsEvidence = `          const renderedBounds = new THREE.Box3().setFromObject(renderedAircraft);
          const renderedDimensions = renderedBounds.getSize(new THREE.Vector3());
          const renderedGroundClearanceMeters = renderedBounds.min.y;
          const renderedDoorVerticalErrorMeters = Math.abs(renderedDoorAfter.y - exactA1CabContactY);`;
if (!source.includes(boundsAnchor)) {
  throw new Error(`${trainerPath}: rendered aircraft bounds anchor is missing`);
}
source = source.replace(boundsAnchor, boundsEvidence);

const datasetAnchor = `          renderer.domElement.dataset.inspectionAircraftExactParentRelocationX = aircraftRelocationX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftExactParentRelocationZ = aircraftRelocationZ.toFixed(6);`;
const dataset3d = `          renderer.domElement.dataset.inspectionAircraftExactParentRelocationX = aircraftRelocationX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftExactParentRelocationY = aircraftRelocationY.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftExactParentRelocationZ = aircraftRelocationZ.toFixed(6);`;
if (!source.includes(datasetAnchor)) {
  throw new Error(`${trainerPath}: rendered aircraft relocation telemetry anchor is missing`);
}
source = source.replace(datasetAnchor, dataset3d);

const cabDatasetAnchor = `          renderer.domElement.dataset.inspectionAircraftCabContactX = exactA1CabContactX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactZ = exactA1CabContactZ.toFixed(6);`;
const cabDataset3d = `          renderer.domElement.dataset.inspectionAircraftCabContactX = exactA1CabContactX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactY = exactA1CabContactY.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactZ = exactA1CabContactZ.toFixed(6);`;
if (!source.includes(cabDatasetAnchor)) {
  throw new Error(`${trainerPath}: rendered Cab telemetry anchor is missing`);
}
source = source.replace(cabDatasetAnchor, cabDataset3d);

const doorDatasetAnchor = `          renderer.domElement.dataset.inspectionAircraftDoorTargetX = renderedDoorAfter.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAfter.z.toFixed(6);`;
const doorDataset3d = `          renderer.domElement.dataset.inspectionAircraftDoorTargetX = renderedDoorAfter.x.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetY = renderedDoorAfter.y.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorTargetZ = renderedDoorAfter.z.toFixed(6);`;
if (!source.includes(doorDatasetAnchor)) {
  throw new Error(`${trainerPath}: rendered door telemetry anchor is missing`);
}
source = source.replace(doorDatasetAnchor, doorDataset3d);

const contactEvidenceAnchor = `          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = cabContactErrorMeters.toFixed(6);`;
const contactEvidence3d = `          renderer.domElement.dataset.inspectionAircraftCabContactErrorMeters = cabContactErrorMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftDoorVerticalErrorMeters = renderedDoorVerticalErrorMeters.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftGroundClearanceMeters = renderedGroundClearanceMeters.toFixed(6);`;
if (!source.includes(contactEvidenceAnchor)) {
  throw new Error(`${trainerPath}: rendered Cab error telemetry anchor is missing`);
}
source = source.replace(contactEvidenceAnchor, contactEvidence3d);

for (const token of [
  marker,
  "uploadedJetwayA1CabContactWorldY",
  "const renderedBoundsBefore = new THREE.Box3().setFromObject(renderedAircraft)",
  "const aircraftRelocationY = -renderedBoundsBefore.min.y",
  "sim.aircraft.position.y += aircraftRelocationY",
  "const renderedGroundClearanceMeters = renderedBounds.min.y",
  "inspectionAircraftExactParentRelocationY",
  "inspectionAircraftCabContactY",
  "inspectionAircraftDoorTargetY",
  "inspectionAircraftDoorVerticalErrorMeters",
  "inspectionAircraftGroundClearanceMeters",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: grounded rendered-aircraft token is missing: ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared grounded rendered CRJ registration: horizontal door alignment remains exact while the landing gear stays on the ramp and vertical mismatch is reported honestly.");