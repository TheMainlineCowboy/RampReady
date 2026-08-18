import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-use-final-cab-contact-face-lower-edge-as-sill-v3";
const surfaceMarker = "a1-final-supplied-cab-sill-and-hood-fit-v4";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(surfaceMarker)) {
  throw new Error(`${path}: final Cab surface fitter must be installed before contact-face sill correction`);
}

if (!source.includes(marker)) {
  // Earlier surface evidence already established that the actual aircraft-facing
  // supplied Cab contact face begins about 0.44 m above the authored CRJ sill.
  // The later topology-gap heuristic was the mistake: the Cab mesh has no reliable
  // vertical segmentation gap at its boarding floor, so that heuristic could pick
  // roof geometry or report that no passenger surface existed. Use the physical
  // extreme contact face itself. A tight 0.20 m depth band excludes recessed
  // under-Cab machinery while retaining the curved passenger hood contact edge.
  const broadFrontBand = `    const frontBand = worldVertices.filter((point) => (\n      maximumProjection - point.clone().sub(center).dot(doorward)\n    ) <= 0.25);`;
  const tightFrontBand = `    // ${marker}\n    const frontBand = worldVertices.filter((point) => (\n      maximumProjection - point.clone().sub(center).dot(doorward)\n    ) <= 0.20);`;
  if (!source.includes(broadFrontBand)) {
    throw new Error(`${path}: broad Cab contact-face band is missing`);
  }
  source = source.replace(broadFrontBand, tightFrontBand);

  const topologyBlock = `    const sortedY = frontBand.map((point) => point.y).sort((a, b) => a - b);\n    let passengerSplitY = Number.NEGATIVE_INFINITY;\n    for (let index = 1; index < sortedY.length; index += 1) {\n      const gap = sortedY[index] - sortedY[index - 1];\n      const upperCount = sortedY.length - index;\n      const upperSpan = sortedY[sortedY.length - 1] - sortedY[index];\n      if (gap >= 0.25 && upperCount >= 3 && upperSpan >= 0.30) {\n        passengerSplitY = Math.max(passengerSplitY, sortedY[index]);\n      }\n    }\n    if (!Number.isFinite(passengerSplitY)) {\n      throw new Error(\"A1 supplied Cab passenger hood cannot be separated from low mechanical geometry\");\n    }\n    const passenger = frontBand.filter((point) => point.y >= passengerSplitY - 0.001);\n    if (passenger.length < 3) throw new Error(\"A1 supplied Cab passenger surface is degenerate\");`;
  const contactFaceBlock = `    // The passenger sill is the lower edge of the real aircraft-facing contact face.\n    // Do not infer a boarding floor from arbitrary vertical topology gaps.\n    const passenger = frontBand;\n    if (passenger.length < 3) throw new Error(\"A1 supplied Cab passenger contact face is degenerate\");\n    const passengerSplitY = Math.min(...passenger.map((point) => point.y));`;
  if (!source.includes(topologyBlock)) {
    throw new Error(`${path}: stale topology-gap Cab passenger split block is missing`);
  }
  source = source.replace(topologyBlock, contactFaceBlock);
}

for (const required of [
  marker,
  ") <= 0.20);",
  "const passenger = frontBand;",
  "const passengerSplitY = Math.min(...passenger.map((point) => point.y));",
]) {
  if (!source.includes(required)) throw new Error(`${path}: physical contact-face sill selection is missing ${required}`);
}
for (const forbidden of [
  "passengerSplitY = Math.max(passengerSplitY, sortedY[index]);",
  "A1 supplied Cab passenger hood cannot be separated from low mechanical geometry",
  "const sortedY = frontBand.map((point) => point.y)",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale topology-gap sill heuristic survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: final supplied Cab boarding sill now comes directly from the lower edge of its tight aircraft-facing physical contact surface; topology-gap guessing is removed.`);
