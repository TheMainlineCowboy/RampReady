import fs from "node:fs";

const path = "scripts/capture-a1-aircraft-side-reference-evidence.cjs";
const marker = "a1-aircraft-side-physical-cab-evidence-v1";
const currentAuthority = "a1-final-exact-cab-footprint-door-contact-v5-cab-only-vertical-fit";

let source = fs.readFileSync(path, "utf8");

source = source.replace(
  "const CAB_SURFACE_AUTHORITY = 'a1-final-exact-cab-footprint-door-contact-v2';",
  `const CAB_SURFACE_AUTHORITY = '${currentAuthority}';`,
);

if (!source.includes(marker)) {
  const staleMeasurements = `    const renderedCabDoorVerticalError = finite(attached.inspectionAircraftDoorVerticalErrorMeters, 'rendered Cab/door vertical error');\n    const cabDoorFacingVertexCount = finite(attached.inspectionAircraftCabDoorFacingVertexCount, 'Cab door-facing vertex count');`;
  const physicalMeasurements = `    // ${marker}\n    // The old representative Cab point is not the rounded boarding hood and can remain\n    // more than a metre from the door after the physical Cab surface is correctly fitted.\n    // Acceptance therefore uses the exact final supplied Cab face/hood envelope itself.\n    const cabDoorMinimumHeight = finite(attached.inspectionAircraftCabDoorMinimumHeightMeters, 'Cab hood minimum height');\n    const cabDoorMaximumHeight = finite(attached.inspectionAircraftCabDoorMaximumHeightMeters, 'Cab hood maximum height');\n    const cabVerticalArticulation = finite(attached.inspectionAircraftCabVerticalCorrectionMeters, 'Cab vertical articulation');\n    const renderedCabDoorVerticalError = finite(attached.inspectionAircraftDoorVerticalErrorMeters, 'legacy representative Cab/door vertical diagnostic');\n    const cabDoorFacingVertexCount = finite(attached.inspectionAircraftCabDoorFacingVertexCount, 'Cab door-facing vertex count');`;
  if (!source.includes(staleMeasurements)) throw new Error(`${path}: stale Cab measurement anchor is missing`);
  source = source.replace(staleMeasurements, physicalMeasurements);

  const staleGuard = `    if (Math.abs(renderedCabDoorVerticalError) > MAX_RENDERED_CAB_DOOR_VERTICAL_ERROR_METERS) {\n      throw new Error(\`A1 rendered Cab is visibly too high/low for the fixed CRJ door: vertical=\${renderedCabDoorVerticalError} m\`);\n    }`;
  const physicalGuard = `    if (cabDoorMinimumHeight > 0.08 || cabDoorMaximumHeight < -0.08) {\n      throw new Error(\`A1 physical supplied Cab hood misses the fixed CRJ door vertically: hood=[\${cabDoorMinimumHeight},\${cabDoorMaximumHeight}] m, articulation=\${cabVerticalArticulation} m, legacyRepresentative=\${renderedCabDoorVerticalError} m\`);\n    }`;
  if (!source.includes(staleGuard)) throw new Error(`${path}: stale representative-height fatal guard is missing`);
  source = source.replace(staleGuard, physicalGuard);

  source = source.replace(
    `        renderedVerticalErrorMeters: renderedCabDoorVerticalError,`,
    `        legacyRepresentativeVerticalErrorMeters: renderedCabDoorVerticalError,\n        minimumHoodHeightMeters: cabDoorMinimumHeight,\n        maximumHoodHeightMeters: cabDoorMaximumHeight,\n        cabVerticalArticulationMeters: cabVerticalArticulation,`,
  );
  source = source.replace(
    `vertical=\${renderedCabDoorVerticalError.toFixed(3)} m, bogie=\${bogieGroundClearance.toFixed(3)} m.`,
    `hoodY=[\${cabDoorMinimumHeight.toFixed(3)},\${cabDoorMaximumHeight.toFixed(3)}] m, legacyRepresentativeY=\${renderedCabDoorVerticalError.toFixed(3)} m, bogie=\${bogieGroundClearance.toFixed(3)} m.`,
  );
}

for (const required of [
  marker,
  currentAuthority,
  "inspectionAircraftCabDoorMinimumHeightMeters",
  "inspectionAircraftCabDoorMaximumHeightMeters",
  "inspectionAircraftCabVerticalCorrectionMeters",
  "cabDoorMinimumHeight > 0.08 || cabDoorMaximumHeight < -0.08",
]) {
  if (!source.includes(required)) throw new Error(`${path}: physical Cab evidence is missing ${required}`);
}
for (const stale of [
  "A1 rendered Cab is visibly too high/low for the fixed CRJ door",
  "if (Math.abs(renderedCabDoorVerticalError) > MAX_RENDERED_CAB_DOOR_VERTICAL_ERROR_METERS)",
]) {
  if (source.includes(stale)) throw new Error(`${path}: stale representative Cab-height veto survived: ${stale}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: aircraft-side evidence now judges the exact final supplied Cab hood/face against the fixed CRJ door; the old representative-point vertical gap is diagnostic only.`);
