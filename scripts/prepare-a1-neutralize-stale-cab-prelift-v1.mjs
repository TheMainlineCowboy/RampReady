import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-neutralize-under-cab-mechanical-prelift-v1";
const pitchTargetMarker = "a1-connected-pitch-targets-level-cab-opening-center-v2";
const priorPitchTargetMarker = "a1-connected-pitch-targets-cab-opening-center-v1";
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
// the passenger hood remains level. Therefore the final aircraft-facing opening Y
// is not the simple rotated front.point Y used by the old pitch solve. The browser
// evidence on f429a65 showed the exact consequence: horizontal contact was 4.85 cm,
// but the final level Cab reference remained 0.500584 m above the fixed CRJ door.
// Solve the connected bridge pitch from the rear hinge instead. Put the transformed
// rear hinge at doorY minus the Cab's original front-to-rear vertical offset; after
// the counter-pitch, the level Cab opening then lands at the actual door center.
if (!source.includes(pitchTargetMarker)) {
  const oldOpeningTarget = `  // ${priorPitchTargetMarker}\n  // The fixed CRJ target is the passenger-door opening center, so solve the\n  // connected bridge pitch from the Cab aircraft-facing opening reference point,\n  // not from the lower floor/minimum edge of the broad Cab face band.\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.point.y,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });`;
  const staleFloorTarget = `  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,\n    floorZ: cabAssembly.front.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: targetYInModel,\n  });`;
  const correctedPitchTarget = `  // ${pitchTargetMarker}\n  // The Cab is counter-pitched about its transformed rear hinge to stay level.\n  // Target that hinge so the final level aircraft-facing opening, not a pre-pitch\n  // proxy, lands on the fixed CRJ passenger-door center.\n  const cabOpeningVerticalOffsetFromRearHinge = cabAssembly.front.point.y - cabAssembly.rear.point.y;\n  const connectedCabRearHingeTargetY = targetYInModel - cabOpeningVerticalOffsetFromRearHinge;\n  const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.rear.point.y,\n    floorZ: cabAssembly.rear.point.z,\n    pivotY: rotundaCenter.y,\n    pivotZ: rotundaCenter.z,\n    targetY: connectedCabRearHingeTargetY,\n  });`;
  if (source.includes(oldOpeningTarget)) source = source.replace(oldOpeningTarget, correctedPitchTarget);
  else if (source.includes(staleFloorTarget)) source = source.replace(staleFloorTarget, correctedPitchTarget);
  else throw new Error(`${path}: connected A1 pitch has no recognizable pre-v2 target`);
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
  "connectedCabRearHingeTargetY",
  "cabOpeningVerticalOffsetFromRearHinge",
  "const cabVerticalAdjustment = 0;",
]) {
  if (!source.includes(required)) throw new Error(`${path}: Cab pre-lift/pitch normalization is missing ${required}`);
}
for (const forbidden of [
  priorPitchTargetMarker,
  "const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.floorY,",
  "const requestedDoorPitchRadians = solvePitchRadians({\n    floorY: cabAssembly.front.point.y,",
  "const cabVerticalAdjustment = targetYInAnchor - cabAssembly.front.floorY;",
  "const cabVerticalAdjustment = targetYInModel - cabAssembly.front.floorY;",
  "translationMatrix(THREE, 0, cabVerticalAdjustment, 0)",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale Cab pitch/pre-lift survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker} + ${pitchTargetMarker}: connected A1 pitch now targets the transformed rear hinge so the final level Cab opening lands on the fixed CRJ door center; isolated under-Cab pre-lift remains removed.`);
