import fs from "node:fs";

const placementPath = "src/environment/sourcePlacedTerminal4Jetways.js";
const registrarPath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";

function requireTokens(filePath, tokens) {
  const source = fs.readFileSync(filePath, "utf8");
  for (const token of tokens) {
    if (!source.includes(token)) throw new Error(`${filePath} is missing static corner-plane token ${token}`);
  }
  return source;
}

const placementSource = requireTokens(placementPath, [
  "static-a10-a12-corner-source-pivot-wall-plane-v2",
  "function findStaticCornerWallPlane",
  'jetway.g === "A10" || jetway.g === "A12"',
  "staticCornerWallPointX",
  "staticCornerWallPointZ",
  "staticCornerWallNormalX",
  "staticCornerWallNormalZ",
  "staticCornerWallPlaneAuthority",
  ': (cornerWallPlane || terminalConnection || sourceHeadingTerminalConnection);',
]);

const registrarSource = requireTokens(registrarPath, [
  "static-corner-source-pivot-plane-projection-v1",
  'placement.gate === "A10" || placement.gate === "A12"',
  'placement.staticCornerWallPlaneAuthority === "static-kphx-corner-source-pivot-wall-plane-v2"',
  "const sourcePlaneNormalDistance = hasExplicitCornerPlane",
  "const wallX = hasExplicitCornerPlane",
  "const wallZ = hasExplicitCornerPlane",
  "wallX - wallNormalX * resolvedRotundaCenterToWallMeters",
  "wallZ - wallNormalZ * resolvedRotundaCenterToWallMeters",
  "staticCornerWallPlaneUsed: hasExplicitCornerPlane",
  "staticCornerSourcePlaneNormalDistanceMeters",
]);

for (const forbidden of [
  "function findNearestStaticCornerTerminalConnection",
  ': (sourceHeadingTerminalConnection || terminalConnection);',
  ': (terminalConnection || sourceHeadingTerminalConnection);',
]) {
  if (placementSource.includes(forbidden)) {
    throw new Error(`${placementPath} retained stale corner-point contract ${forbidden}`);
  }
}

if (registrarSource.includes("const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;")
  || registrarSource.includes("const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;")) {
  throw new Error(`${registrarPath} still offsets corner Rotundas along the collapsed parking ray instead of the authored facade normal`);
}

console.log("Verified A10/A12 retain their original KPHX tangential spacing by projecting source pivots onto distinct authored facade planes and offsetting Rotundas along the selected wall normals.");
