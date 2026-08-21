import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-neutralize-under-cab-mechanical-prelift-v1";
const pitchTargetMarker = "a1-connected-pitch-targets-level-cab-opening-center-v3-face-center";
const priorPitchTargetMarker = "a1-connected-pitch-targets-level-cab-opening-center-v2";
const olderPitchTargetMarker = "a1-connected-pitch-targets-cab-opening-center-v1";
const exactDoorMarker = "a1-exact-authored-crj-forward-left-door-target-v2-sill-and-center";
const carrierMarker = "a1-preserve-integrated-tunnel-c-carrier-v1";

let source = fs.readFileSync(path, "utf8");
for (const required of [exactDoorMarker, carrierMarker]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: Cab pre-lift normalization requires prior marker ${required}`);
  }
}

// applyPitchToTunnels moves the Cab through the same Rotunda-centered pitch arc as
// Tunnel A/B/C and then counter-pitches the Cab about its transformed REAR hinge so
// the passenger hood remains level. The final aircraft-facing opening therefore has
// to be solved from the visible Cab face CENTER, not measureCabFace().point.y: that
// point is deliberately the face-band minimum/floor. Targeting that minimum at the
// CRJ door center leaves the visible Cab opening about half a metre too high. The
// exact b7d6 render exposed that error as 0.55403 m. Use front.centerY against the
// actual rear-hinge pivot so the final level Cab opening center lands on the fixed
// authored CRJ door without moving the aircraft or applying a disconnected Cab drop.
if (!source.includes(pitchTargetMarker)) {
  const priorV2Target = `  // ${priorPitchTargetMarker}\n  // The Cab is counter-pitched about its transformed rear hinge to stay level.\n  // Target that hinge so the final level aircraft-facing opening, not a pre-pitch\n  // proxy, lands on the fixed CRJ passenger-door center.\n  const cabOpeningVerticalOffsetFromRearHinge = cabAssembly.front.point.y - cabAssembly.rear.point.y;\n  const connectedCabRearHingeTargetY = targetYInModel - cabOpeningVerticalOffsetFromRearHinge;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.rear.point.y,\n    floorZ: cabAssembly.rear.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: connectedCabRearHingeTargetY,\n  });`;
  const oldOpeningTarget = `  // ${olderPitchTargetMarker}\n  // The fixed CRJ target is the passenger-door opening center, so solve the\n  // connected bridge pitch from the Cab aircraft-facing opening reference point,\n  // not from the lower floor/minimum edge of the broad Cab face band.\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.point.y,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });`;
  const staleFloorTarget = `  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });`;
  const correctedPitchTarget = `  // ${pitchTargetMarker}\n  // The Cab is counter-pitched about its transformed rear hinge to stay level.\n  // measureCabFace().point.y is the face-band MINIMUM, not the visible boarding\n  // opening center. Target the measured front face center relative to the actual\n  // rear-hinge pivot so the final level hood opening lands at the CRJ door center.\n  const cabOpeningVerticalOffsetFromRearHinge = cabAssembly.front.centerY - cabAssembly.rear.point.y;\n  const connectedCabRearHingeTargetY = targetYInModel - cabOpeningVerticalOffsetFromRearHinge;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.rear.point.y,\n    floorZ: cabAssembly.rear.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: connectedCabRearHingeTargetY,\n  });`;
  if (source.includes(priorV2Target)) source = source.replace(priorV2Target, correctedPitchTarget);
  else if (source.includes(oldOpeningTarget)) source = source.replace(oldOpeningTarget, correctedPitchTarget);
  else if (source.includes(staleFloorTarget)) source = source.replace(staleFloorTarget, correctedPitchTarget);
  else throw new Error(`${path}: connected A1 pitch has no recognizable pre-v3 target`);
}

if (!source.includes(marker)) {
  const oldBlockForTarget = (targetExpression) => `  // Keep the cab level and place its threshold exactly at the cabin sill. The\n  // tunnel end slopes down to this level; the cab itself does not lean across the\n  // fuselage like the previous one-point fit did.\n  const cabVerticalAdjustment = ${targetExpression} - cabAssembly.front.floorY;\n  applyModelSpaceMatrix(\n    THREE,\n    model,\n    cabAssembly.cab,\n    translationMatrix(THREE, 0, cabVerticalAdjustment, 0),\n  );`;
  const oldBlocks = [
    oldBlockForTarget("targetYInAnchor"),
    oldBlockForTarget("targetYInModel"),
  ];
  const replacement = `  // ${marker}\n  // cabAssembly.front.floorY is the minimum of a broad Cab face band that also\n  // contains low under-Cab mechanical/support vertices. It is not the passenger\n  // threshold. The old pre-lift used that machinery minimum to raise the entire\n  // Cab before the exact passenger-surface fitter ran. Keep this legacy value as\n  // zero telemetry only; connected bridge pitch plus the bounded final physical\n  // Cab proof own boarding-height alignment.\n  const cabVerticalAdjustment = 0;`;
  const matched = oldBlocks.find((block) => source.includes(block));
  if (!matched) {
    throw new Error(`${path}: stale under-Cab mechanical pre-lift block is missing`);
  }
  source = source.replace(matched, replacement);
}

for (const required of [
  marker,
  pitchTargetMarker,
  "cabAssembly.rear.point.y",
  "cabAssembly.rear.point.z",
  "cabAssembly.front.centerY",
  "connectedCabRearHingeTargetY",
  "cabOpeningVerticalOffsetFromRearHinge",
  "const cabVerticalAdjustment = 0;",
]) {
  if (!source.includes(required)) throw new Error(`${path}: Cab pre-lift/pitch normalization is missing ${required}`);
}
for (const forbidden of [
  priorPitchTargetMarker,
  olderPitchTargetMarker,
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
console.log(`Prepared ${marker} + ${pitchTargetMarker}: connected A1 pitch now targets the visible Cab face center through the transformed rear hinge, eliminating the half-metre high-Cab error without moving the fixed CRJ or disconnecting the Cab.`);
