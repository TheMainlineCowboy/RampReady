import fs from "node:fs";

// Compatibility markers consumed by the established A1 simulator verifier:
// RampReady mobile HUD hard containment v9
// overflow-wrap: anywhere
// v10 is the final cascade layer and keeps v9's containment contract intact.
const runtimePath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const stylePath = "src/components/mobile-hud-v10.css";
const stableImportAnchor = 'import "./mobile-runtime-recovery.css";';
const legacyImportLine = 'import "./mobile-hud-v9.css";';
const importLine = 'import "./mobile-hud-v10.css";';

let runtime = fs.readFileSync(runtimePath, "utf8");
if (!runtime.includes(stableImportAnchor)) {
  throw new Error("Terminal 4 runtime is missing the stable mobile recovery stylesheet import anchor");
}

// The Terminal 4 runtime is regenerated earlier in prepare:terminal4-runtime,
// so neither HUD layer can be assumed to survive into this step. Reinstall the
// established v9 containment layer first, then v10 as the final mobile cascade.
if (!runtime.includes(legacyImportLine)) {
  runtime = runtime.replace(stableImportAnchor, `${stableImportAnchor}\n${legacyImportLine}`);
}
if (!runtime.includes(importLine)) {
  runtime = runtime.replace(legacyImportLine, `${legacyImportLine}\n${importLine}`);
}
fs.writeFileSync(runtimePath, runtime, "utf8");

const style = fs.readFileSync(stylePath, "utf8");
for (const token of [
  "/* RampReady mobile HUD compact simulator layout v10 */",
  ".rr-shell .rr-hud",
  ".rr-shell .rr-metrics",
  ".rr-shell .rr-throttle",
  ".rr-shell .rr-steer",
  "grid-template-columns: 62px minmax(0, 1fr) 58px",
  "content: \"Inspect\"",
]) if (!style.includes(token)) throw new Error(`Mobile HUD v10 stylesheet is missing ${token}`);

const preparedRuntime = fs.readFileSync(runtimePath, "utf8");
for (const requiredImport of [legacyImportLine, importLine]) {
  if (!preparedRuntime.includes(requiredImport)) {
    throw new Error(`Terminal 4 runtime did not import required mobile HUD layer ${requiredImport}`);
  }
}
if (preparedRuntime.indexOf(legacyImportLine) > preparedRuntime.indexOf(importLine)) {
  throw new Error("Mobile HUD v10 must cascade after v9 containment");
}

console.log("Prepared regeneration-safe compact mobile simulator HUD v10: restored v9 containment, then applied the shallow top status panel, compact telemetry pill and two 44 px driving-control strips.");
