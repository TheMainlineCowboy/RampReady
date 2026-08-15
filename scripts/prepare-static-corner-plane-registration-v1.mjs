import fs from "node:fs";

const runtimePath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const marker = "static-corner-source-pivot-plane-projection-v1";
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(marker)) {
  const directionAnchor = `  const ux = towardX / magnitude;\n  const uz = towardZ / magnitude;`;
  if (!source.includes(directionAnchor)) throw new Error(`${runtimePath}: static terminal direction anchor is missing`);
  source = source.replace(
    directionAnchor,
    `${directionAnchor}\n\n  // ${marker}\n  const explicitPlanePointX = Number(placement.staticCornerWallPointX);\n  const explicitPlanePointZ = Number(placement.staticCornerWallPointZ);\n  const explicitPlaneNormalX = Number(placement.staticCornerWallNormalX);\n  const explicitPlaneNormalZ = Number(placement.staticCornerWallNormalZ);\n  const explicitPlaneNormalMagnitude = Math.hypot(explicitPlaneNormalX, explicitPlaneNormalZ);\n  const hasExplicitCornerPlane = (placement.gate === "A10" || placement.gate === "A12")\n    && placement.staticCornerWallPlaneAuthority === "static-kphx-corner-source-pivot-wall-plane-v2"\n    && [explicitPlanePointX, explicitPlanePointZ, explicitPlaneNormalX, explicitPlaneNormalZ].every(Number.isFinite)\n    && explicitPlaneNormalMagnitude > 0.95 && explicitPlaneNormalMagnitude < 1.05;\n  const wallNormalX = hasExplicitCornerPlane ? explicitPlaneNormalX / explicitPlaneNormalMagnitude : ux;\n  const wallNormalZ = hasExplicitCornerPlane ? explicitPlaneNormalZ / explicitPlaneNormalMagnitude : uz;`,
  );

  const wallAnchor = `  const wallX = sourceX + ux * sourceWallDistance;\n  const wallZ = sourceZ + uz * sourceWallDistance;`;
  if (!source.includes(wallAnchor)) throw new Error(`${runtimePath}: static wall point reconstruction anchor is missing`);
  source = source.replace(
    wallAnchor,
    `  // A10/A12: project the ORIGINAL KPHX source pivot onto the selected real\n  // facade plane. This preserves tangential separation along the concourse\n  // instead of using two ray intersections that collapse onto one corner.\n  const sourceToPlanePointX = explicitPlanePointX - sourceX;\n  const sourceToPlanePointZ = explicitPlanePointZ - sourceZ;\n  const sourcePlaneNormalDistance = hasExplicitCornerPlane\n    ? sourceToPlanePointX * wallNormalX + sourceToPlanePointZ * wallNormalZ\n    : sourceWallDistance;\n  if (hasExplicitCornerPlane && !(sourcePlaneNormalDistance > 0.05 && sourcePlaneNormalDistance < 48)) {\n    throw new Error(\`Static corner jetway \${placement.gate} source pivot does not project onto its authored terminal face: \${sourcePlaneNormalDistance} m\`);\n  }\n  const wallX = hasExplicitCornerPlane\n    ? sourceX + wallNormalX * sourcePlaneNormalDistance\n    : sourceX + ux * sourceWallDistance;\n  const wallZ = hasExplicitCornerPlane\n    ? sourceZ + wallNormalZ * sourcePlaneNormalDistance\n    : sourceZ + uz * sourceWallDistance;`,
  );

  const rotundaAnchor = `  const rotundaX = wallX - ux * resolvedRotundaCenterToWallMeters;\n  const rotundaZ = wallZ - uz * resolvedRotundaCenterToWallMeters;`;
  if (!source.includes(rotundaAnchor)) throw new Error(`${runtimePath}: static Rotunda wall-offset anchor is missing`);
  source = source.replace(
    rotundaAnchor,
    `  const rotundaX = wallX - wallNormalX * resolvedRotundaCenterToWallMeters;\n  const rotundaZ = wallZ - wallNormalZ * resolvedRotundaCenterToWallMeters;`,
  );

  const returnAnchor = `    staticFacadeWallX: wallX,\n    staticFacadeWallZ: wallZ,`;
  if (!source.includes(returnAnchor)) throw new Error(`${runtimePath}: static facade wall telemetry anchor is missing`);
  source = source.replace(
    returnAnchor,
    `${returnAnchor}\n    staticCornerWallPlaneUsed: hasExplicitCornerPlane,\n    staticCornerWallPlaneAuthority: hasExplicitCornerPlane ? placement.staticCornerWallPlaneAuthority : null,\n    staticCornerWallMaterialName: hasExplicitCornerPlane ? placement.staticCornerWallMaterialName : null,\n    staticCornerWallNormalX: wallNormalX,\n    staticCornerWallNormalZ: wallNormalZ,\n    staticCornerSourcePlaneNormalDistanceMeters: hasExplicitCornerPlane ? sourcePlaneNormalDistance : null,`,
  );
}

for (const required of [
  marker,
  "hasExplicitCornerPlane",
  "sourcePlaneNormalDistance",
  "staticCornerWallPlaneUsed",
  "staticCornerSourcePlaneNormalDistanceMeters",
  "wallX - wallNormalX * resolvedRotundaCenterToWallMeters",
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: static corner plane projection is missing ${required}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Projected A10/A12 original KPHX source pivots onto their authored terminal face planes, preserving tangential source spacing while correcting only terminal-normal distance.");
