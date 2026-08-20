import fs from "node:fs";

const path = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const marker = "a1-neutralize-under-cab-mechanical-prelift-v1";
const exactDoorMarker = "a1-exact-authored-crj-forward-left-door-target-v2-sill-and-center";
const carrierMarker = "a1-preserve-integrated-tunnel-c-carrier-v1";

let source = fs.readFileSync(path, "utf8");
for (const required of [exactDoorMarker, carrierMarker]) {
  if (!source.includes(required)) {
    throw new Error(`${path}: Cab pre-lift normalization requires prior marker ${required}`);
  }
}

if (!source.includes(marker)) {
  const oldBlockForTarget = (targetExpression) => `  // Keep the cab level and place its threshold exactly at the cabin sill. The\n  // tunnel end slopes down to this level; the cab itself does not lean across the\n  // fuselage like the previous one-point fit did.\n  const cabVerticalAdjustment = ${targetExpression} - cabAssembly.front.floorY;\n  applyModelSpaceMatrix(\n    THREE,\n    model,\n    cabAssembly.cab,\n    translationMatrix(THREE, 0, cabVerticalAdjustment, 0),\n  );`;
  // The pitch preparer now converts the door target from the obsolete anchor frame
  // into model-local coordinates before this neutralizer runs. Accept either spelling
  // of the same legacy Cab pre-lift so build ordering cannot make the repair non-idempotent.
  const oldBlocks = [
    oldBlockForTarget("targetYInAnchor"),
    oldBlockForTarget("targetYInModel"),
  ];
  const replacement = `  // ${marker}\n  // cabAssembly.front.floorY is the minimum of a broad Cab face band that also\n  // contains low under-Cab mechanical/support vertices. It is not the passenger\n  // threshold. The old pre-lift used that machinery minimum to raise the entire\n  // Cab by nearly two metres before the exact passenger-surface fitter ran. Keep\n  // this legacy value as zero telemetry only; the later final Cab surface stage is\n  // the sole owner of vertical boarding-sill articulation.\n  const cabVerticalAdjustment = 0;`;
  const matched = oldBlocks.find((block) => source.includes(block));
  if (!matched) {
    throw new Error(`${path}: stale under-Cab mechanical pre-lift block is missing`);
  }
  source = source.replace(matched, replacement);
}

for (const required of [
  marker,
  "const cabVerticalAdjustment = 0;",
  "sole owner of vertical boarding-sill articulation",
]) {
  if (!source.includes(required)) throw new Error(`${path}: Cab pre-lift normalization is missing ${required}`);
}
for (const forbidden of [
  "const cabVerticalAdjustment = targetYInAnchor - cabAssembly.front.floorY;",
  "const cabVerticalAdjustment = targetYInModel - cabAssembly.front.floorY;",
  "translationMatrix(THREE, 0, cabVerticalAdjustment, 0)",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale Cab pre-lift survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: removed the obsolete under-Cab mechanical-minimum pre-lift in either legacy coordinate spelling; final supplied passenger-surface sill fit now owns Cab Y while aircraft, terminal and Tunnel-C remain fixed.`);
