import fs from "node:fs";

const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-preserve-integrated-tunnel-c-carrier-v1";
const pitchMarker = "a1-rendered-door-measured-pitch-envelope-v1";
const runtimeSupportMarker = "a1-runtime-tunnel-c-separable-support-meshes-v1";
const finalVisibleMarker = "a1-final-visible-grounded-door-and-integrated-tunnel-c-v1";

let source = fs.readFileSync(doorFitPath, "utf8");

if (!source.includes(runtimeSupportMarker)) {
  throw new Error(`${doorFitPath}: Tunnel-C runtime support resolver must be installed before carrier preservation`);
}
if (!source.includes(finalVisibleMarker)) {
  throw new Error(`${doorFitPath}: final visible geometry normalization must run before carrier preservation`);
}

if (!source.includes(marker)) {
  const oldBlock = `function correctGroundedDetail(THREE, model, object) {\n  if (!object) throw new Error("Supplied A1 Tunnel-C grounding received no support mesh");\n\n  // a1-world-ramp-grounded-tunnel-c-detail-v1\n  model.updateWorldMatrix(true, true);\n  const beforeWorld = new THREE.Box3().setFromObject(object);\n  const targetWorldMinimumY = 0;\n  const rigidVerticalAdjustmentMeters = targetWorldMinimumY - beforeWorld.min.y;\n  if (Math.abs(rigidVerticalAdjustmentMeters) > 0.001) {\n    const worldOrigin = model.localToWorld(new THREE.Vector3(0, 0, 0));\n    const shiftedWorld = worldOrigin.clone().add(new THREE.Vector3(0, rigidVerticalAdjustmentMeters, 0));\n    const localOrigin = model.worldToLocal(worldOrigin.clone());\n    const shiftedLocal = model.worldToLocal(shiftedWorld);\n    const modelSpaceShift = shiftedLocal.sub(localOrigin);\n    applyModelSpaceMatrix(\n      THREE, model, object,\n      translationMatrix(THREE, modelSpaceShift.x, modelSpaceShift.y, modelSpaceShift.z),\n    );\n  }\n  model.updateWorldMatrix(true, true);\n  const afterWorld = new THREE.Box3().setFromObject(object);\n  if (Math.abs(afterWorld.min.y - targetWorldMinimumY) > 0.015) {\n    throw new Error(\`Supplied A1 Tunnel-C detail failed world-ramp grounding: before=\${beforeWorld.min.y}, after=\${afterWorld.min.y}\`);\n  }\n  return {\n    corrected: Math.abs(rigidVerticalAdjustmentMeters) > 0.001,\n    minimumY: afterWorld.min.y,\n    maximumY: afterWorld.max.y,\n    rigidVerticalAdjustmentMeters,\n  };\n}`;

  const newBlock = `function correctGroundedDetail(THREE, model, object) {\n  if (!object) throw new Error("Supplied A1 Tunnel-C grounding received no support mesh");\n\n  // ${marker}\n  // Never rigidly translate the opaque/integrated Tunnel-C carrier. It contains\n  // the passenger tunnel shell as well as the stair/bogie triangles; moving that\n  // entire mesh to the ramp physically tears Tunnel-C away from Tunnel-A/B and\n  // creates the stacked/double-decker bridge seen in aircraft-side evidence.\n  // Only genuinely separable small support meshes may receive a grounding shift.\n  model.updateWorldMatrix(true, true);\n  const beforeWorld = new THREE.Box3().setFromObject(object);\n  const beforeSize = beforeWorld.getSize(new THREE.Vector3());\n  const maximumHorizontalDimension = Math.max(beforeSize.x, beforeSize.z);\n  const integratedCarrier = object.name === "Tunnel_C_Jetway_0"\n    || maximumHorizontalDimension > 6.5\n    || beforeSize.y > 5.5;\n  if (integratedCarrier) {\n    return {\n      corrected: false,\n      minimumY: beforeWorld.min.y,\n      maximumY: beforeWorld.max.y,\n      rigidVerticalAdjustmentMeters: 0,\n      integratedCarrierPreserved: true,\n    };\n  }\n\n  const targetWorldMinimumY = 0;\n  const rigidVerticalAdjustmentMeters = targetWorldMinimumY - beforeWorld.min.y;\n  if (Math.abs(rigidVerticalAdjustmentMeters) > 0.001) {\n    const worldOrigin = model.localToWorld(new THREE.Vector3(0, 0, 0));\n    const shiftedWorld = worldOrigin.clone().add(new THREE.Vector3(0, rigidVerticalAdjustmentMeters, 0));\n    const localOrigin = model.worldToLocal(worldOrigin.clone());\n    const shiftedLocal = model.worldToLocal(shiftedWorld);\n    const modelSpaceShift = shiftedLocal.sub(localOrigin);\n    applyModelSpaceMatrix(\n      THREE, model, object,\n      translationMatrix(THREE, modelSpaceShift.x, modelSpaceShift.y, modelSpaceShift.z),\n    );\n  }\n  model.updateWorldMatrix(true, true);\n  const afterWorld = new THREE.Box3().setFromObject(object);\n  if (Math.abs(afterWorld.min.y - targetWorldMinimumY) > 0.015) {\n    throw new Error(\`Supplied A1 separable Tunnel-C support failed world-ramp grounding: before=\${beforeWorld.min.y}, after=\${afterWorld.min.y}\`);\n  }\n  return {\n    corrected: Math.abs(rigidVerticalAdjustmentMeters) > 0.001,\n    minimumY: afterWorld.min.y,\n    maximumY: afterWorld.max.y,\n    rigidVerticalAdjustmentMeters,\n    integratedCarrierPreserved: false,\n  };\n}`;

  if (!source.includes(oldBlock)) {
    throw new Error(`${doorFitPath}: final world-grounding block changed before integrated-carrier preservation`);
  }
  source = source.replace(oldBlock, newBlock);
}

if (!source.includes(pitchMarker)) {
  const oldPitchGuard = `  if (!(pitchRadians > 0.02 && pitchRadians < 0.14)) {\n    throw new Error(\`Supplied A1 corrected pitch is outside the physical range: \${pitchRadians}\`);\n  }`;
  const newPitchGuard = `  // ${pitchMarker}\n  // With the rendered CRJ door correctly targeted at world Y=3.00, the exact\n  // bridge solves to 0.019341 rad (~1.108 deg). The historical 0.020-rad cutoff\n  // rejects that physically valid near-level pose by 0.000659 rad. Keep a narrow\n  // fail-closed lower bound without restoring the obsolete 1.73-world-Y workaround.\n  if (!(pitchRadians > 0.018 && pitchRadians < 0.14)) {\n    throw new Error(\`Supplied A1 corrected pitch is outside the measured physical range: \${pitchRadians}\`);\n  }`;
  if (!source.includes(oldPitchGuard)) {
    throw new Error(`${doorFitPath}: expected 0.020-rad pitch guard is missing before measured rendered-door normalization`);
  }
  source = source.replace(oldPitchGuard, newPitchGuard);
}

for (const required of [
  marker,
  pitchMarker,
  'object.name === "Tunnel_C_Jetway_0"',
  "maximumHorizontalDimension > 6.5",
  "beforeSize.y > 5.5",
  "integratedCarrierPreserved: true",
  "pitchRadians > 0.018",
]) {
  if (!source.includes(required)) {
    throw new Error(`${doorFitPath}: final A1 carrier/pitch preservation is missing ${required}`);
  }
}
if (source.includes("a1-measured-door-low-slope-pitch-envelope-v1") || source.includes("pitchRadians > 0.005")) {
  throw new Error(`${doorFitPath}: obsolete low-door shallow-pitch workaround survived carrier preservation`);
}

fs.writeFileSync(doorFitPath, source, "utf8");
console.log(`Prepared ${marker} + ${pitchMarker}: the exact supplied Tunnel-C passenger carrier can no longer be vertically translated as bogie/stair grounding, and the correctly rendered 3.00 m CRJ door uses a narrow measured near-level pitch envelope without restoring the bad 1.73 m world target.`);
