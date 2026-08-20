import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-live-cab-sill-fit-no-stale-residual-v8-lowest-plausible-threshold";
const surfaceMarker = "a1-final-supplied-cab-sill-and-hood-fit-v4";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(surfaceMarker)) {
  throw new Error(`${path}: live Cab sill/hood fitter must exist before final Cab validation`);
}

// The previous stage hard-coded screenshot-derived Cab-only corrections. Those made
// later geometry depend on stale rendered residuals and could pull the Cab away from
// supplied Tunnel-C while the rest of the bridge remained fixed. Final A1 geometry
// must instead use the live exact-door/supplied-Cab surface measurement.
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

// The Cab surface classifier sorts aircraft-facing vertices bottom-to-top and looks
// for a vertical gap that separates low mechanical hardware from the passenger hood.
// It previously kept the HIGHEST qualifying gap. On the current exact head that picked
// an upper shell/roof break and reported the passenger sill ~4.05 m above the fixed CRJ
// door, which then tried to lower the Cab by four metres. The physically meaningful
// threshold is the FIRST/LOWEST qualifying split: the transition from under-Cab
// machinery to the passenger structure. Keep later roof/window gaps from replacing it.
const highestSplit = "        passengerSplitY = Math.max(passengerSplitY, sortedY[index]);";
const lowestSplit = "        if (!Number.isFinite(passengerSplitY)) passengerSplitY = sortedY[index];";
if (source.includes(highestSplit)) {
  source = source.replace(highestSplit, lowestSplit);
}

if (!source.includes("const cabPassengerSillCorrectionMeters = targetWorld.y - passengerMinimumWorldY;")) {
  throw new Error(`${path}: final Cab fit is not using the live rendered sill measurement`);
}
if (!source.includes("applyModelSpaceMatrix(THREE, model, cabAssembly.cab")) {
  throw new Error(`${path}: live Cab correction transform is missing`);
}
if (!source.includes(lowestSplit)) {
  throw new Error(`${path}: Cab passenger classifier is not using the lowest plausible threshold split`);
}
if (!source.includes(marker)) {
  source = source.replace(
    `// ${surfaceMarker}`,
    `// ${surfaceMarker}\n  // ${marker}: use the lowest plausible passenger threshold and no screenshot-derived Cab residual.`,
  );
}

for (const forbidden of ["-1.15833", "-0.4419", highestSplit]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale Cab threshold/residual survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: Cab surface classification now keeps the lowest plausible mechanical-to-passenger split, preventing roof/window gaps from generating multi-metre Cab drops; no stale screenshot-derived correction is applied.`);
