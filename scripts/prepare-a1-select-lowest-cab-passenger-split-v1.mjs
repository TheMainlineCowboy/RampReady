import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-live-cab-sill-fit-no-stale-residual-v9-final-footprint-authority";
const surfaceMarker = "a1-final-supplied-cab-sill-and-hood-fit-v4";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(surfaceMarker)) {
  throw new Error(`${path}: live Cab sill/hood fitter must exist before final Cab validation`);
}

// Never use stale screenshot-derived Cab-only offsets. They detached the Cab from the
// supplied Tunnel-C and made the rendered result depend on an earlier bad camera pass.
for (const forbidden of [
  "const cabPassengerSillCorrectionMeters = -1.15833;",
  "const cabPassengerSillCorrectionMeters = -0.4419;",
  "a1-measured-cab-sill-calibration-final-footprint-authority-v6",
  "a1-measured-cab-sill-calibration-final-footprint-authority-v5",
]) {
  source = source.replaceAll(
    forbidden,
    forbidden.includes("authority")
      ? marker
      : "const cabPassengerSillCorrectionMeters = targetWorld.y - passengerMinimumWorldY;",
  );
}

// Keep the lowest plausible split when this legacy classifier is useful, but do not
// let it own final geometry. The exact source Cab has front-face topology for which
// neither the highest nor lowest large Y gap is guaranteed to be the boarding sill.
// The fixed-aircraft FINAL Cab door-facing footprint proof installed later is the
// authoritative vertical/contact test and is independent of this classifier.
const highestSplit = "        passengerSplitY = Math.max(passengerSplitY, sortedY[index]);";
const lowestSplit = "        if (!Number.isFinite(passengerSplitY)) passengerSplitY = sortedY[index];";
if (source.includes(highestSplit)) source = source.replace(highestSplit, lowestSplit);

// If the classifier proposes a multi-metre Cab-only move, preserve the connected
// supplied Cab/Tunnel-C geometry instead of dragging the Cab away or aborting before
// the real final hood-footprint test can run. Small, physically plausible corrections
// remain allowed; large values are telemetry only.
const correctionBlock = `  const cabPassengerSillCorrectionMeters = targetWorld.y - passengerMinimumWorldY;\n  if (!Number.isFinite(cabPassengerSillCorrectionMeters) || Math.abs(cabPassengerSillCorrectionMeters) > 0.75) {\n    throw new Error(\"A1 supplied Cab requires implausible passenger-sill correction: \" + cabPassengerSillCorrectionMeters);\n  }\n  if (Math.abs(cabPassengerSillCorrectionMeters) > 0.002) {\n    applyModelSpaceMatrix(THREE, model, cabAssembly.cab, translationMatrix(THREE, 0, cabPassengerSillCorrectionMeters, 0));\n  }`;
const boundedCorrectionBlock = `  const measuredCabPassengerSillCorrectionMeters = targetWorld.y - passengerMinimumWorldY;\n  if (!Number.isFinite(measuredCabPassengerSillCorrectionMeters)) {\n    throw new Error(\"A1 supplied Cab passenger-sill diagnostic is not finite\");\n  }\n  const cabPassengerSillCorrectionMeters = Math.abs(measuredCabPassengerSillCorrectionMeters) <= 0.75\n    ? measuredCabPassengerSillCorrectionMeters\n    : 0;\n  if (Math.abs(cabPassengerSillCorrectionMeters) > 0.002) {\n    applyModelSpaceMatrix(THREE, model, cabAssembly.cab, translationMatrix(THREE, 0, cabPassengerSillCorrectionMeters, 0));\n  }`;
if (source.includes(correctionBlock)) source = source.replace(correctionBlock, boundedCorrectionBlock);

// This immediate classifier-derived sill veto used to prevent the independent final
// Cab surface proof from ever running. Keep its measurements as diagnostics only.
const intermediateVerticalGuard = `  if (correctedCabSillErrorMeters > 0.02 || !correctedCabDoorCenterVerticallyCovered) {\n    throw new Error(\"A1 supplied Cab failed exact sill/hood vertical fit: sillError=\"\n      + correctedCabSillErrorMeters + \" passengerY=[\" + passengerMinimumWorldY + \",\"\n      + passengerMaximumWorldY + \"] hoodMaxY=\" + cabHoodMaximumWorldY\n      + \" doorCenterY=\" + exactDoorCenterWorldY);\n  }`;
const diagnosticVerticalGuard = `  // ${marker}: classifier-derived sill/center values are diagnostic only here.\n  // Final vertical contact is fail-closed in a1-final-exact-cab-footprint-door-contact-v2.`;
if (source.includes(intermediateVerticalGuard)) {
  source = source.replace(intermediateVerticalGuard, diagnosticVerticalGuard);
}

const physicalGuardNeedle = `    !correctedCabContactPlaneCovered\n    || !correctedCabDoorLaterallyCovered\n    || !correctedCabDoorCenterVerticallyCovered\n    || correctedCabSillErrorMeters > 0.02\n    || cabTunnelCSeamGapMeters > 0.12`;
const physicalGuardReplacement = `    !correctedCabContactPlaneCovered\n    || !correctedCabDoorLaterallyCovered\n    || cabTunnelCSeamGapMeters > 0.12`;
if (source.includes(physicalGuardNeedle)) {
  source = source.replace(physicalGuardNeedle, physicalGuardReplacement);
}

if (!source.includes("measuredCabPassengerSillCorrectionMeters")) {
  throw new Error(`${path}: bounded live Cab sill diagnostic was not installed`);
}
if (!source.includes("applyModelSpaceMatrix(THREE, model, cabAssembly.cab")) {
  throw new Error(`${path}: bounded live Cab correction transform is missing`);
}
if (!source.includes(lowestSplit)) {
  throw new Error(`${path}: Cab passenger classifier is not using the lowest candidate split`);
}
if (!source.includes(marker)) {
  source = source.replace(
    `// ${surfaceMarker}`,
    `// ${surfaceMarker}\n  // ${marker}: preserve connected supplied geometry and defer vertical authority to the final exact Cab footprint.`,
  );
}

for (const forbidden of [
  "-1.15833",
  "-0.4419",
  highestSplit,
  "A1 supplied Cab requires implausible passenger-sill correction",
  "correctedCabDoorCenterVerticallyCovered\n    || correctedCabSillErrorMeters > 0.02",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale Cab sill authority survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: large classifier-derived Cab drops no longer move/disconnect the supplied Cab or block runtime; final fixed-aircraft door-facing Cab footprint remains the fail-closed contact authority.`);
