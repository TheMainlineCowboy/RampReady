import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-select-plausible-cab-passenger-threshold-gap-v2";
const surfaceMarker = "a1-final-supplied-cab-sill-and-hood-fit-v4";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(surfaceMarker)) {
  throw new Error(`${path}: final Cab surface fitter must be installed before threshold-gap correction`);
}

if (!source.includes(marker)) {
  const oldLoop = `    let passengerSplitY = Number.NEGATIVE_INFINITY;\n    for (let index = 1; index < sortedY.length; index += 1) {\n      const gap = sortedY[index] - sortedY[index - 1];\n      const upperCount = sortedY.length - index;\n      const upperSpan = sortedY[sortedY.length - 1] - sortedY[index];\n      if (gap >= 0.25 && upperCount >= 3 && upperSpan >= 0.30) {\n        passengerSplitY = Math.max(passengerSplitY, sortedY[index]);\n      }\n    }`;
  const newLoop = `    // ${marker}\n    // Resolve the boarding threshold from topology, but constrain the candidate to\n    // the exact authored CRJ sill neighborhood. A roof/upper-hood gap can also be a\n    // large topology break; accepting it produced the 2.646 m downward correction\n    // seen in browser evidence. The uncorrected supplied passenger threshold may sit\n    // slightly below the sill or up to 0.75 m above it, but anything outside that\n    // band is not a plausible boarding-floor candidate. Among qualifying gaps, use\n    // the candidate requiring the smallest physical Cab vertical articulation.\n    let passengerSplitY = Number.NEGATIVE_INFINITY;\n    let passengerSplitError = Number.POSITIVE_INFINITY;\n    for (let index = 1; index < sortedY.length; index += 1) {\n      const gap = sortedY[index] - sortedY[index - 1];\n      const upperCount = sortedY.length - index;\n      const upperSpan = sortedY[sortedY.length - 1] - sortedY[index];\n      const candidateY = sortedY[index];\n      const candidateDelta = candidateY - targetWorld.y;\n      const candidateError = Math.abs(candidateDelta);\n      const plausibleSillBand = candidateDelta >= -0.10 && candidateDelta <= 0.75;\n      if (\n        gap >= 0.25\n        && upperCount >= 3\n        && upperSpan >= 0.30\n        && plausibleSillBand\n        && candidateError < passengerSplitError\n      ) {\n        passengerSplitY = candidateY;\n        passengerSplitError = candidateError;\n      }\n    }`;
  if (!source.includes(oldLoop)) {
    throw new Error(`${path}: stale highest-gap Cab passenger split loop is missing`);
  }
  source = source.replace(oldLoop, newLoop);
}

for (const required of [
  marker,
  "const candidateDelta = candidateY - targetWorld.y;",
  "candidateDelta >= -0.10 && candidateDelta <= 0.75",
  "candidateError < passengerSplitError",
  "passengerSplitY = candidateY;",
]) {
  if (!source.includes(required)) throw new Error(`${path}: plausible-threshold Cab split is missing ${required}`);
}
if (source.includes("passengerSplitY = Math.max(passengerSplitY, sortedY[index]);")) {
  throw new Error(`${path}: stale highest-gap Cab passenger split survived`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: final supplied Cab threshold now selects the qualifying topology gap nearest the exact authored CRJ sill within the bounded physical articulation range.`);
