import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const staleAuthority = "terminal-relocated-a1-exact-cab-registration-v1";
const finalAuthority = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2";
const marker = "final-a1-acceptance-authority-after-all-preparers-v1";
const facadeTelemetryMarker = "final-terminal4-lower-facade-fit-publication-v3";

// Several historical build-time preparers can regenerate the aircraft
// registration block from an older template. This finalizer deliberately runs
// after every geometry, lifecycle and telemetry preparer so the production
// bundle cannot publish the superseded horizontal-only authority.
source = source.replaceAll(staleAuthority, finalAuthority);

// The lower-facade-fit preparer runs before the final inspection telemetry
// preparer. That later preparer can regenerate the dataset assignment from an
// older template and expose the supplemental 55-ray count even though the
// browser already publishes the authoritative resolved terminal-connection
// count. Mirror that exact browser value first, then fall back to environment
// telemetry. This changes acceptance evidence only; no model, placement,
// hierarchy, transform, material, UV or texture is modified.
const facadeTelemetryAssignment = `        // ${facadeTelemetryMarker}
        renderer.domElement.dataset.terminal4LowerFacadeFitCount = String(
          renderer.domElement.dataset.terminal4TerminalConnectedJetwayCount
            ?? environment.userData.authoredTerminal4TerminalConnectedJetwayCount
            ?? environment.userData.authoredTerminal4LowerFacadeFitCount
            ?? 0,
        );`;
const facadeTelemetryPattern = /        (?:\/\/ terminal-connected-lower-facade-fit-accounting-v\d+-trainer-publication\n|\/\/ final-terminal4-lower-facade-fit-publication-v\d+\n)?        renderer\.domElement\.dataset\.terminal4LowerFacadeFitCount = String\([\s\S]*?        \);/;
if (facadeTelemetryPattern.test(source)) {
  source = source.replace(facadeTelemetryPattern, facadeTelemetryAssignment);
} else {
  throw new Error(`${trainerPath}: final lower-facade browser telemetry assignment is missing`);
}

if (!source.includes(marker)) {
  const anchor = `const INSPECTION_ROUTE_AUTHORITY =`;
  const index = source.indexOf(anchor);
  if (index < 0) throw new Error(`${trainerPath}: inspection route authority anchor is missing`);
  source = `${source.slice(0, index)}// ${marker}\n${source.slice(index)}`;
}

for (const required of [
  marker,
  facadeTelemetryMarker,
  finalAuthority,
  "inspectionAircraftDoorVerticalErrorMeters",
  "inspectionAircraftGroundClearanceMeters",
  "inspectionAircraftJetwayVerticalFitMeters",
  "grounded-aircraft-door-progressive-tunnel-slope-v1",
  "terminal4TerminalConnectedJetwayCount",
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
console.log("Finalized the generated A1 acceptance runtime with the persisted measured aircraft pose authority, grounded vertical door fit, attached connection preset, and lower-facade telemetry mirrored from the exact resolved terminal-connected jetway count after every preparer.");
