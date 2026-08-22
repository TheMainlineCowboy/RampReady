import fs from "node:fs";

const path = "scripts/capture-a1-aircraft-side-reference-evidence.cjs";
const marker = "a1-aircraft-side-physical-cab-evidence-v3-reference-massing-current-v7";
const currentAuthority = "a1-final-exact-cab-footprint-door-contact-v7-bounded-lateral-hood-fit";

let source = fs.readFileSync(path, "utf8");

source = source.replace(
  /const CAB_SURFACE_AUTHORITY = 'a1-final-exact-cab-footprint-door-contact-v\d[^']*';/,
  `const CAB_SURFACE_AUTHORITY = '${currentAuthority}';`,
);

// Normalize an earlier injected v2 massing block if present. The physical intent
// is unchanged; only the current v7 Cab proof owns the final rendered contact.
source = source.replaceAll(
  "a1-aircraft-side-physical-cab-evidence-v2-reference-massing",
  marker,
);

if (!source.includes(marker)) {
  const measurementAnchor = `    const bogieGroundClearance = finite(attached.terminal4UploadedJetwayBogieGroundClearanceMeters, 'bogie ground clearance');`;
  if (!source.includes(measurementAnchor)) throw new Error(`${path}: physical evidence measurement anchor is missing`);
  const measurementPatch = `${measurementAnchor}\n    // ${marker}\n    // The Aug. 17 attached-state photos show only the Cab/hood terminating at the\n    // forward door. A tiny nearest-vertex distance is not sufficient if the whole\n    // Cab mass is displaced alongside the nose. Keep a coarse, independent massing\n    // backstop between the live Cab endpoint center and the fixed authored door.\n    const liveCabX = finite(attached.inspectionAircraftLiveVisibleCabWorldX, 'live Cab endpoint X');\n    const liveCabZ = finite(attached.inspectionAircraftLiveVisibleCabWorldZ, 'live Cab endpoint Z');\n    const liveDoorX = finite(attached.inspectionAircraftLiveVisibleDoorWorldX, 'live door X');\n    const liveDoorZ = finite(attached.inspectionAircraftLiveVisibleDoorWorldZ, 'live door Z');\n    const cabCenterDoorHorizontalMeters = Math.hypot(liveCabX - liveDoorX, liveCabZ - liveDoorZ);`;
  source = source.replace(measurementAnchor, measurementPatch);

  const guardAnchor = `    if (Math.abs(bogieGroundClearance) > MAX_BOGIE_GROUND_CLEARANCE_METERS) throw new Error(\`A1 bogie is not grounded: \${bogieGroundClearance} m\`);`;
  if (!source.includes(guardAnchor)) throw new Error(`${path}: bogie guard anchor is missing`);
  source = source.replace(guardAnchor, `${guardAnchor}\n    if (cabCenterDoorHorizontalMeters > 3.5) {\n      throw new Error(\`A1 attached-state Cab massing is inconsistent with the reference photos: Cab endpoint center is \${cabCenterDoorHorizontalMeters} m from the fixed CRJ door even though the nearest hood vertex is \${doorCabSurfaceDistance} m away\`);\n    }`);

  const reportAnchor = `        verticallyCovered: attached.inspectionAircraftCabDoorVerticallyCovered,`;
  if (!source.includes(reportAnchor)) throw new Error(`${path}: Cab report anchor is missing`);
  source = source.replace(reportAnchor, `${reportAnchor}\n        cabCenterDoorHorizontalMeters,`);
}

for (const required of [
  marker,
  currentAuthority,
  "inspectionAircraftLiveVisibleCabWorldX",
  "inspectionAircraftLiveVisibleDoorWorldX",
  "cabCenterDoorHorizontalMeters > 3.5",
]) {
  if (!source.includes(required)) throw new Error(`${path}: reference-massing Cab evidence is missing ${required}`);
}
for (const forbidden of [
  "a1-final-exact-cab-footprint-door-contact-v2",
  "a1-final-exact-cab-footprint-door-contact-v6-bounded-lateral-and-vertical-fit",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale Cab evidence authority survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: aircraft-side evidence consumes ${currentAuthority} and rejects the false-green case where a tiny hood vertex reaches the door while the supplied Cab mass remains grossly displaced beside the nose.`);
