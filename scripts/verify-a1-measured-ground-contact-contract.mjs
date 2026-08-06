import fs from "node:fs";

const files = Object.freeze({
  build: "scripts/build-production-simulator-quality.mjs",
  vertical: "scripts/prepare-a1-inspection-aircraft-vertical-registration-v1.mjs",
  aircraftGround: "scripts/prepare-a1-authored-ground-contact-v1.mjs",
  jetwayGround: "scripts/prepare-a1-exact-bogie-ground-contact-v1.mjs",
  readiness: "scripts/prepare-a1-bogie-readiness-v1.mjs",
  endpointEvidence: "scripts/prepare-a1-endpoint-browser-evidence-v1.mjs",
  dynamicCamera: "scripts/prepare-a1-dynamic-evidence-camera-v1.mjs",
  heading: "scripts/prepare-a1-inspection-aircraft-cab-heading-v1.mjs",
  finalizer: "scripts/prepare-a1-final-acceptance-authority-v1.mjs",
  browser: "tests/browser/a1-ground-contact-evidence.spec.js",
});
const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, fs.readFileSync(path, "utf8")]),
);

function requireTokens(key, tokens) {
  for (const token of tokens) {
    if (!source[key].includes(token)) {
      throw new Error(`${files[key]}: measured A1 ground-contact contract is missing ${token}`);
    }
  }
}

function forbidTokens(key, tokens) {
  for (const token of tokens) {
    if (source[key].includes(token)) {
      throw new Error(`${files[key]}: hidden measured A1 ground-contact side effect remains: ${token}`);
    }
  }
}

const buildStages = [
  'await runNode("scripts/prepare-a1-inspection-aircraft-vertical-registration-v1.mjs")',
  'await runNode("scripts/prepare-a1-exact-bogie-ground-contact-v1.mjs")',
  'await runNode("scripts/prepare-a1-bogie-readiness-v1.mjs")',
  'await runNode("scripts/prepare-a1-authored-ground-contact-v1.mjs")',
  'await runNode("scripts/prepare-a1-endpoint-browser-evidence-v1.mjs")',
  'await runNode("scripts/prepare-a1-final-acceptance-authority-v1.mjs")',
  'await runNode("scripts/prepare-a1-inspection-aircraft-cab-heading-v1.mjs")',
];
let previousIndex = -1;
for (const stage of buildStages) {
  const index = source.build.indexOf(stage);
  if (index <= previousIndex) {
    throw new Error(`${files.build}: measured A1 preparation order is invalid at ${stage}`);
  }
  previousIndex = index;
}

requireTokens("vertical", [
  'const verticalFitAuthority = "grounded-aircraft-door-progressive-tunnel-slope-v1"',
  "const aircraftRelocationY = -landingGearWheelBoundsBefore.min.y",
  "inspectionAircraftJetwayVerticalFitAuthority = \"${verticalFitAuthority}\"",
  "conflicting A1 vertical-fit authority remains",
  "obsolete whole-aircraft bounds grounding remains active",
]);

requireTokens("aircraftGround", [
  "authored-crj-lowest-geometry-contact-clusters-v2",
  "const measureAuthoredLandingGearContact = () =>",
  "contactClusterCount < 3",
  "contactSpan.x < 1",
  "contactSpan.z < 4",
  "const aircraftRelocationY = -landingGearContactBefore.minimumY",
  "const landingGearContactAfter = measureAuthoredLandingGearContact()",
  "inspectionAircraftLandingGearContactClusterCount",
  "obsolete name-based wheel grounding remains",
  "Math.floor(point.x / cellSizeMeters)",
  "const neighbor = [cellX + dx, cellZ + dz].join(\",\")",
]);

requireTokens("jetwayGround", [
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "const measuredBogieGroundOffsetMeters = -authoredA1GroundBoundsBefore.min.y",
  "Math.abs(measuredBogieGroundOffsetMeters) > 0.5",
  "fleet.position.y += measuredBogieGroundOffsetMeters",
  "Math.abs(measuredBogieGroundClearanceMeters) > 0.005",
  "uploadedJetwayBogieGroundContactAuthority",
  "hard-coded fleet ground correction remains active",
]);

requireTokens("readiness", [
  "Math.abs(Math.abs(fleetGroundOffset) - bogieTireCorrection) > 1e-6",
  "Math.abs(bogieGroundClearance) > 0.005",
  "authoredTerminal4UploadedJetwayBogieGroundClearanceMeters",
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  "terminal4UploadedJetwayBogieGroundContactAuthority",
  "obsolete fixed bogie correction range remains",
]);

requireTokens("endpointEvidence", [
  "exact-a1-world-endpoint-browser-evidence-v1",
  "uploadedJetwayA1FinalMeasuredWallWorldX",
  "uploadedJetwayA1FinalRotundaWorldX",
  "uploadedJetwayA1CabContactWorldX",
  "prepare-a1-dynamic-evidence-camera-v1.mjs?exact-endpoint-camera=",
]);

requireTokens("dynamicCamera", [
  "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2",
  "inspectionCameraEndpointAuthority",
  "inspectionOverheadCameraEndpointAuthority",
  "uploadedJetwayA1FinalMeasuredWallWorldX",
  "uploadedJetwayA1FinalRotundaWorldX",
  "uploadedJetwayA1CabContactWorldX",
  "sim.aircraft.userData.realAircraftObject",
  "exactA1CameraAircraftBounds",
  "exactA1CameraFrameBounds",
  "exactA1CameraHorizontalExtent > 20",
  "exactA1OverheadFrameBounds",
  "inspectionCameraEndpointPosition",
  "inspectionCameraEndpointTarget",
  "inspectionCameraEndpointWall",
  "inspectionCameraEndpointRotunda",
  "inspectionCameraEndpointCab",
  "inspectionCameraEndpointAircraftBoundsMin",
  "inspectionCameraEndpointAircraftBoundsMax",
  "inspectionCameraEndpointFrameSize",
  "inspectionOverheadCameraEndpointFrameSize",
]);

requireTokens("heading", [
  "const landingGearContactAfter = measureAuthoredLandingGearContact()",
  "renderedGroundClearanceMeters = landingGearContactAfter.minimumY",
  "yaw-neutral-authored-crj-dimensions-v2",
]);
forbidTokens("heading", [
  "prepare-a1-exact-bogie-ground-contact-v1.mjs?",
  "prepare-a1-bogie-readiness-v1.mjs?",
  "prepare-a1-authored-ground-contact-v1.mjs?",
]);

requireTokens("finalizer", [
  "authored-crj-lowest-geometry-contact-clusters-v2",
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "grounded-aircraft-door-progressive-tunnel-slope-v1",
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  "named-landing-gear-wheel-bounds-v1",
  "grounded-aircraft-wheel-contact-progressive-tunnel-slope-v2",
]);

requireTokens("browser", [
  "A1 evidence proves the supplied jetway and authored CRJ contact the ramp",
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  "inspectionAircraftLandingGearContactClusterCount",
  "inspectionAircraftGroundClearanceMeters",
  "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2",
  "inspectionCameraEndpointAuthority",
  "inspectionCameraEndpointPosition",
  "inspectionCameraEndpointAircraftBoundsMin",
  "inspectionCameraEndpointAircraftBoundsMax",
  "inspectionCameraEndpointFrameSize",
  "aircraftBoundsSize",
  "rotundaWallDistance",
  "a1-measured-ground-contact.png",
  "a1-measured-ground-contact.json",
]);

console.log("Verified the explicit measured A1 jetway/CRJ ground-contact build order, endpoint-and-aircraft-derived camera, authorities, browser publication, and rendered-evidence contract.");
