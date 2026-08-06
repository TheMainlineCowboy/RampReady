import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const authority = "synchronous-preset-placement-v2";
const toggleMarker = `sim.renderer.domElement.dataset.inspectionTelemetryAuthority = "${authority}";`;
const presetMarker = `canvas.dataset.inspectionTelemetryAuthority = "${authority}";`;
const connectedPresetMarker = `const inspectionPresetJetwayDeployment = preset.id === "a1Connection" ? 1 : 0;`;

if (!source.includes(toggleMarker)) {
  const toggleAnchor = `      sim.renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY;
      const inspectionJetwayDeployment = next ? 0 : 1;`;
  const toggleReplacement = `      sim.renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY;
      const defaultInspectionPreset = INSPECTION_PRESETS.a1;
      sim.renderer.domElement.dataset.inspectionTugX = (next ? defaultInspectionPreset.x : 0).toFixed(3);
      sim.renderer.domElement.dataset.inspectionTugZ = (next ? defaultInspectionPreset.z : 0).toFixed(3);
      sim.renderer.domElement.dataset.inspectionSpeed = "0.000";
      sim.renderer.domElement.dataset.inspectionTelemetryAuthority = "${authority}";
      const inspectionJetwayDeployment = next ? 0 : 1;`;
  if (!source.includes(toggleAnchor)) {
    throw new Error(`${trainerPath}: missing inspection toggle telemetry anchor`);
  }
  source = source.replace(toggleAnchor, toggleReplacement);
}

if (!source.includes(presetMarker)) {
  const presetAnchor = `    canvas.dataset.inspectionTugX = preset.x.toFixed(3);
    canvas.dataset.inspectionTugZ = preset.z.toFixed(3);`;
  const presetReplacement = `    canvas.dataset.inspectionTugX = preset.x.toFixed(3);
    canvas.dataset.inspectionTugZ = preset.z.toFixed(3);
    canvas.dataset.inspectionSpeed = "0.000";
    canvas.dataset.inspectionTelemetryAuthority = "${authority}";`;
  if (!source.includes(presetAnchor)) {
    throw new Error(`${trainerPath}: missing inspection preset telemetry anchor`);
  }
  source = source.replace(presetAnchor, presetReplacement);
}

if (!source.includes(connectedPresetMarker)) {
  const deploymentAnchor = `    canvas.dataset.inspectionTelemetryAuthority = "${authority}";`;
  const deploymentReplacement = `    canvas.dataset.inspectionTelemetryAuthority = "${authority}";
    // The normal free-drive presets keep A1 parked clear. The dedicated A1
    // connection preset is acceptance evidence, so it shows the bridge fully
    // attached to the grounded CRJ door rather than the parked/retracted state.
    const inspectionPresetJetwayDeployment = preset.id === "a1Connection" ? 1 : 0;
    jetwayRef.current.target = inspectionPresetJetwayDeployment;
    jetwayRef.current.deployment = inspectionPresetJetwayDeployment;
    jetwayRef.current.transitionStartDeployment = inspectionPresetJetwayDeployment;
    jetwayRef.current.transitionStartedAt = 0;
    jetwayRef.current.retractionRequested = false;
    jetwayRef.current.controller?.setDeployment(inspectionPresetJetwayDeployment);
    canvas.dataset.a1JetwayDeployment = inspectionPresetJetwayDeployment.toFixed(3);
    canvas.dataset.a1JetwayState = jetwayRef.current.controller?.getState?.()
      || (inspectionPresetJetwayDeployment === 1 ? "attached-to-aircraft-door" : "parked-clear-of-aircraft");`;
  if (!source.includes(deploymentAnchor)) {
    throw new Error(`${trainerPath}: missing inspection preset deployment anchor`);
  }
  source = source.replace(deploymentAnchor, deploymentReplacement);
}

for (const token of [
  toggleMarker,
  presetMarker,
  connectedPresetMarker,
  'dataset.inspectionSpeed = "0.000"',
  "defaultInspectionPreset.x",
  "defaultInspectionPreset.z",
  "jetwayRef.current.controller?.setDeployment(inspectionPresetJetwayDeployment)",
  "canvas.dataset.a1JetwayDeployment = inspectionPresetJetwayDeployment.toFixed(3)",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: inspection telemetry is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared synchronous inspection telemetry and an attached A1 connection evidence preset while keeping normal free-drive presets parked clear.");
