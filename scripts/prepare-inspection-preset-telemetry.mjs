import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const marker = 'dataset.inspectionTelemetryAuthority = "synchronous-preset-placement-v2"';
if (!source.includes(marker)) {
  const toggleAnchor = `      sim.renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY;
      const inspectionJetwayDeployment = next ? 0 : 1;`;
  const toggleReplacement = `      sim.renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY;
      const defaultInspectionPreset = INSPECTION_PRESETS.a1;
      sim.renderer.domElement.dataset.inspectionTugX = (next ? defaultInspectionPreset.x : 0).toFixed(3);
      sim.renderer.domElement.dataset.inspectionTugZ = (next ? defaultInspectionPreset.z : 0).toFixed(3);
      sim.renderer.domElement.dataset.inspectionSpeed = "0.000";
      sim.renderer.domElement.dataset.inspectionTelemetryAuthority = "synchronous-preset-placement-v2";
      const inspectionJetwayDeployment = next ? 0 : 1;`;
  if (!source.includes(toggleAnchor)) {
    throw new Error(`${trainerPath}: missing inspection toggle telemetry anchor`);
  }
  source = source.replace(toggleAnchor, toggleReplacement);

  const presetAnchor = `    canvas.dataset.inspectionTugX = preset.x.toFixed(3);
    canvas.dataset.inspectionTugZ = preset.z.toFixed(3);`;
  const presetReplacement = `    canvas.dataset.inspectionTugX = preset.x.toFixed(3);
    canvas.dataset.inspectionTugZ = preset.z.toFixed(3);
    canvas.dataset.inspectionSpeed = "0.000";
    canvas.dataset.inspectionTelemetryAuthority = "synchronous-preset-placement-v2";`;
  if (!source.includes(presetAnchor)) {
    throw new Error(`${trainerPath}: missing inspection preset telemetry anchor`);
  }
  source = source.replace(presetAnchor, presetReplacement);
}

for (const token of [
  'dataset.inspectionTelemetryAuthority = "synchronous-preset-placement-v2"',
  'dataset.inspectionSpeed = "0.000"',
  "defaultInspectionPreset.x",
  "defaultInspectionPreset.z",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: inspection telemetry is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared synchronous inspection preset telemetry so every location is immediately drive-ready before the next WebGL frame.");
