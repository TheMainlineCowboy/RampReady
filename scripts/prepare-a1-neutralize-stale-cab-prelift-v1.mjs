import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-neutralize-under-cab-mechanical-prelift-v1";
const pitchTargetMarker = "a1-connected-pitch-targets-passenger-threshold-v4-exact-sill";
const priorPitchTargetMarker = "a1-connected-pitch-targets-level-cab-opening-center-v3-face-center";
const olderV2PitchTargetMarker = "a1-connected-pitch-targets-level-cab-opening-center-v2";
const olderV1PitchTargetMarker = "a1-connected-pitch-targets-cab-opening-center-v1";
const exactDoorMarker = "a1-exact-authored-crj-forward-left-door-target-v2-sill-and-center";
const carrierMarker = "a1-preserve-integrated-tunnel-c-carrier-v1";

let source = fs.readFileSync(path, "utf8");
for (const required of [exactDoorMarker, carrierMarker]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: Cab pre-lift normalization requires prior marker ${required}`);
  }
}

// The exact door target used by the connected bridge solver is the physical CRJ
// DOOR SILL, not the center of the door opening. The prior v3 correction targeted
// cabAssembly.front.centerY at that sill. That is dimensionally wrong and the fresh
// exact-head reference evidence still showed a 0.55403 m visible Cab/door height
// error. Solve the connected pitch from the supplied Cab's actual passenger
// threshold instead. The threshold is separated from low under-Cab mechanical
// geometry by the first physically plausible vertical gap in the aircraft-facing
// Cab band, matching the final physical sill fitter's topology logic. Because the
// Cab is counter-pitched about its rear hinge to remain level, the threshold-to-
// hinge vertical offset stays constant through the final connected pitch.
if (!source.includes(pitchTargetMarker)) {
  const priorV3Target = `  // ${priorPitchTargetMarker}\n  // The Cab is counter-pitched about its transformed rear hinge to stay level.\n  // measureCabFace().point.y is the face-band MINIMUM, not the visible boarding\n  // opening center. Target the measured front face center relative to the actual\n  // rear-hinge pivot so the final level hood opening lands at the CRJ door center.\n  const cabOpeningVerticalOffsetFromRearHinge = cabAssembly.front.centerY - cabAssembly.rear.point.y;\n  const connectedCabRearHingeTargetY = targetYInModel - cabOpeningVerticalOffsetFromRearHinge;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.rear.point.y,\n    floorZ: cabAssembly.rear.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: connectedCabRearHingeTargetY,\n  });`;
  const priorV2Target = `  // ${olderV2PitchTargetMarker}\n  // The Cab is counter-pitched about its transformed rear hinge to stay level.\n  // Target that hinge so the final level aircraft-facing opening, not a pre-pitch\n  // proxy, lands on the fixed CRJ passenger-door center.\n  const cabOpeningVerticalOffsetFromRearHinge = cabAssembly.front.point.y - cabAssembly.rear.point.y;\n  const connectedCabRearHingeTargetY = targetYInModel - cabOpeningVerticalOffsetFromRearHinge;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.rear.point.y,\n    floorZ: cabAssembly.rear.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: connectedCabRearHingeTargetY,\n  });`;
  const oldOpeningTarget = `  // ${olderV1PitchTargetMarker}\n  // The fixed CRJ target is the passenger-door opening center, so solve the\n  // connected bridge pitch from the Cab aircraft-facing opening reference point,\n  // not from the lower floor/minimum edge of the broad Cab face band.\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.point.y,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });`;
  const staleFloorTarget = `  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });`;
  const correctedPitchTarget = `  // ${pitchTargetMarker}\n  // targetYInModel is the exact authored CRJ passenger-door SILL. Derive the\n  // supplied Cab passenger threshold from its aircraft-facing source vertices,\n  // explicitly excluding low under-Cab machinery before solving connected pitch.\n  const prePitchCabVertices = collectModelLocalVertices(THREE, model, cabAssembly.cab);\n  if (prePitchCabVertices.length < 3) {\n    throw new Error("A1 supplied Cab exposes no source vertices for passenger-threshold pitch fit");\n  }\n  const prePitchCabCenter = new THREE.Box3().setFromPoints(prePitchCabVertices)\n    .getCenter(new THREE.Vector3());\n  let prePitchMaximumProjection = Number.NEGATIVE_INFINITY;\n  for (const point of prePitchCabVertices) {\n    prePitchMaximumProjection = Math.max(\n      prePitchMaximumProjection,\n      point.clone().sub(prePitchCabCenter).dot(cabFacingDirection),\n    );\n  }\n  const prePitchFrontBand = prePitchCabVertices.filter((point) => (\n    prePitchMaximumProjection - point.clone().sub(prePitchCabCenter).dot(cabFacingDirection)\n  ) <= 0.25);\n  if (prePitchFrontBand.length < 3) {\n    throw new Error("A1 supplied Cab aircraft-facing band is empty before connected pitch");\n  }\n  const prePitchSortedY = prePitchFrontBand.map((point) => point.y).sort((a, b) => a - b);\n  let prePitchPassengerSillY = Number.NaN;\n  for (let index = 1; index < prePitchSortedY.length; index += 1) {\n    const gap = prePitchSortedY[index] - prePitchSortedY[index - 1];\n    const upperCount = prePitchSortedY.length - index;\n    const upperSpan = prePitchSortedY[prePitchSortedY.length - 1] - prePitchSortedY[index];\n    if (gap >= 0.25 && upperCount >= 3 && upperSpan >= 0.30) {\n      prePitchPassengerSillY = prePitchSortedY[index];\n      break;\n    }\n  }\n  if (!Number.isFinite(prePitchPassengerSillY)) {\n    throw new Error("A1 supplied Cab passenger threshold cannot be separated from under-Cab mechanical geometry before pitch");\n  }\n  const cabPassengerSillOffsetFromRearHinge = prePitchPassengerSillY - cabAssembly.rear.point.y;\n  const connectedCabRearHingeTargetY = targetYInModel - cabPassengerSillOffsetFromRearHinge;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.rear.point.y,\n    floorZ: cabAssembly.rear.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: connectedCabRearHingeTargetY,\n  });`;
  if (source.includes(priorV3Target)) source = source.replace(priorV3Target, correctedPitchTarget);
  else if (source.includes(priorV2Target)) source = source.replace(priorV2Target, correctedPitchTarget);
  else if (source.includes(oldOpeningTarget)) source = source.replace(oldOpeningTarget, correctedPitchTarget);
  else if (source.includes(staleFloorTarget)) source = source.replace(staleFloorTarget, correctedPitchTarget);
  else throw new Error(`${path}: connected A1 pitch has no recognizable pre-v4 target`);
}

if (!source.includes(marker)) {
  const oldBlockForTarget = (targetExpression) => `  // Keep the cab level and place its threshold exactly at the cabin sill. The\n  // tunnel end slopes down to this level; the cab itself does not lean across the\n  // fuselage like the previous one-point fit did.\n  const cabVerticalAdjustment = ${targetExpression} - cabAssembly.front.floorY;\n  applyModelSpaceMatrix(\n    THREE,\n    model,\n    cabAssembly.cab,\n    translationMatrix(THREE, 0, cabVerticalAdjustment, 0),\n  );`;
  const oldBlocks = [
    oldBlockForTarget("targetYInAnchor"),
    oldBlockForTarget("targetYInModel"),
  ];
  const replacement = `  // ${marker}\n  // cabAssembly.front.floorY is the minimum of a broad Cab face band that also\n  // contains low under-Cab mechanical/support vertices. It is not the passenger\n  // threshold. Do not translate the Cab away from Tunnel-C to satisfy that proxy.\n  // The connected bridge pitch above now owns passenger-sill height, while the\n  // bounded final physical Cab proof may make only the small hood articulation\n  // that survives the Tunnel-C/Cab seam check.\n  const cabVerticalAdjustment = 0;`;
  const matched = oldBlocks.find((block) => source.includes(block));
  if (!matched) {
    throw new Error(`${path}: stale under-Cab mechanical pre-lift block is missing`);
  }
  source = source.replace(matched, replacement);
}

for (const required of [
  marker,
  pitchTargetMarker,
  "prePitchCabVertices",
  "prePitchFrontBand",
  "prePitchPassengerSillY",
  "cabPassengerSillOffsetFromRearHinge",
  "cabAssembly.rear.point.y",
  "cabAssembly.rear.point.z",
  "connectedCabRearHingeTargetY",
  "const cabVerticalAdjustment = 0;",
]) {
  if (!source.includes(required)) throw new Error(`${path}: Cab pre-lift/pitch normalization is missing ${required}`);
}
for (const forbidden of [
  priorPitchTargetMarker,
  olderV2PitchTargetMarker,
  olderV1PitchTargetMarker,
  "cabAssembly.front.centerY - cabAssembly.rear.point.y",
  "cabAssembly.front.point.y - cabAssembly.rear.point.y",
  "const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,",
  "const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.point.y,",
  "const cabVerticalAdjustment = targetYInAnchor - cabAssembly.front.floorY;",
  "const cabVerticalAdjustment = targetYInModel - cabAssembly.front.floorY;",
  "translationMatrix(THREE, 0, cabVerticalAdjustment, 0)"
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale Cab pitch/pre-lift survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker} + ${pitchTargetMarker}: connected A1 pitch now targets the actual supplied Cab passenger threshold to the exact CRJ door sill, excluding under-Cab mechanical geometry and avoiding a disconnected Cab drop.`);
