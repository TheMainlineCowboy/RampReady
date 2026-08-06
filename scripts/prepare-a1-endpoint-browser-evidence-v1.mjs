import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = "exact-a1-world-endpoint-browser-evidence-v1";
if (source.includes(marker)) {
  console.log("Exact A1 world endpoint browser evidence is already prepared.");
  process.exit(0);
}

const fleetAnchor = "        const exactA1Fleet = environment.userData.authoredTerminal4Jetways;";
const endpointDeclarations = `        const exactA1Fleet = environment.userData.authoredTerminal4Jetways;
        // ${marker}
        const exactA1RotundaWorldX = Number(exactA1Fleet?.userData?.uploadedJetwayA1FinalRotundaWorldX);
        const exactA1RotundaWorldY = Number(exactA1Fleet?.userData?.uploadedJetwayA1FinalRotundaWorldY);
        const exactA1RotundaWorldZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1FinalRotundaWorldZ);
        const exactA1MeasuredWallWorldX = Number(exactA1Fleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldX);
        const exactA1MeasuredWallWorldY = Number(exactA1Fleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldY);
        const exactA1MeasuredWallWorldZ = Number(exactA1Fleet?.userData?.uploadedJetwayA1FinalMeasuredWallWorldZ);
        const exactA1RotundaToCabWorldMeters = Number(exactA1Fleet?.userData?.uploadedJetwayA1FinalRotundaToCabWorldMeters);
        const exactA1RotundaToWallWorldMeters = Number(exactA1Fleet?.userData?.uploadedJetwayA1FinalRotundaToWallWorldMeters);
        const exactA1EndpointEvidenceAuthority = exactA1Fleet?.userData?.uploadedJetwayA1FinalEndpointEvidenceAuthority || "missing";`;
if (!source.includes(fleetAnchor)) {
  throw new Error(`${trainerPath}: exact A1 fleet anchor is missing`);
}
source = source.replace(fleetAnchor, endpointDeclarations);

const finiteAnchor = `        if (![exactA1CabContactX, exactA1CabContactY, exactA1CabContactZ, exactA1CabDirectionX, exactA1CabDirectionZ].every(Number.isFinite)) {`;
const finiteEndpoints = `        if (![exactA1CabContactX, exactA1CabContactY, exactA1CabContactZ, exactA1CabDirectionX, exactA1CabDirectionZ,
          exactA1RotundaWorldX, exactA1RotundaWorldY, exactA1RotundaWorldZ,
          exactA1MeasuredWallWorldX, exactA1MeasuredWallWorldY, exactA1MeasuredWallWorldZ,
          exactA1RotundaToCabWorldMeters, exactA1RotundaToWallWorldMeters,
        ].every(Number.isFinite)) {`;
if (!source.includes(finiteAnchor)) {
  throw new Error(`${trainerPath}: three-axis A1 finite-value validation anchor is missing`);
}
source = source.replace(finiteAnchor, finiteEndpoints);

const cabDatasetAnchor = `          renderer.domElement.dataset.inspectionAircraftCabContactX = exactA1CabContactX.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactY = exactA1CabContactY.toFixed(6);
          renderer.domElement.dataset.inspectionAircraftCabContactZ = exactA1CabContactZ.toFixed(6);`;
const endpointDatasets = `${cabDatasetAnchor}
          renderer.domElement.dataset.a1ExactRotundaWorldX = exactA1RotundaWorldX.toFixed(6);
          renderer.domElement.dataset.a1ExactRotundaWorldY = exactA1RotundaWorldY.toFixed(6);
          renderer.domElement.dataset.a1ExactRotundaWorldZ = exactA1RotundaWorldZ.toFixed(6);
          renderer.domElement.dataset.a1ExactMeasuredWallWorldX = exactA1MeasuredWallWorldX.toFixed(6);
          renderer.domElement.dataset.a1ExactMeasuredWallWorldY = exactA1MeasuredWallWorldY.toFixed(6);
          renderer.domElement.dataset.a1ExactMeasuredWallWorldZ = exactA1MeasuredWallWorldZ.toFixed(6);
          renderer.domElement.dataset.a1ExactRotundaToCabWorldMeters = exactA1RotundaToCabWorldMeters.toFixed(6);
          renderer.domElement.dataset.a1ExactRotundaToWallWorldMeters = exactA1RotundaToWallWorldMeters.toFixed(6);
          renderer.domElement.dataset.a1ExactEndpointEvidenceAuthority = exactA1EndpointEvidenceAuthority;`;
if (!source.includes(cabDatasetAnchor)) {
  throw new Error(`${trainerPath}: three-axis Cab dataset anchor is missing`);
}
source = source.replace(cabDatasetAnchor, endpointDatasets);

for (const token of [
  marker,
  "uploadedJetwayA1FinalRotundaWorldX",
  "uploadedJetwayA1FinalMeasuredWallWorldX",
  "uploadedJetwayA1FinalRotundaToCabWorldMeters",
  "a1ExactRotundaWorldX",
  "a1ExactMeasuredWallWorldX",
  "a1ExactRotundaToCabWorldMeters",
  "a1ExactEndpointEvidenceAuthority",
]) {
  if (!source.includes(token)) {
    throw new Error(`${trainerPath}: A1 endpoint browser token is missing: ${token}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-a1-dynamic-evidence-camera-v1.mjs?exact-endpoint-camera=${Date.now()}`);
console.log("Exposed exact world-space A1 Rotunda, grounded wall and Cab endpoints and derived the evidence cameras from those final runtime coordinates.");
