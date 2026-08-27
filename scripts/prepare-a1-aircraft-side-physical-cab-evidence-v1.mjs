import fs from "node:fs";

const path = "scripts/capture-a1-aircraft-side-reference-evidence.cjs";
const marker = "a1-aircraft-side-physical-cab-evidence-v4-photo-outboard-envelope-current-v7";
const currentAuthority = "a1-final-exact-cab-footprint-door-contact-v7-bounded-lateral-hood-fit";
const minimumCabCenterSeparationMeters = 2.0;
const maximumCabCenterSeparationMeters = 6.0;

let source = fs.readFileSync(path, "utf8");

source = source.replace(
  /const CAB_SURFACE_AUTHORITY = 'a1-final-exact-cab-footprint-door-contact-v\d[^']*';/,
  `const CAB_SURFACE_AUTHORITY = '${currentAuthority}';`,
);

// Remove the retired v3 interpretation that incorrectly required the Cab body
// center itself to sit close to the CRJ door. The Aug. 17 photos show the opposite:
// the Cab/main body stays visibly outboard while only the hood/front face reaches
// the forward passenger door.
source = source.replaceAll("a1-aircraft-side-physical-cab-evidence-v3-reference-massing-current-v7", marker);
source = source.replaceAll("a1-aircraft-side-physical-cab-evidence-v2-reference-massing", marker);
source = source.replace(/\n\s*if \(cabCenterDoorHorizontalMeters > 3\.5\) \{[\s\S]*?\n\s*\}/g, "");
source = source.replace(/\n\s*const liveCabX = finite\(attached\.inspectionAircraftLiveVisibleCabWorldX,[\s\S]*?const cabCenterDoorHorizontalMeters = Math\.hypot\(liveCabX - liveDoorX, liveCabZ - liveDoorZ\);/g, "");

const measurementAnchor = `    const bogieGroundClearance = finite(attached.terminal4UploadedJetwayBogieGroundClearanceMeters, 'bogie ground clearance');`;
if (!source.includes(measurementAnchor)) throw new Error(`${path}: physical evidence measurement anchor is missing`);
if (!source.includes("cabCenterHorizontalSeparation = Math.hypot")) {
  const patch = `${measurementAnchor}\n    // ${marker}\n    const cabCenterX = finite(attached.inspectionAircraftLiveVisibleCabWorldX, 'live Cab center X');\n    const cabCenterZ = finite(attached.inspectionAircraftLiveVisibleCabWorldZ, 'live Cab center Z');\n    const doorCenterX = finite(attached.inspectionAircraftLiveVisibleDoorWorldX, 'live door center X');\n    const doorCenterZ = finite(attached.inspectionAircraftLiveVisibleDoorWorldZ, 'live door center Z');\n    const cabCenterHorizontalSeparation = Math.hypot(cabCenterX - doorCenterX, cabCenterZ - doorCenterZ);`;
  source = source.replace(measurementAnchor, patch);
} else if (!source.includes(marker)) {
  // The capture script may already contain the current physical measurements from a
  // prior preparation pass. In that case, stamp the current authority beside the
  // stable first measurement instead of incorrectly treating the missing comment
  // marker as missing geometry/evidence logic.
  const existingMeasurement = `    const cabCenterX = finite(attached.inspectionAircraftLiveVisibleCabWorldX, 'live Cab center X');`;
  if (!source.includes(existingMeasurement)) throw new Error(`${path}: existing Cab-center measurement is missing`);
  source = source.replace(existingMeasurement, `    // ${marker}\n${existingMeasurement}`);
}

const bogieGuard = `    if (Math.abs(bogieGroundClearance) > MAX_BOGIE_GROUND_CLEARANCE_METERS) throw new Error(\`A1 bogie is not grounded: \${bogieGroundClearance} m\`);`;
if (!source.includes(bogieGuard)) throw new Error(`${path}: bogie guard anchor is missing`);
if (!source.includes("Aug. 17 outboard attached-state envelope")) {
  source = source.replace(bogieGuard, `${bogieGuard}\n    if (cabCenterHorizontalSeparation < MIN_CAB_CENTER_HORIZONTAL_SEPARATION_METERS\n      || cabCenterHorizontalSeparation > MAX_CAB_CENTER_HORIZONTAL_SEPARATION_METERS) {\n      throw new Error(\`A1 Cab body is not in the Aug. 17 outboard attached-state envelope: center separation=\${cabCenterHorizontalSeparation} m\`);\n    }`);
}

const reportAnchor = `        verticallyCovered: attached.inspectionAircraftCabDoorVerticallyCovered,`;
if (!source.includes(reportAnchor)) throw new Error(`${path}: Cab report anchor is missing`);
if (!source.includes("cabCenterHorizontalSeparationMeters:")) {
  source = source.replace(reportAnchor, `${reportAnchor}\n        cabCenterHorizontalSeparationMeters: cabCenterHorizontalSeparation,`);
}

for (const required of [
  marker,
  currentAuthority,
  "inspectionAircraftLiveVisibleCabWorldX",
  "inspectionAircraftLiveVisibleDoorWorldX",
  "MIN_CAB_CENTER_HORIZONTAL_SEPARATION_METERS = 2.0",
  "MAX_CAB_CENTER_HORIZONTAL_SEPARATION_METERS = 6.0",
  "cabCenterHorizontalSeparation < MIN_CAB_CENTER_HORIZONTAL_SEPARATION_METERS",
  "cabCenterHorizontalSeparation > MAX_CAB_CENTER_HORIZONTAL_SEPARATION_METERS",
  "Aug. 17 outboard attached-state envelope",
]) {
  if (!source.includes(required)) throw new Error(`${path}: photo-authoritative Cab evidence is missing ${required}`);
}
for (const forbidden of [
  "cabCenterDoorHorizontalMeters > 3.5",
  "A1 attached-state Cab massing is inconsistent with the reference photos",
  "a1-final-exact-cab-footprint-door-contact-v2",
  "a1-final-exact-cab-footprint-door-contact-v6-bounded-lateral-and-vertical-fit",
]) {
  if (source.includes(forbidden)) throw new Error(`${path}: stale Cab evidence rule survived: ${forbidden}`);
}

fs.writeFileSync(path, source, "utf8");
console.log(`Prepared ${marker}: only the supplied hood/front face must reach the fixed CRJ door; the Cab body center is required to remain ${minimumCabCenterSeparationMeters}-${maximumCabCenterSeparationMeters} m outboard per the Aug. 17 attached-state references.`);
