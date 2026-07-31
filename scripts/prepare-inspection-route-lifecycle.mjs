import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

function replaceRequired(before, after, marker, label) {
  if (source.includes(marker)) return;
  if (!source.includes(before)) throw new Error(`${trainerPath}: missing ${label} anchor`);
  source = source.replace(before, after);
}

replaceRequired(
  '      sim.renderer.domElement.dataset.inspectionMode = next ? "active" : "training";',
  `      sim.renderer.domElement.dataset.inspectionMode = next ? "active" : "training";
      sim.renderer.domElement.dataset.inspectionPreset = next ? "a1" : "training";
      sim.renderer.domElement.dataset.inspectionPresetLabel = next ? INSPECTION_PRESETS.a1.label : "Training";
      sim.renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY;`,
  'sim.renderer.domElement.dataset.inspectionPreset = next ? "a1" : "training"',
  "inspection toggle route evidence",
);

replaceRequired(
  '    renderer.domElement.dataset.inspectionMode = inspectionRef.current ? "active" : "training";',
  `    renderer.domElement.dataset.inspectionMode = inspectionRef.current ? "active" : "training";
    renderer.domElement.dataset.inspectionPreset = inspectionRef.current ? inspectionPresetRef.current : "training";
    renderer.domElement.dataset.inspectionPresetLabel = inspectionRef.current
      ? (INSPECTION_PRESETS[inspectionPresetRef.current] || INSPECTION_PRESETS.a1).label
      : "Training";
    renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY;`,
  "renderer.domElement.dataset.inspectionPreset = inspectionRef.current ? inspectionPresetRef.current",
  "initial inspection route evidence",
);

for (const token of [
  'sim.renderer.domElement.dataset.inspectionPreset = next ? "a1" : "training"',
  "renderer.domElement.dataset.inspectionPreset = inspectionRef.current ? inspectionPresetRef.current",
  "sim.renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY",
  "renderer.domElement.dataset.inspectionRouteAuthority = INSPECTION_ROUTE_AUTHORITY",
]) {
  if (!source.includes(token)) throw new Error(`${trainerPath}: inspection lifecycle is missing ${token}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Prepared inspection route authority and A1 preset evidence for initial load and free-drive entry.");
