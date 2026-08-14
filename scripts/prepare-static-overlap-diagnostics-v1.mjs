import fs from "node:fs";

const runtimePath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const marker = "static-a12-a14-final-overlap-anchor-diagnostic-v1";
let source = fs.readFileSync(runtimePath, "utf8");

if (!source.includes(marker)) {
  const oldBlock = `  if (staticExactPartOverlaps.length) {\n    throw new Error(\`Static Terminal 4 exact supplied part envelopes overlap after final registration/telescoping: \${staticExactPartOverlaps.join(", ")}\`);\n  }`;
  const newBlock = `  if (staticExactPartOverlaps.length) {\n    // ${marker}\n    const staticOverlapAnchorDiagnostics = ["A12", "A14"].map((gate) => {\n      const registered = staticRegisteredPlacements.find((placement) => placement.gate === gate) || {};\n      const original = staticOriginalPlacements.find((placement) => placement.gate === gate) || {};\n      return {\n        gate,\n        source: { x: Number(original.x), z: Number(original.z), yaw: Number(original.yaw) },\n        rotunda: { x: Number(registered.x), z: Number(registered.z) },\n        wall: { x: Number(registered.staticFacadeWallX), z: Number(registered.staticFacadeWallZ) },\n        target: { x: Number(registered.targetX), z: Number(registered.targetZ) },\n        modelRoot: { x: Number(registered.staticModelRootX), z: Number(registered.staticModelRootZ) },\n        cornerPlaneUsed: registered.staticCornerWallPlaneUsed === true,\n        cornerPlaneAuthority: registered.staticCornerWallPlaneAuthority || null,\n        cornerWallMaterialName: registered.staticCornerWallMaterialName || null,\n        cornerWallNormal: {\n          x: Number(registered.staticCornerWallNormalX),\n          z: Number(registered.staticCornerWallNormalZ),\n        },\n        sourcePlaneNormalDistanceMeters: Number(registered.staticCornerSourcePlaneNormalDistanceMeters),\n        wallConnectorLength: Number(registered.wallConnectorLength),\n        aircraftDoorDistance: Number(registered.aircraftDoorDistance),\n        finalContactDistance: Number(registered.staticPostRegistrationPredictedContactDistanceMeters),\n        yaw: Number(registered.yaw),\n      };\n    });\n    throw new Error(\`Static Terminal 4 exact supplied part envelopes overlap after final registration/telescoping: \${staticExactPartOverlaps.join(", ")}; ${marker}=\${JSON.stringify(staticOverlapAnchorDiagnostics)}\`);\n  }`;
  if (!source.includes(oldBlock)) {
    throw new Error(`${runtimePath}: exact static overlap failure block is missing before A12/A14 diagnostics`);
  }
  source = source.replace(oldBlock, newBlock);
}

for (const required of [
  marker,
  "staticOverlapAnchorDiagnostics",
  'staticRegisteredPlacements.find((placement) => placement.gate === gate)',
  "staticCornerWallNormalX",
  "staticPostRegistrationPredictedContactDistanceMeters",
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: static overlap diagnostics are missing ${required}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Armed exact A12/A14 static overlap diagnostics with source pivot, final Rotunda, facade wall, wall normal, target, telescope reach and model-root coordinates; geometry is unchanged.");
