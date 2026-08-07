import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(jetwayPath, "utf8");

function hasMarker(marker) {
  return (Array.isArray(marker) ? marker : [marker]).some((candidate) => source.includes(candidate));
}

function replaceOnce(oldText, newText, marker, label) {
  if (hasMarker(marker)) return;
  if (!source.includes(oldText)) throw new Error(`${jetwayPath}: source-scale jetway anchor is missing for ${label}`);
  source = source.replace(oldText, newText);
}

function replaceAny(candidates, newText, marker, label) {
  if (hasMarker(marker)) return;
  const oldText = candidates.find((candidate) => source.includes(candidate));
  if (!oldText) throw new Error(`${jetwayPath}: source-scale jetway token is missing for ${label}`);
  source = source.replace(oldText, newText);
}

// Keep the production runtime on the same A1/CRJ geometry authority that the
// committed simulator validation proves. The uploaded Airport_Jetway.glb is
// never scaled or edited here; these values only define the aircraft-door
// target and authored bridge contact relationship used for placement/readiness.
source = source
  .replace("CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32", "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25")
  .replace("CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34", "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35")
  .replace("AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.61", "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.58")
  .replace("AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.55", "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.58");

replaceAny(
  [
    'detailLevel: "fsx-air-jetway01-exact-textured-crj-scale-v4"',
    'detailLevel: "fsx-air-jetway01-exact-textured-crj-scale-v5"',
  ],
  'detailLevel: "fsx-air-jetway01-exact-textured-source-scale-articulated-v5"',
  'detailLevel: "fsx-air-jetway01-exact-textured-source-scale-articulated-v5"',
  "source-scale detail level",
);

replaceOnce(
  'const OPEN_SERVICE_BAY_GATES = new Set(["A5", "A13", "A21", "B5", "B13", "B21"]);',
  `const OPEN_SERVICE_BAY_GATES = new Set(["A13", "A21", "B13", "B21"]);
const CLOSED_SERVICE_DOOR_GATES = new Set(["A3", "A8", "A17", "A24", "B2", "B7", "B14", "B19", "B26"]);
const FACADE_VENT_GATES = new Set(["A6", "A11", "A19", "A27", "B4", "B10", "B17", "B24"]);`,
  "const CLOSED_SERVICE_DOOR_GATES",
  "irregular lower-facade feature sets",
);

replaceOnce(
  "  let terminal4LowerFacadeFitCount = 0;",
  "  let terminal4LowerFacadeFitCount = 0;\n  let terminal4OpenServiceBayCount = 0;",
  "let terminal4OpenServiceBayCount = 0",
  "service-bay counter",
);

replaceOnce(
  `    const gateNumber = Number.parseInt(jetway.g.slice(1), 10);
    const keepServiceBayOpen = OPEN_SERVICE_BAY_GATES.has(jetway.g);
    const lowerWallFit = lowerFacadeWallDistance ?? terminalWallDistance;`,
  `    const sourceFacadeRecessMeters = lowerFacadeWallDistance != null && terminalWallDistance != null
      ? lowerFacadeWallDistance - terminalWallDistance
      : 0;
    const keepServiceBayOpen = OPEN_SERVICE_BAY_GATES.has(jetway.g) && sourceFacadeRecessMeters >= 1.4;
    if (keepServiceBayOpen) terminal4OpenServiceBayCount += 1;
    const lowerWallFit = lowerFacadeWallDistance ?? terminalWallDistance;`,
  "const sourceFacadeRecessMeters",
  "source-recess service-bay qualification",
);

replaceOnce(
  "      if (Number.isInteger(gateNumber) && gateNumber % 3 === 0) {",
  "      if (CLOSED_SERVICE_DOOR_GATES.has(jetway.g)) {",
  "CLOSED_SERVICE_DOOR_GATES.has(jetway.g)",
  "irregular closed service doors",
);
replaceOnce(
  "      if (Number.isInteger(gateNumber) && gateNumber % 2 === 0) {",
  "      if (FACADE_VENT_GATES.has(jetway.g)) {",
  "FACADE_VENT_GATES.has(jetway.g)",
  "irregular facade vents",
);

replaceAny(
  [
    "  group.userData.openServiceBayCount = OPEN_SERVICE_BAY_GATES.size;",
    "  group.userData.openServiceBayCount = terminal4OpenServiceBayCount;",
  ],
  `  group.userData.openServiceBayCount = terminal4OpenServiceBayCount;
  group.userData.sourceScaleAuthority = "airport-authored-AIR_Jetway01-scale-preserved-no-aircraft-specific-shrink";
  group.userData.sourceGeometryMode = "procedural-articulated-fallback-pending-original-AIR_Jetway01-mesh-recovery";
  group.userData.requiresOriginalSourceMesh = true;
  group.userData.jetwayMotionLimits = Object.freeze({
    rotundaYawDegrees: Object.freeze([-92, 92]),
    cabinHeightMeters: Object.freeze([2.35, 5.75]),
    telescopingExtensionMeters: Object.freeze([11.5, 29.5]),
  });
  group.userData.initialJetwayState = "attached-to-aircraft-door";
  group.userData.requiredPrePushSequence = "retract-bellows-clear-door-telescope-in-rotate-to-park";`,
  "group.userData.sourceScaleAuthority",
  "source-scale and articulation evidence",
);

replaceAny(
  [
    '  group.userData.facadeInfillAuthority = "source-positioned-gate-module-closures-with-limited-service-openings";',
    '  group.userData.facadeInfillAuthority = "source-recess-qualified-service-bays-with-irregular-closed-facade-details";',
  ],
  '  group.userData.facadeInfillAuthority = "source-recess-qualified-service-bays-with-irregular-closed-facade-details";',
  [
    "source-recess-qualified-service-bays-with-irregular-closed-facade-details",
    "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays",
    "source-shaped-lower-facade-skin-v9-over-continuous-structural-spans",
    "source-authored-terminal4-lower-facade-v25-no-overlay",
  ],
  "facade authority",
);

replaceAny(
  [
    '  group.userData.visualAuthority = "faithful-reconstruction-of-referenced-fsx-air-jetway01-library-object";',
    '  group.userData.visualAuthority = "CRJ700-scaled-reconstruction-of-referenced-fsx-air-jetway01-library-object";',
  ],
  '  group.userData.visualAuthority = "source-scale articulated fallback while original AIR_Jetway01 mesh is recovered";',
  [
    "source-scale articulated fallback while original AIR_Jetway01 mesh is recovered",
    "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v1",
    "exact-uploaded-airport-jetway-glb-562e3144-v1",
  ],
  "honest visual authority",
);

for (const forbidden of [
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 1.55",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.28",
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 7.32",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.34",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 2.61",
  "createArchedTunnelGeometry(THREE, 2.08, 2.02, 0.18)",
  "scale: [2.24, 2.12, wallConnectorLength]",
]) {
  if (source.includes(forbidden)) throw new Error(`AIR_Jetway01 source-scale protection found conflicting aircraft/jetway placement token ${forbidden}`);
}

for (const marker of [
  'sourceDimensionsMeters: Object.freeze([37.92, 8.77, 26.51])',
  'detailLevel: "fsx-air-jetway01-exact-textured-source-scale-articulated-v5"',
  "CRJ_FORWARD_DOOR_AFT_OF_NOSE_GEAR_METERS = 6.25",
  "CRJ_FORWARD_DOOR_LEFT_OF_CENTERLINE_METERS = 1.35",
  "AIR_JETWAY01_CONTACT_CLEARANCE_METERS = 1.58",
  "const sourceFacadeRecessMeters",
  "CLOSED_SERVICE_DOOR_GATES.has(jetway.g)",
  "FACADE_VENT_GATES.has(jetway.g)",
  "group.userData.sourceScaleAuthority",
  "group.userData.jetwayMotionLimits",
  'group.userData.initialJetwayState = "attached-to-aircraft-door"',
]) {
  if (!hasMarker(marker)) {
    const description = Array.isArray(marker) ? marker.join(" or ") : marker;
    throw new Error(`${jetwayPath}: source-scale jetway preparation is missing ${description}`);
  }
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log("Prepared Terminal 4 jetways idempotently from a clean tree: source scale retained, A1 CRJ door/contact geometry unified to the simulator-validated 6.25/1.35/1.58 m authority, and the exact uploaded Airport_Jetway.glb remains authoritative when present.");
