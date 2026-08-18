import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-select-first-valid-cab-passenger-threshold-gap-v1";
const surfaceMarker = "a1-final-supplied-cab-sill-and-hood-fit-v4";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(surfaceMarker)) {
  throw new Error(`${path}: final Cab surface fitter must be installed before threshold-gap correction`);
}

if (!source.includes(marker)) {
  const oldLoop = `    let passengerSplitY = Number.NEGATIVE_INFINITY;\n    for (let index = 1; index < sortedY.length; index += 1) {\n      const gap = sortedY[index] - sortedY[index - 1];\n      const upperCount = sortedY.length - index;\n      const upperSpan = sortedY[sortedY.length - 1] - sortedY[index];\n      if (gap >= 0.25 && upperCount >= 3 && upperSpan >= 0.30) {\n        passengerSplitY = Math.max(passengerSplitY, sortedY[index]);\n      }\n    }`;
  const newLoop = `    // ${marker}\n    // sortedY rises from the low under-Cab mechanical cluster toward the passenger\n    // hood. The physical boarding threshold is the FIRST qualifying topology gap\n    // that leaves a substantial upper passenger surface. Choosing the highest gap\n    // instead can jump past the threshold and select the roof/upper hood as the\n    // "floor", producing the multi-metre high Cab seen in the failed evidence.\n    let passengerSplitY = Number.NEGATIVE_INFINITY;\n    for (let index = 1; index < sortedY.length; index += 1) {\n      const gap = sortedY[index] - sortedY[index - 1];\n      const upperCount = sortedY.length - index;\n      const upperSpan = sortedY[sortedY.length - 1] - sortedY[index];\n      if (gap >= 0.25 && upperCount >= 3 && upperSpan >= 0.30) {\n        passengerSplitY = sortedY[index];\n        break;\n      }\n    }`;
  if (!source.includes(oldLoop)) {
    throw new Error(`${path}: stale highest-gap Cab passenger split loop is missing`);
  }
  source = source.replace(oldLoop, newLoop);
}

for (const required of [
  marker,
  "passengerSplitY = sortedY[index];",
  "break;",
  "const upperSpan = sortedY[sortedY.length - 1] - sortedY[index];",
]) {
  if (!source.includes(required)) throw new Error(`${path}: first-threshold Cab split is missing ${required}`);
}
if (source.includes("passengerSplitY = Math.max(passengerSplitY, sortedY[index]);")) {
  throw new Error(`${path}: stale highest-gap Cab passenger split survived`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: final supplied Cab threshold now uses the first valid gap above low mechanical geometry instead of the highest hood/roof gap.`);
