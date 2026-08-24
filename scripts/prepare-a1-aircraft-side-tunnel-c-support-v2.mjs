import fs from "node:fs";

const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-aircraft-side-tunnel-c-support-filter-v2";
const minimumAircraftSideRatio = 0.55;
let source = fs.readFileSync(doorFitPath, "utf8");

if (!source.includes(marker)) {
  const oldBlock = `  const minimumY = Math.min(...candidates.map(({ box }) => box.min.y));\n  const support = candidates.filter(({ box, size }) => {\n    const horizontalSpan = Math.hypot(size.x, size.z);\n    const maximumHorizontalDimension = Math.max(size.x, size.z);\n    return box.min.y <= minimumY + 0.80\n      && horizontalSpan >= 0.35\n      && maximumHorizontalDimension <= 6.5\n      && size.y <= 5.5;\n  });`;
  const newBlock = `  // ${marker}\n  // Tunnel_C contains several low meshes. Grounding every low descendant can\n  // accidentally select terminal-side/mid-span hardware and drag the apparent\n  // support contact toward the Rotunda. The attached-state references require\n  // the bogie/service-stair/support mass to remain on the aircraft-side portion\n  // of Tunnel_C, outboard of the fuselage. Resolve support candidates by their\n  // measured position along the actual Rotunda-to-Cab axis before grounding.\n  const rotunda = findSourcePartRoot(model, "Rotunda");\n  const cab = findSourcePartRoot(model, "Cab");\n  if (!rotunda || !cab) throw new Error("Supplied A1 Tunnel_C support filter cannot measure Rotunda/Cab axis");\n  const rotundaCenter = measureBounds(THREE, model, rotunda).box.getCenter(new THREE.Vector3());\n  const cabCenter = measureBounds(THREE, model, cab).box.getCenter(new THREE.Vector3());\n  const bridgeVector = cabCenter.clone().sub(rotundaCenter).setY(0);\n  const bridgeLengthSquared = bridgeVector.lengthSq();\n  if (!(bridgeLengthSquared > 1)) throw new Error("Supplied A1 Rotunda-to-Cab axis is too short for Tunnel_C support filtering");\n  const aircraftSideCandidates = candidates.map(({ entry, box, size }) => {\n    const center = box.getCenter(new THREE.Vector3());\n    const alongRatio = center.clone().sub(rotundaCenter).setY(0).dot(bridgeVector) / bridgeLengthSquared;\n    entry.userData.uploadedJetwayTunnelCSupportAlongRatio = alongRatio;\n    return { entry, box, size, alongRatio };\n  }).filter(({ alongRatio }) => alongRatio >= ${minimumAircraftSideRatio} && alongRatio <= 1.15);\n  if (!aircraftSideCandidates.length) {\n    const diagnostic = candidates.map(({ entry, box, size }) => ({\n      name: entry.name || "unnamed",\n      minY: Number(box.min.y.toFixed(3)),\n      size: size.toArray().map((value) => Number(value.toFixed(3))),\n      alongRatio: Number((entry.userData.uploadedJetwayTunnelCSupportAlongRatio ?? NaN).toFixed?.(3) ?? NaN),\n    }));\n    throw new Error(\`Supplied A1 Tunnel_C has no aircraft-side support candidate at ratio >= ${minimumAircraftSideRatio}: \${JSON.stringify(diagnostic)}\`);\n  }\n  const minimumAircraftSideY = Math.min(...aircraftSideCandidates.map(({ box }) => box.min.y));\n  const support = aircraftSideCandidates.filter(({ box, size }) => {\n    const horizontalSpan = Math.hypot(size.x, size.z);\n    const maximumHorizontalDimension = Math.max(size.x, size.z);\n    return box.min.y <= minimumAircraftSideY + 0.80\n      && horizontalSpan >= 0.35\n      && maximumHorizontalDimension <= 6.5\n      && size.y <= 5.5;\n  });`;
  if (!source.includes(oldBlock)) {
    throw new Error(`${doorFitPath}: generated Tunnel_C support resolver block is missing`);
  }
  source = source.replace(oldBlock, newBlock);
}

for (const required of [
  marker,
  "uploadedJetwayTunnelCSupportAlongRatio",
  `alongRatio >= ${minimumAircraftSideRatio}`,
  "minimumAircraftSideY",
]) {
  if (!source.includes(required)) throw new Error(`${doorFitPath}: aircraft-side Tunnel_C support filter is missing ${required}`);
}

fs.writeFileSync(doorFitPath, source, "utf8");
console.log(`Restricted A1 Tunnel_C grounding to measured aircraft-side support descendants (Rotunda-to-Cab ratio >= ${minimumAircraftSideRatio}) so terminal-side/mid-span low geometry cannot masquerade as the bogie contact.`);
