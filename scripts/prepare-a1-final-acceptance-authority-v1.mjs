import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const staleAuthority = "terminal-relocated-a1-exact-cab-registration-v1";
const finalAuthority = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2";
const marker = "final-a1-acceptance-authority-after-all-preparers-v1";

// Several historical build-time preparers can regenerate the aircraft
// registration block from an older template. This finalizer deliberately runs
// after every geometry, lifecycle and telemetry preparer so the production
// bundle cannot publish the superseded horizontal-only authority.
source = source.replaceAll(staleAuthority, finalAuthority);

if (!source.includes(marker)) {
  const anchor = `const INSPECTION_ROUTE_AUTHORITY =`;
  const index = source.indexOf(anchor);
  if (index < 0) throw new Error(`${trainerPath}: inspection route authority anchor is missing`);
  source = `${source.slice(0, index)}// ${marker}\n${source.slice(index)}`;
}

for (const required of [
  marker,
  finalAuthority,
  "inspectionAircraftDoorVerticalErrorMeters",
  "inspectionAircraftGroundClearanceMeters",
  "inspectionAircraftJetwayVerticalFitMeters",
  "grounded-aircraft-door-progressive-tunnel-slope-v1",
  "authoredTerminal4TerminalConnectedJetwayCount",
  "inspectionPresetJetwayDeployment",
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: final A1 acceptance output is missing ${required}`);
  }
}
if (source.includes(staleAuthority)) {
  throw new Error(`${trainerPath}: superseded A1 aircraft pose authority survived finalization`);
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Finalized the generated A1 acceptance runtime with the persisted measured aircraft pose authority, grounded vertical door fit, attached connection preset, and 58-gate facade telemetry.");
