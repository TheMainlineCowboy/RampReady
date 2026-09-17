import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-neutralize-under-cab-mechanical-prelift-v1";
const pitchTargetMarker = "a1-connected-pitch-targets-passenger-threshold-v5-highest-physical-sill";
const priorV4PitchTargetMarker = "a1-connected-pitch-targets-passenger-threshold-v4-exact-sill";
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

// The connected bridge and the final physical Cab fitter must identify the SAME
// passenger sill. The earlier v4 pitch solver stopped on the first plausible Y gap
// in the aircraft-facing Cab band, while the final physical fitter intentionally
// uses the highest plausible split to exclude all low under-Cab machinery. On the
// latest exact head those two classifiers disagreed by roughly the same 0.55 m as
// the rendered Cab/door height error. Use the final fitter's highest-split rule here
// as well so the connected Tunnel A/B/C/Cab pitch owns the real boarding height;
// do not repair that disagreement later by detaching or vertically dropping the Cab.
if (!source.includes(pitchTargetMarker)) {
  const priorV4Target = `  // ${priorV4PitchTargetMarker}\n  // targetYInModel is the exact authored CRJ passenger-door SILL. Derive the\n  // supplied Cab passenger threshold from its aircraft-facing source vertices,\n  // explicitly excluding low under-Cab machinery before solving connected pitch.\n  const prePitchCabVertices = collectModelLocalVertices(THREE, model, cabAssembly.cab);\n  if (prePitchCabVertices.length < 3) {\n    throw new Error("A1 supplied Cab exposes no source vertices for passenger-threshold pitch fit");\n  }\n  const prePitchCabCenter = new THREE.Box3().setFromPoints(prePitchCabVertices)\n    .getCenter(new THREE.Vector3());\n  let prePitchMaximumProjection = Number.NEGATIVE_INFINITY;\n  for (const point of prePitchCabVertices) {\n    prePitchMaximumProjection = Math.max(\n      prePitchMaximumProjection,\n      point.clone().sub(prePitchCabCenter).dot(cabFacingDirection),\n    );\n  }\n  const prePitchFrontBand = prePitchCabVertices.filter((point) => (\n    prePitchMaximumProjection - point.clone().sub(prePitchCabCenter).dot(cabFacingDirection)\n  ) <= 0.25);\n  if (prePitchFrontBand.length < 3) {\n    throw new Error("A1 supplied Cab aircraft-facing band is empty before connected pitch");\n  }\n  const prePitchSortedY = prePitchFrontBand.map((point) => point.y).sort((a, b) => a - b);\n  let prePitchPassengerSillY = Number.NaN;\n  for (let index = 1; index < prePitchSortedY.length; index += 1) {\n    const gap = prePitchSortedY[index] - prePitchSortedY[index - 1];\n    const upperCount = prePitchSortedY.length - index;\n    const upperSpan = prePitchSortedY[prePitchSortedY.length - 1] - prePitchSortedY[index];\n    if (gap >= 0.25 && upperCount >= 3 && upperSpan >= 0.30) {\n      prePitchPassengerSillY = prePitchSortedY[index];\n      break;\n    }\n  }\n  if (!Number.isFinite(prePitchPassengerSillY)) {\n    throw new Error("A1 supplied Cab passenger threshold cannot be separated from under-Cab mechanical geometry before pitch");\n  }\n  const cabPassengerSillOffsetFromRearHinge = prePitchPassengerSillY - cabAssembly.rear.point.y;\n  const connectedCabRearHingeTargetY = targetYInModel - cabPassengerSillOffsetFromRearHinge;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.rear.point.y,\n    floorZ: cabAssembly.rear.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: connectedCabRearHingeTargetY,\n  });`;
  const priorV3Target = `  // ${priorPitchTargetMarker}\n  // The Cab is counter-pitched about its transformed rear hinge to stay level.\n  // measureCabFace().point.y is the face-band MINIMUM, not the visible boarding\n  // opening center. Target the measured front face center relative to the actual\n  // rear-hinge pivot so the final level hood opening lands at the CRJ door center.\n  const cabOpeningVerticalOffsetFromRearHinge = cabAssembly.front.centerY - cabAssembly.rear.point.y;\n  const connectedCabRearHingeTargetY = targetYInModel - cabOpeningVerticalOffsetFromRearHinge;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.rear.point.y,\n    floorZ: cabAssembly.rear.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: connectedCabRearHingeTargetY,\n  });`;
  const priorV2Target = `  // ${olderV2PitchTargetMarker}\n  // The Cab is counter-pitched about its transformed rear hinge to stay level.\n  // Target that hinge so the final level aircraft-facing opening, not a pre-pitch\n  // proxy, lands on the fixed CRJ passenger-door center.\n  const cabOpeningVerticalOffsetFromRearHinge = cabAssembly.front.point.y - cabAssembly.rear.point.y;\n  const connectedCabRearHingeTargetY = targetYInModel - cabOpeningVerticalOffsetFromRearHinge;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.rear.point.y,\n    floorZ: cabAssembly.rear.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: connectedCabRearHingeTargetY,\n  });`;
  const oldOpeningTarget = `  // ${olderV1PitchTargetMarker}\n  // The fixed CRJ target is the passenger-door opening center, so solve the\n  // connected bridge pitch from the Cab aircraft-facing opening reference point,\n  // not from the lower floor/minimum edge of the broad Cab face band.\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.point.y,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });`;
  const staleFloorTarget = `  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });`;
  const correctedPitchTarget = `  // ${pitchTargetMarker}\n  // targetYInModel is the exact authored CRJ passenger-door SILL. Use the SAME\n  // highest plausible passenger split as the final physical Cab fitter, not the\n  // first low mechanical gap. This keeps connected bridge pitch and final sill\n  // acceptance on one geometric authority.\n  const prePitchCabVertices = collectModelLocalVertices(THREE, model, cabAssembly.cab);\n  if (prePitchCabVertices.length < 3) {\n    throw new Error("A1 supplied Cab exposes no source vertices for passenger-threshold pitch fit");\n  }\n  const prePitchCabCenter = new THREE.Box3().setFromPoints(prePitchCabVertices)\n    .getCenter(new THREE.Vector3());\n  let prePitchMaximumProjection = Number.NEGATIVE_INFINITY;\n  for (const point of prePitchCabVertices) {\n    prePitchMaximumProjection = Math.max(\n      prePitchMaximumProjection,\n      point.clone().sub(prePitchCabCenter).dot(cabFacingDirection),\n    );\n  }\n  const prePitchFrontBand = prePitchCabVertices.filter((point) => (\n    prePitchMaximumProjection - point.clone().sub(prePitchCabCenter).dot(cabFacingDirection)\n  ) <= 0.25);\n  if (prePitchFrontBand.length < 3) {\n    throw new Error("A1 supplied Cab aircraft-facing band is empty before connected pitch");\n  }\n  const prePitchSortedY = prePitchFrontBand.map((point) => point.y).sort((a, b) => a - b);\n  let prePitchPassengerSillY = Number.NEGATIVE_INFINITY;\n  for (let index = 1; index < prePitchSortedY.length; index += 1) {\n    const gap = prePitchSortedY[index] - prePitchSortedY[index - 1];\n    const upperCount = prePitchSortedY.length - index;\n    const upperSpan = prePitchSortedY[prePitchSortedY.length - 1] - prePitchSortedY[index];\n    if (gap >= 0.25 && upperCount >= 3 && upperSpan >= 0.30) {\n      prePitchPassengerSillY = Math.max(prePitchPassengerSillY, prePitchSortedY[index]);\n    }\n  }\n  if (!Number.isFinite(prePitchPassengerSillY)) {\n    throw new Error("A1 supplied Cab passenger threshold cannot be separated from under-Cab mechanical geometry before pitch");\n  }\n  const cabPassengerSillOffsetFromRearHinge = prePitchPassengerSillY - cabAssembly.rear.point.y;\n  const connectedCabRearHingeTargetY = targetYInModel - cabPassengerSillOffsetFromRearHinge;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.rear.point.y,\n    floorZ: cabAssembly.rear.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: connectedCabRearHingeTargetY,\n  });`;
  if (source.includes(priorV4Target)) source = source.replace(priorV4Target, correctedPitchTarget);
  else if (source.includes(priorV3Target)) source = source.replace(priorV3Target, correctedPitchTarget);
  else if (source.includes(priorV2Target)) source = source.replace(priorV2Target, correctedPitchTarget);
  else if (source.includes(oldOpeningTarget)) source = source.replace(oldOpeningTarget, correctedPitchTarget);
  else if (source.includes(staleFloorTarget)) source = source.replace(staleFloorTarget, correctedPitchTarget);
  else throw new Error(`${path}: connected A1 pitch has no recognizable pre-v5 target`);
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
  "Math.max(prePitchPassengerSillY, prePitchSortedY[index])",
  "cabPassengerSillOffsetFromRearHinge",
  "cabAssembly.rear.point.y",
  "cabAssembly.rear.point.z",
  "connectedCabRearHingeTargetY",
  "const cabVerticalAdjustment = 0;",
]) {
  if (!source.includes(required)) throw new Error(`${path}: Cab pre-lift/pitch normalization is missing ${required}`);
}
for (const forbidden of [
  priorV4PitchTargetMarker,
  priorPitchTargetMarker,
  olderV2PitchTargetMarker,
  olderV1PitchTargetMarker,
  "prePitchPassengerSillY = prePitchSortedY[index];\\n      break;",
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
console.log(`Prepared ${marker} + ${pitchTargetMarker}: connected A1 pitch now uses the same highest physical passenger-sill split as final Cab acceptance, keeping the movable bridge connected while excluding low mechanical geometry.`);
