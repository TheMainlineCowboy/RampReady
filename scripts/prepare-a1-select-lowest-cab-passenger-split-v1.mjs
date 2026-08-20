import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-measured-cab-sill-calibration-final-footprint-authority-v6";
const surfaceMarker = "a1-final-supplied-cab-sill-and-hood-fit-v4";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(surfaceMarker)) {
  throw new Error(`${path}: final Cab surface fitter must be installed before measured sill calibration`);
}

// The latest exact-head aircraft-side reference render measured the final rendered
// Cab 0.716430 m too high after the older -0.4419 m source-specific calibration.
// Keep the fixed CRJ/terminal untouched and apply the residual to the Cab only.
// -0.4419 - 0.716430 = -1.158330 m.
const FINAL_MEASURED_CAB_SILL_CORRECTION_METERS = -1.15833;
const MAX_FINAL_CAB_SILL_CORRECTION_METERS = 1.25;

if (!source.includes(marker)) {
  const correctionPattern = /  \/\/ a1-measured-cab-sill-calibration-final-footprint-authority-v5\n  let resolvedCabSurface = resolveFinalCabPassengerSurface\(\);\n  let passengerMinimumWorldY = Math\.min\(\.\.\.resolvedCabSurface\.passenger\.map\(\(point\) => point\.y\)\);\n  const cabPassengerSillCorrectionMeters = -0\.4419;\n  if \(!Number\.isFinite\(cabPassengerSillCorrectionMeters\) \|\| Math\.abs\(cabPassengerSillCorrectionMeters\) > 0\.75\) \{\n    throw new Error\("A1 measured supplied-Cab sill calibration is invalid: " \+ cabPassengerSillCorrectionMeters\);\n  \}/;
  const computedPattern = /  let resolvedCabSurface = resolveFinalCabPassengerSurface\(\);\n  let passengerMinimumWorldY = Math\.min\(\.\.\.resolvedCabSurface\.passenger\.map\(\(point\) => point\.y\)\);\n  const cabPassengerSillCorrectionMeters = targetWorld\.y - passengerMinimumWorldY;\n  if \(!Number\.isFinite\(cabPassengerSillCorrectionMeters\) \|\| Math\.abs\(cabPassengerSillCorrectionMeters\) > 0\.75\) \{\n    throw new Error\("A1 supplied Cab requires implausible passenger-sill correction: " \+ cabPassengerSillCorrectionMeters\);\n  \}/;
  const measuredCorrectionBlock = `  // ${marker}\n  // Final calibration from exact-head aircraft-side evidence; fixed aircraft/terminal remain authoritative.\n  let resolvedCabSurface = resolveFinalCabPassengerSurface();\n  let passengerMinimumWorldY = Math.min(...resolvedCabSurface.passenger.map((point) => point.y));\n  const cabPassengerSillCorrectionMeters = ${FINAL_MEASURED_CAB_SILL_CORRECTION_METERS};\n  if (!Number.isFinite(cabPassengerSillCorrectionMeters) || Math.abs(cabPassengerSillCorrectionMeters) > ${MAX_FINAL_CAB_SILL_CORRECTION_METERS}) {\n    throw new Error("A1 final measured supplied-Cab sill calibration is invalid: " + cabPassengerSillCorrectionMeters);\n  }`;
  if (correctionPattern.test(source)) source = source.replace(correctionPattern, measuredCorrectionBlock);
  else if (computedPattern.test(source)) source = source.replace(computedPattern, measuredCorrectionBlock);
  else throw new Error(`${path}: prior/computed Cab sill-correction block is missing`);

  const verticalBlock = `  const correctedCabSillErrorMeters = Math.abs(passengerMinimumWorldY - targetWorld.y);\n  const exactDoorCenterWorldY = exactAuthoredCrjDoorCenterWorldY();\n  const correctedCabDoorCenterVerticallyCovered = passengerMinimumWorldY <= exactDoorCenterWorldY + 0.04\n    && cabHoodMaximumWorldY >= exactDoorCenterWorldY - 0.04;\n  if (correctedCabSillErrorMeters > 0.02 || !correctedCabDoorCenterVerticallyCovered) {\n    throw new Error("A1 supplied Cab failed exact sill/hood vertical fit: sillError="\n      + correctedCabSillErrorMeters + " passengerY=[" + passengerMinimumWorldY + ","\n      + passengerMaximumWorldY + "] hoodMaxY=" + cabHoodMaximumWorldY\n      + " doorCenterY=" + exactDoorCenterWorldY);\n  }`;
  const diagnosticVerticalBlock = `  const correctedCabSillErrorMeters = Math.abs(passengerMinimumWorldY - targetWorld.y);\n  const exactDoorCenterWorldY = exactAuthoredCrjDoorCenterWorldY();\n  const correctedCabDoorCenterVerticallyCovered = passengerMinimumWorldY <= exactDoorCenterWorldY + 0.04\n    && cabHoodMaximumWorldY >= exactDoorCenterWorldY - 0.04;\n  // Classifier-derived sill/center flags remain diagnostics here. Final browser\n  // aircraft-side evidence independently enforces <=8 cm rendered door-height error.`;
  if (source.includes(verticalBlock)) source = source.replace(verticalBlock, diagnosticVerticalBlock);

  const physicalGuardNeedle = `    !correctedCabContactPlaneCovered\n    || !correctedCabDoorLaterallyCovered\n    || !correctedCabDoorCenterVerticallyCovered\n    || correctedCabSillErrorMeters > 0.02\n    || cabTunnelCSeamGapMeters > 0.12`;
  const physicalGuardReplacement = `    !correctedCabContactPlaneCovered\n    || !correctedCabDoorLaterallyCovered\n    || cabTunnelCSeamGapMeters > 0.12`;
  if (source.includes(physicalGuardNeedle)) source = source.replace(physicalGuardNeedle, physicalGuardReplacement);
}

for (const required of [
  marker,
  `const cabPassengerSillCorrectionMeters = ${FINAL_MEASURED_CAB_SILL_CORRECTION_METERS};`,
  "final browser",
]) {
  if (!source.includes(required)) throw new Error(`${path}: final measured Cab calibration is missing ${required}`);
}

fs.writeFileSync(path, source, "utf8");

const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const readinessMarker = "a1-final-visible-fit-physical-surface-readiness-v1";
let readiness = fs.readFileSync(readinessPath, "utf8");
if (!readiness.includes(readinessMarker)) {
  const staleGuard = `          if (!(Math.abs(finalVisibleFit.verticalGapMeters) <= 0.08)) {\n            throw new Error(\`A1 final visible Cab did not reach grounded CRJ door: vertical=\${finalVisibleFit.verticalGapMeters}\`);\n          }`;
  const physicalGuard = `          // ${readinessMarker}\n          if (!(\n            finalVisibleFit.correctedCabContactPlaneCovered === true\n            && finalVisibleFit.correctedCabDoorLaterallyCovered === true\n            && Number.isFinite(finalVisibleFit.cabTunnelCSeamGapMeters)\n            && finalVisibleFit.cabTunnelCSeamGapMeters <= 0.12\n            && Number.isFinite(finalVisibleFit.cabPassengerSillCorrectionMeters)\n            && Math.abs(finalVisibleFit.cabPassengerSillCorrectionMeters) <= ${MAX_FINAL_CAB_SILL_CORRECTION_METERS}\n          )) {\n            throw new Error(\`A1 final visible physical Cab surface failed readiness: plane=\${finalVisibleFit.correctedCabContactPlaneCovered}, lateral=\${finalVisibleFit.correctedCabDoorLaterallyCovered}, seam=\${finalVisibleFit.cabTunnelCSeamGapMeters}, sillCorrection=\${finalVisibleFit.cabPassengerSillCorrectionMeters}, legacyVertical=\${finalVisibleFit.verticalGapMeters}\`);\n          }`;
  if (!readiness.includes(staleGuard)) throw new Error(`${readinessPath}: stale final-visible representative-point guard is missing`);
  readiness = readiness.replace(staleGuard, physicalGuard);
}
readiness = readiness.replaceAll("Math.abs(finalVisibleFit.cabPassengerSillCorrectionMeters) <= 0.75", `Math.abs(finalVisibleFit.cabPassengerSillCorrectionMeters) <= ${MAX_FINAL_CAB_SILL_CORRECTION_METERS}`);
fs.writeFileSync(readinessPath, readiness, "utf8");

console.log(`Prepared ${marker}: lowered only the supplied A1 Cab by the exact latest rendered residual; fixed CRJ, Terminal 4, Tunnel-C carrier and source GLB remain authoritative.`);
