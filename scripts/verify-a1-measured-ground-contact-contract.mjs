import fs from "node:fs";

const files = Object.freeze({
  build: "scripts/build-production-simulator-quality.mjs",
  groundedWall: "scripts/prepare-a1-grounded-terminal-building-v1.mjs",
  wallAuthority: "scripts/prepare-a1-terminal-authority-idempotence-v1.mjs",
  relocation: "scripts/prepare-a1-terminal-relocation-v4.mjs",
  controller: "src/environment/uploadedAirportJetwayModelSpaceControllerV7.js",
  vertical: "scripts/prepare-a1-inspection-aircraft-vertical-registration-v1.mjs",
  jetwayGround: "scripts/prepare-a1-exact-bogie-ground-contact-v1.mjs",
  readiness: "scripts/prepare-a1-bogie-readiness-v1.mjs",
  subviews: "scripts/prepare-a1-evidence-subviews-v1.mjs",
  endpointEvidence: "scripts/prepare-a1-endpoint-browser-evidence-v1.mjs",
  finalizer: "scripts/prepare-a1-final-acceptance-authority-v1.mjs",
  lifecycleAnchor: "scripts/prepare-a1-lifecycle-grounded-pose-anchor-v1.mjs",
  heading: "scripts/prepare-a1-inspection-aircraft-cab-heading-v1.mjs",
  browserAuthority: "scripts/prepare-a1-bogie-centroid-browser-authority-v1.mjs",
  contactEvidence: "tests/browser/a1-jetway-contact-clusters.spec.js",
  closeEvidence: "tests/browser/a1-terminal-joint-bogie-subviews.spec.js",
});

const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, fs.readFileSync(path, "utf8")]),
);

function requireTokens(key, tokens) {
  for (const token of tokens) {
    if (!source[key].includes(token)) {
      throw new Error(`${files[key]}: current A1 contract is missing ${token}`);
    }
  }
}

function forbidTokens(key, tokens) {
  for (const token of tokens) {
    if (source[key].includes(token)) {
      throw new Error(`${files[key]}: forbidden current A1 behavior remains: ${token}`);
    }
  }
}

const orderedBuildStages = [
  "prepare-a1-grounded-terminal-building-v1.mjs",
  "prepare-a1-terminal-authority-idempotence-v1.mjs",
  "prepare-a1-terminal-relocation-v4.mjs",
  "prepare-a1-inspection-aircraft-vertical-registration-v1.mjs",
  "prepare-a1-exact-bogie-ground-contact-v1.mjs",
  "prepare-a1-bogie-readiness-v1.mjs",
  "prepare-a1-endpoint-browser-evidence-v1.mjs",
  "prepare-static-jetway-portal-closures-v1.mjs",
  "prepare-a1-final-acceptance-authority-v1.mjs",
  "prepare-a1-inspection-aircraft-cab-heading-v1.mjs",
];
let previous = -1;
for (const stage of orderedBuildStages) {
  const index = source.build.indexOf(`await runNode("scripts/${stage}")`);
  if (index <= previous) {
    throw new Error(`${files.build}: current A1 build order is invalid at ${stage}`);
  }
  previous = index;
}

requireTokens("groundedWall", [
  "A1 ramp-level real Terminal 4 source wall v32",
  "const MINIMUM_A1_SOURCE_WALL_DISTANCE_METERS = 3.4",
  "const MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS = 28",
  "const MAXIMUM_A1_WALL_HEIGHT_METERS = 2.2",
  "rampLevelRealTerminalWall: true",
  "finalVisibleVestibuleCheckedAfterRelocation: true",
  "forbidden A1 walkway anchor survived grounded-terminal preparation",
]);
requireTokens("wallAuthority", [
  "compact-grounded-A1-authority-idempotence-v31",
  "expected exactly one block-scoped grounded A1 assignment",
  "grounded A1 authority output must contain one assignment and one validator",
  "A1 compact grounded wall returned a forbidden authority",
]);

requireTokens("relocation", [
  "const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius",
  "terminal relocation must retain exactly one visible-vestibule declaration",
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05",
]);

requireTokens("controller", [
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
  "requestedAttachedVerticalDropMeters",
  "attachedVerticalDropMeters = 0",
  "authoredBogieGroundPreserved = true",
  "setAttachedVerticalDrop(value)",
  "return 0",
]);
forbidTokens("controller", [
  "const attachedDrop = deployment * attachedVerticalDrop",
  "attachedDrop / 3",
  "attachedDrop * 2 / 3",
]);
requireTokens("vertical", [
  'const verticalFitAuthority = "grounded-jetway-door-gap-reported-no-child-lift-v1"',
  "inspectionAircraftDoorSignedVerticalGapMeters",
  "inspectionAircraftJetwayRequestedVerticalFitMeters",
  "inspectionAircraftJetwayVerticalFitMeters",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "Math.abs(appliedA1JetwayVerticalFitMeters) > 0.001",
]);

requireTokens("jetwayGround", [
  'exact-authored-a1-lowest-geometry-ramp-contact-v2',
  'const measureAuthoredA1RampContact = (coordinateSpace = "fleet-parent") =>',
  'coordinateSpace !== "fleet-parent" && coordinateSpace !== "world"',
  "const fleetParentWorldInverse = new THREE.Matrix4()",
  'if (coordinateSpace === "fleet-parent") point.applyMatrix4(fleetParentWorldInverse)',
  'measureAuthoredA1RampContact("fleet-parent")',
  'measureAuthoredA1RampContact("world")',
  "const measuredBogieGroundOffsetMeters = -authoredA1GroundContactBefore.minimumY",
  "Math.abs(measuredBogieGroundOffsetMeters) > 3",
  "const measuredBogieGroundClearanceMeters = authoredA1GroundContactAfter.minimumY",
  "Math.abs(measuredBogieGroundClearanceMeters) > 0.005",
  "const authoredA1GroundContactWorldAfter = measureAuthoredA1RampContact",
  "bogieGroundContactCenterX: authoredA1GroundContactWorldAfter.centerX",
  "parent-local contact center is still being published as a world camera target",
]);
forbidTokens("jetwayGround", [
  "fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS",
  "bogieGroundContactCenterX: authoredA1GroundContactAfter.centerX",
]);

requireTokens("readiness", [
  'exact-authored-a1-lowest-geometry-ramp-contact-v2',
  "bogieGroundContactPointCount < 8",
  "bogieGroundContactClusterCount < 2",
  "bogieGroundHorizontalContactSpan < 1.2",
  "!Number.isFinite(bogieGroundContactCenterX)",
  "authoredTerminal4UploadedJetwayBogieGroundContactCenterX",
  "terminal4UploadedJetwayBogieGroundContactCenterX",
  "terminal4UploadedJetwayBogieGroundContactCenterY",
  "terminal4UploadedJetwayBogieGroundContactCenterZ",
]);

requireTokens("endpointEvidence", [
  "prepare-a1-dynamic-evidence-camera-v1.mjs?exact-endpoint-camera=",
  "prepare-a1-evidence-subviews-v1.mjs?exact-evidence-subviews=",
  "prepare-a1-evidence-camera-lock-v1.mjs?exact-camera-lock=",
]);
requireTokens("subviews", [
  'exactA1EvidenceSubview === "terminal-joint"',
  'exactA1EvidenceSubview === "bogie-contact"',
  "const exactA1JointCenterX",
  "const exactA1JointSpan",
  "const exactA1BogieContactX",
  "uploadedJetwayBogieGroundContactCenterX",
  "inspectionCameraEndpointJointCenter",
  "inspectionCameraEndpointJointSpanMeters",
  "inspectionCameraEndpointBogieContactCenter",
]);
const obsoleteCabGuess = "exactA1CameraCabX - exactA1CameraApronX * " + "6";
const obsoleteWideApron = "exactA1CameraApronX * " + "8";
const obsoleteWideSide = "exactA1CameraSideSign * " + "12";
forbidTokens("subviews", [obsoleteCabGuess, obsoleteWideApron, obsoleteWideSide]);

requireTokens("finalizer", [
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
  "terminal4UploadedJetwayBogieGroundContactCenterX",
  "terminal4UploadedJetwayBogieGroundContactCenterY",
  "terminal4UploadedJetwayBogieGroundContactCenterZ",
  "terminal4UploadedJetwayA1VisibleVestibuleLengthMeters",
  "terminal4UploadedJetwayA1VisualAcceptanceAuthority",
]);
requireTokens("lifecycleAnchor", [
  "grounded-a1-training-pose-before-inspection-registration-v1",
  "const trainingAircraftPoseBeforeInspectionRegistration =",
  "sim.aircraft.position.y += aircraftRelocationY",
]);
requireTokens("heading", [
  "prepare-current-head-browser-expectations-v1.mjs?current-head=",
  "prepare-a1-post-lifecycle-evidence-v1.mjs?post-lifecycle-evidence=",
  "prepare-a1-bogie-centroid-browser-authority-v1.mjs?bogie-centroid=",
]);
requireTokens("browserAuthority", [
  'legacyAuthority = "exact-authored-a1-lowest-geometry-ramp-contact-v1"',
  'centroidAuthority = "exact-authored-a1-lowest-geometry-ramp-contact-v2"',
  "legacy bogie ground authority remains after centroid migration",
]);

requireTokens("contactEvidence", [
  "A1 authored jetway uses an exact 2.4 m real-terminal vestibule and a separated multi-point ramp footprint",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "a1-jetway-contact-clusters.json",
]);
requireTokens("closeEvidence", [
  "A1 close evidence shows the exact 2.4 m terminal vestibule and zero-lift grounded bogie",
  "inspectionCameraEndpointJointCenter",
  "inspectionCameraEndpointBogieContactCenter",
  "distance3(terminalCameraTarget, terminalJointCenter)",
  "distance3(bogieContactCenter, publishedBogieContactCenter)",
  "a1-terminal-joint-close.png",
  "a1-bogie-contact-close.png",
]);

console.log("Verified the current A1 repair chain: real ramp-level wall, one scoped 2.4 m vestibule, zero attached lift, parent-local ground clearance, separately measured world-space bogie centroid, exact targeted close cameras, grounded lifecycle pose, and strict browser evidence.");
