import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-use-nearest-door-contact-vertices-as-sill-v4";
const surfaceMarker = "a1-final-supplied-cab-sill-and-hood-fit-v4";

let source = fs.readFileSync(path, "utf8");
if (!source.includes(surfaceMarker)) {
  throw new Error(`${path}: final Cab surface fitter must be installed before nearest-door sill correction`);
}

if (!source.includes(marker)) {
  // The Cab is rounded and yawed independently of Tunnel-C, so a maximum-projection
  // face can select the wrong upper shell. Horizontal proximity to the immovable
  // exact authored door is the direct physical signal: find the supplied Cab
  // vertices nearest the door in X/Z, keep a narrow surrounding contact band, and
  // derive the boarding sill from the lower edge of that actual contact cluster.
  // The Y floor removes only under-Cab machinery below the authored door threshold;
  // it remains valid after the Cab is translated because the corrected sill itself
  // lies inside the same bounded window.
  const oldBands = `    const frontBand = worldVertices.filter((point) => (\n      maximumProjection - point.clone().sub(center).dot(doorward)\n    ) <= 0.25);\n    const hoodBand = worldVertices.filter((point) => (\n      maximumProjection - point.clone().sub(center).dot(doorward)\n    ) <= 1.00);`;
  const newBands = `    // ${marker}\n    let nearestDoorHorizontalMeters = Number.POSITIVE_INFINITY;\n    for (const point of worldVertices) {\n      nearestDoorHorizontalMeters = Math.min(\n        nearestDoorHorizontalMeters,\n        Math.hypot(point.x - targetWorld.x, point.z - targetWorld.z),\n      );\n    }\n    if (!Number.isFinite(nearestDoorHorizontalMeters)) {\n      throw new Error(\"A1 supplied Cab has no finite door-contact distance\");\n    }\n    const frontBand = worldVertices.filter((point) => (\n      Math.hypot(point.x - targetWorld.x, point.z - targetWorld.z)\n        <= nearestDoorHorizontalMeters + 0.22\n      && point.y >= targetWorld.y - 0.10\n    ));\n    const hoodBand = worldVertices.filter((point) => (\n      Math.hypot(point.x - targetWorld.x, point.z - targetWorld.z)\n        <= nearestDoorHorizontalMeters + 1.00\n      && point.y >= targetWorld.y - 0.10\n    ));`;
  if (!source.includes(oldBands)) throw new Error(`${path}: original Cab face-band block is missing`);
  source = source.replace(oldBands, newBands);

  const topologyBlock = `    const sortedY = frontBand.map((point) => point.y).sort((a, b) => a - b);\n    let passengerSplitY = Number.NEGATIVE_INFINITY;\n    for (let index = 1; index < sortedY.length; index += 1) {\n      const gap = sortedY[index] - sortedY[index - 1];\n      const upperCount = sortedY.length - index;\n      const upperSpan = sortedY[sortedY.length - 1] - sortedY[index];\n      if (gap >= 0.25 && upperCount >= 3 && upperSpan >= 0.30) {\n        passengerSplitY = Math.max(passengerSplitY, sortedY[index]);\n      }\n    }\n    if (!Number.isFinite(passengerSplitY)) {\n      throw new Error(\"A1 supplied Cab passenger hood cannot be separated from low mechanical geometry\");\n    }\n    const passenger = frontBand.filter((point) => point.y >= passengerSplitY - 0.001);\n    if (passenger.length < 3) throw new Error(\"A1 supplied Cab passenger surface is degenerate\");`;
  const contactBlock = `    const passenger = frontBand;\n    if (passenger.length < 3) {\n      throw new Error(\"A1 supplied Cab nearest-door passenger contact cluster is degenerate\");\n    }\n    const passengerSplitY = Math.min(...passenger.map((point) => point.y));`;
  if (!source.includes(topologyBlock)) throw new Error(`${path}: stale topology-gap Cab block is missing`);
  source = source.replace(topologyBlock, contactBlock);
}

for (const required of [
  marker,
  "nearestDoorHorizontalMeters + 0.22",
  "point.y >= targetWorld.y - 0.10",
  "const passenger = frontBand;",
  "const passengerSplitY = Math.min(...passenger.map((point) => point.y));",
]) {
  if (!source.includes(required)) throw new Error(`${path}: nearest-door Cab sill selection is missing ${required}`);
}
for (const forbidden of [
  "passengerSplitY = Math.max(passengerSplitY, sortedY[index]);",
  "A1 supplied Cab passenger hood cannot be separated from low mechanical geometry",
  "const sortedY = frontBand.map((point) => point.y)",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale topology-gap sill heuristic survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: final supplied Cab boarding sill now comes from the lower edge of the exact Cab vertices nearest the fixed authored CRJ door in horizontal space; topology-gap guessing is removed.`);
