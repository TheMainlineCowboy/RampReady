import fs from "node:fs";

const runtimePath = "src/environment/registerStaticJetwayFleetToFacadeV1.js";
const marker = "static-a14-connector-inclusive-articulation-sweep-v1";
let source = fs.readFileSync(runtimePath, "utf8");

for (const required of [
  "static-generated-terminal-connector-inclusive-overlap-guard-v1",
  "const staticConnectorInclusiveOverlaps = [];",
  "const a14CornerArmIndex = staticRegisteredPlacements.findIndex",
  "const a14PivotX = Number(a14CornerPlacement.staticModelRootX);",
  "const a14PivotZ = Number(a14CornerPlacement.staticModelRootZ);",
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: A14 connector-inclusive sweep requires ${required}`);
}

if (!source.includes(marker)) {
  const throwBlock = `  if (staticConnectorInclusiveOverlaps.length) {\n    throw new Error(\`Static Terminal 4 generated terminal connector envelopes overlap neighboring jetway geometry: \${staticConnectorInclusiveOverlaps.join(", ")}\`);\n  }`;
  if (!source.includes(throwBlock)) throw new Error(`${runtimePath}: connector-inclusive failure block is missing`);

  const diagnostic = `  // ${marker}\n  if (staticConnectorInclusiveOverlaps.length) {\n    const a14CurrentTotalDegrees = Number(a14CornerPlacement.staticCornerArmArticulationDegrees);\n    if (!Number.isFinite(a14CurrentTotalDegrees)) throw new Error("A14 connector-inclusive sweep lost current articulation");\n    const originalA14Matrices = staticBatches.map((batch) => {\n      const matrix = new THREE.Matrix4();\n      batch.getMatrixAt(a14CornerArmIndex, matrix);\n      return matrix.clone();\n    });\n    const sweepResults = [];\n    const candidateDegrees = [];\n    for (let degrees = -7.5; degrees >= -20.0001; degrees -= 0.5) candidateDegrees.push(Number(degrees.toFixed(2)));\n    for (const totalDegrees of candidateDegrees) {\n      const deltaRadians = (totalDegrees - a14CurrentTotalDegrees) * Math.PI / 180;\n      const toOrigin = new THREE.Matrix4().makeTranslation(-a14PivotX, 0, -a14PivotZ);\n      const rotation = new THREE.Matrix4().makeRotationY(deltaRadians);\n      const fromOrigin = new THREE.Matrix4().makeTranslation(a14PivotX, 0, a14PivotZ);\n      const delta = new THREE.Matrix4().multiplyMatrices(fromOrigin, rotation).multiply(toOrigin);\n      const next = new THREE.Matrix4();\n      staticBatches.forEach((batch, batchIndex) => {\n        if (batch.userData?.sourcePartName === "Rotunda") {\n          batch.setMatrixAt(a14CornerArmIndex, originalA14Matrices[batchIndex]);\n        } else {\n          next.multiplyMatrices(delta, originalA14Matrices[batchIndex]);\n          batch.setMatrixAt(a14CornerArmIndex, next);\n        }\n        batch.instanceMatrix.needsUpdate = true;\n      });\n      const candidateA14Parts = staticBatches.map((batch) => ({\n        part: batch.userData?.sourcePartName || "unknown",\n        ...staticExactInstanceEnvelope(THREE, batch, a14CornerArmIndex),\n      }));\n      const candidateOverlaps = [];\n      let maximumDepth = 0;\n      const record = (leftGate, leftPart, rightGate, rightPart) => {\n        const depth = staticConnectorEnvelopeOverlapDepthXZ(leftPart, rightPart, 0.01);\n        if (depth <= 0.01) return;\n        maximumDepth = Math.max(maximumDepth, depth);\n        candidateOverlaps.push(\`\${leftGate}/\${leftPart.part}<->\${rightGate}/\${rightPart.part}=\${depth.toFixed(3)}m\`);\n      };\n      for (let gateIndex = 0; gateIndex < staticRegisteredPlacements.length; gateIndex += 1) {\n        if (gateIndex === a14CornerArmIndex) continue;\n        const otherBody = finalExactEnvelopes[gateIndex];\n        const otherConnector = staticConnectorEnvelopes[gateIndex];\n        for (const a14Part of candidateA14Parts) {\n          for (const otherPart of otherBody.parts) record("A14", a14Part, otherBody.gate, otherPart);\n          for (const otherPart of otherConnector.parts) record("A14", a14Part, otherConnector.gate, otherPart);\n        }\n        const a14Connector = staticConnectorEnvelopes[a14CornerArmIndex];\n        for (const a14ConnectorPart of a14Connector.parts) {\n          for (const otherPart of otherBody.parts) record("A14", a14ConnectorPart, otherBody.gate, otherPart);\n          for (const otherPart of otherConnector.parts) record("A14", a14ConnectorPart, otherConnector.gate, otherPart);\n        }\n      }\n      sweepResults.push({\n        degrees: totalDegrees,\n        overlapCount: candidateOverlaps.length,\n        maximumDepthMeters: Number(maximumDepth.toFixed(3)),\n        firstOverlaps: candidateOverlaps.slice(0, 12),\n      });\n    }\n    staticBatches.forEach((batch, batchIndex) => {\n      batch.setMatrixAt(a14CornerArmIndex, originalA14Matrices[batchIndex]);\n      batch.instanceMatrix.needsUpdate = true;\n      batch.computeBoundingBox();\n      batch.computeBoundingSphere();\n    });\n    const collisionFree = sweepResults.filter((entry) => entry.overlapCount === 0);\n    throw new Error(\`A14 connector-inclusive articulation sweep: currentOverlaps=\${staticConnectorInclusiveOverlaps.join(", ")}; results=\${JSON.stringify(sweepResults)}; collisionFree=\${JSON.stringify(collisionFree)}\`);\n  }`;
  source = source.replace(throwBlock, diagnostic);
}

for (const required of [
  marker,
  "A14 connector-inclusive articulation sweep:",
  "candidateDegrees",
  "collisionFree",
  "originalA14Matrices",
]) {
  if (!source.includes(required)) throw new Error(`${runtimePath}: A14 connector-inclusive sweep is missing ${required}`);
}

fs.writeFileSync(runtimePath, source, "utf8");
console.log("Armed geometry-neutral A14 connector-inclusive articulation sweep from -7.50 through -20.00 degrees; every trial is checked against all neighboring supplied parts and terminal sleeves, then the original matrices are restored before failure.");
