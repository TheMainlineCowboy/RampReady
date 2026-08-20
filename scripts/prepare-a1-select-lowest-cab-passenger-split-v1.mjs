import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-live-cab-sill-fit-no-stale-residual-v7";
const surfaceMarker = "a1-final-supplied-cab-sill-and-hood-fit-v4";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(surfaceMarker)) {
  throw new Error(`${path}: live Cab sill/hood fitter must exist before final Cab validation`);
}

// The previous stage hard-coded a -1.15833 m Cab-only correction from one old
// screenshot. That made later geometry depend on a stale rendered residual and
// could pull the Cab away from the supplied Tunnel-C while the rest of the bridge
// remained fixed. The photo-authoritative final path must instead use the live
// exact-door/supplied-Cab surface measurement installed immediately before this
// script. Do not add another geometry transform here.
for (const forbidden of [
  "const cabPassengerSillCorrectionMeters = -1.15833;",
  "const cabPassengerSillCorrectionMeters = -0.4419;",
  "a1-measured-cab-sill-calibration-final-footprint-authority-v6",
  "a1-measured-cab-sill-calibration-final-footprint-authority-v5",
]) {
  source = source.replaceAll(forbidden, forbidden.includes("authority") ? marker : "const cabPassengerSillCorrectionMeters = targetWorld.y - passengerMinimumWorldY;");
}

if (!source.includes("const cabPassengerSillCorrectionMeters = targetWorld.y - passengerMinimumWorldY;")) {
  throw new Error(`${path}: final Cab fit is not using the live rendered sill measurement`);
}
if (!source.includes("applyModelSpaceMatrix(THREE, model, cabAssembly.cab")) {
  throw new Error(`${path}: live Cab correction transform is missing`);
}
if (!source.includes(marker)) {
  source = source.replace(
    `// ${surfaceMarker}`,
    `// ${surfaceMarker}\n  // ${marker}: no screenshot-derived Cab residual is applied after the live exact-door fit.`,
  );
}

for (const forbidden of ["-1.15833", "-0.4419"]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale Cab residual survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: removed stale screenshot-derived Cab offsets; final Cab Y is solved only from the live exact supplied surface against the fixed CRJ door.`);
