import fs from "node:fs";

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
let source = fs.readFileSync(readinessPath, "utf8");

const residualFailure = "Math.abs(fleetGroundOffset + bogieTireCorrection) > 1e-6";
const mismatchMarker = "Exact jetway readiness mismatch:";

if (!source.includes("const fleetGroundOffset") || !source.includes("const bogieTireCorrection")) {
  throw new Error(`${readinessPath}: final fleet/bogie telemetry declarations are missing`);
}

if (!source.includes(residualFailure)) {
  const mismatchIndex = source.indexOf(mismatchMarker);
  if (mismatchIndex < 0) {
    throw new Error(`${readinessPath}: exact readiness mismatch block is missing for final ground-contact guard`);
  }

  const conditionStart = source.lastIndexOf("\n          if (\n", mismatchIndex);
  if (conditionStart < 0) {
    throw new Error(`${readinessPath}: exact readiness condition opening is missing for final ground-contact guard`);
  }

  const insertionPoint = conditionStart + "\n          if (\n".length;
  source = `${source.slice(0, insertionPoint)}            ${residualFailure}\n            || ${source.slice(insertionPoint).replace(/^\s*/, "")}`;
  fs.writeFileSync(readinessPath, source, "utf8");
}

console.log("Ensured final exact-model bogie ground-contact residual remains fail-closed before semantic readiness normalization.");
await import(`./normalize-final-jetway-readiness-after-runtime.mjs?ground-contact-guard=${Date.now()}`);
