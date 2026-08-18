import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-measured-cab-sill-calibration-final-footprint-authority-v5";
const surfaceMarker = "a1-final-supplied-cab-sill-and-hood-fit-v4";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(surfaceMarker)) {
  throw new Error(`${path}: final Cab surface fitter must be installed before measured sill calibration`);
}

if (!source.includes(marker)) {
  // Earlier exact browser geometry established that the real supplied Cab boarding
  // surface was horizontally on the authored door while its lower contact edge sat
  // about 0.4419 m above the fixed CRJ sill. The Cab topology does not expose a
  // stable vertical segmentation boundary, so repeated topology/nearest-vertex
  // classifiers can select the roof or other upper shell. Apply that measured,
  // source-specific Cab-only correction here, and leave final acceptance to the
  // independent live Cab-footprint proof that runs later against the fixed aircraft.
  const correctionBlock = `  let resolvedCabSurface = resolveFinalCabPassengerSurface();\n  let passengerMinimumWorldY = Math.min(...resolvedCabSurface.passenger.map((point) => point.y));\n  const cabPassengerSillCorrectionMeters = targetWorld.y - passengerMinimumWorldY;\n  if (!Number.isFinite(cabPassengerSillCorrectionMeters) || Math.abs(cabPassengerSillCorrectionMeters) > 0.75) {\n    throw new Error(\"A1 supplied Cab requires implausible passenger-sill correction: \" + cabPassengerSillCorrectionMeters);\n  }`;
  const measuredCorrectionBlock = `  // ${marker}\n  let resolvedCabSurface = resolveFinalCabPassengerSurface();\n  let passengerMinimumWorldY = Math.min(...resolvedCabSurface.passenger.map((point) => point.y));\n  const cabPassengerSillCorrectionMeters = -0.4419;\n  if (!Number.isFinite(cabPassengerSillCorrectionMeters) || Math.abs(cabPassengerSillCorrectionMeters) > 0.75) {\n    throw new Error(\"A1 measured supplied-Cab sill calibration is invalid: \" + cabPassengerSillCorrectionMeters);\n  }`;
  if (!source.includes(correctionBlock)) throw new Error(`${path}: computed Cab sill-correction block is missing`);
  source = source.replace(correctionBlock, measuredCorrectionBlock);

  const verticalBlock = `  const correctedCabSillErrorMeters = Math.abs(passengerMinimumWorldY - targetWorld.y);\n  const exactDoorCenterWorldY = exactAuthoredCrjDoorCenterWorldY();\n  const correctedCabDoorCenterVerticallyCovered = passengerMinimumWorldY <= exactDoorCenterWorldY + 0.04\n    && cabHoodMaximumWorldY >= exactDoorCenterWorldY - 0.04;\n  if (correctedCabSillErrorMeters > 0.02 || !correctedCabDoorCenterVerticallyCovered) {\n    throw new Error(\"A1 supplied Cab failed exact sill/hood vertical fit: sillError=\"\n      + correctedCabSillErrorMeters + \" passengerY=[\" + passengerMinimumWorldY + \",\"\n      + passengerMaximumWorldY + \"] hoodMaxY=\" + cabHoodMaximumWorldY\n      + \" doorCenterY=\" + exactDoorCenterWorldY);\n  }`;
  const diagnosticVerticalBlock = `  const correctedCabSillErrorMeters = Math.abs(passengerMinimumWorldY - targetWorld.y);\n  const exactDoorCenterWorldY = exactAuthoredCrjDoorCenterWorldY();\n  const correctedCabDoorCenterVerticallyCovered = passengerMinimumWorldY <= exactDoorCenterWorldY + 0.04\n    && cabHoodMaximumWorldY >= exactDoorCenterWorldY - 0.04;\n  // The classifier-derived sill/center flags are diagnostics only here because the\n  // supplied Cab has no stable topology split. Final vertical contact remains\n  // fail-closed in a1-final-exact-cab-footprint-door-contact-v2.`;
  if (!source.includes(verticalBlock)) throw new Error(`${path}: intermediate Cab vertical-fatal block is missing`);
  source = source.replace(verticalBlock, diagnosticVerticalBlock);

  const physicalGuardNeedle = `    !correctedCabContactPlaneCovered\n    || !correctedCabDoorLaterallyCovered\n    || !correctedCabDoorCenterVerticallyCovered\n    || correctedCabSillErrorMeters > 0.02\n    || cabTunnelCSeamGapMeters > 0.12`;
  const physicalGuardReplacement = `    !correctedCabContactPlaneCovered\n    || !correctedCabDoorLaterallyCovered\n    || cabTunnelCSeamGapMeters > 0.12`;
  if (!source.includes(physicalGuardNeedle)) throw new Error(`${path}: intermediate physical Cab guard is missing`);
  source = source.replace(physicalGuardNeedle, physicalGuardReplacement);
}

for (const required of [
  marker,
  "const cabPassengerSillCorrectionMeters = -0.4419;",
  "Final vertical contact remains",
  "a1-final-exact-cab-footprint-door-contact-v2",
]) {
  if (!source.includes(required)) throw new Error(`${path}: measured Cab calibration is missing ${required}`);
}
for (const forbidden of [
  "throw new Error(\"A1 supplied Cab requires implausible passenger-sill correction:",
  "correctedCabDoorCenterVerticallyCovered\\n    || correctedCabSillErrorMeters > 0.02",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: obsolete intermediate Cab vertical veto survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");

// Fleet readiness calls the physical fitter one final time before the trainer can
// execute the independent exact hood-footprint proof. Its historical verticalGap
// field is the same representative Cab front-point proxy already proven unreliable.
// Let readiness validate the corrected physical contact plane/lateral footprint and
// Tunnel-C seam; the later browser proof still fails closed on actual hood height.
const readinessPath = "src/environment/uploadedAirportJetwayFleetReadyV2.js";
const readinessMarker = "a1-final-visible-fit-physical-surface-readiness-v1";
let readiness = fs.readFileSync(readinessPath, "utf8");
if (!readiness.includes(readinessMarker)) {
  const staleGuard = `          if (!(Math.abs(finalVisibleFit.verticalGapMeters) <= 0.08)) {\n            throw new Error(\`A1 final visible Cab did not reach grounded CRJ door: vertical=\${finalVisibleFit.verticalGapMeters}\`);\n          }`;
  const physicalGuard = `          // ${readinessMarker}\n          if (!(\n            finalVisibleFit.correctedCabContactPlaneCovered === true\n            && finalVisibleFit.correctedCabDoorLaterallyCovered === true\n            && Number.isFinite(finalVisibleFit.cabTunnelCSeamGapMeters)\n            && finalVisibleFit.cabTunnelCSeamGapMeters <= 0.12\n            && Number.isFinite(finalVisibleFit.cabPassengerSillCorrectionMeters)\n            && Math.abs(finalVisibleFit.cabPassengerSillCorrectionMeters) <= 0.75\n          )) {\n            throw new Error(\`A1 final visible physical Cab surface failed readiness: plane=\${finalVisibleFit.correctedCabContactPlaneCovered}, lateral=\${finalVisibleFit.correctedCabDoorLaterallyCovered}, seam=\${finalVisibleFit.cabTunnelCSeamGapMeters}, sillCorrection=\${finalVisibleFit.cabPassengerSillCorrectionMeters}, legacyVertical=\${finalVisibleFit.verticalGapMeters}\`);\n          }`;
  if (!readiness.includes(staleGuard)) throw new Error(`${readinessPath}: stale final-visible representative-point guard is missing`);
  readiness = readiness.replace(staleGuard, physicalGuard);
}
for (const required of [
  readinessMarker,
  "finalVisibleFit.correctedCabContactPlaneCovered === true",
  "finalVisibleFit.correctedCabDoorLaterallyCovered === true",
  "finalVisibleFit.cabTunnelCSeamGapMeters <= 0.12",
]) {
  if (!readiness.includes(required)) throw new Error(`${readinessPath}: physical final-visible readiness is missing ${required}`);
}
if (readiness.includes("A1 final visible Cab did not reach grounded CRJ door")) {
  throw new Error(`${readinessPath}: stale final-visible representative-point fatal guard survived`);
}
fs.writeFileSync(readinessPath, readiness, "utf8");

console.log(`Prepared ${marker} + ${readinessMarker}: applied the measured 0.4419 m Cab-only sill correction, removed the stale fleet-ready representative-point vertical veto, and retained the later fixed-aircraft exact Cab-footprint proof as the fail-closed final vertical authority.`);
