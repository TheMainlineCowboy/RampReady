import fs from "node:fs";

const files = Object.freeze({
  build: "scripts/build-production-simulator-quality.mjs",
  groundedWall: "scripts/prepare-a1-grounded-terminal-building-v1.mjs",
  wallAuthority: "scripts/prepare-a1-terminal-authority-idempotence-v1.mjs",
  compactWall: "scripts/prepare-a1-compact-source-wall-distance-v1.mjs",
  rigidCompact: "scripts/prepare-a1-rigid-compact-span-v1.mjs",
  completeEndpoint: "scripts/prepare-a1-complete-endpoint-axis-v1.mjs",
  controller: "src/environment/uploadedAirportJetwayModelSpaceControllerV7.js",
  controllerVerifier: "scripts/prepare-uploaded-a1-model-space-retraction-v7.mjs",
  vertical: "scripts/prepare-a1-inspection-aircraft-vertical-registration-v1.mjs",
  aircraftGround: "scripts/prepare-a1-authored-ground-contact-v1.mjs",
  jetwayGround: "scripts/prepare-a1-exact-bogie-ground-contact-v1.mjs",
  readiness: "scripts/prepare-a1-bogie-readiness-v1.mjs",
  readinessCompact: "scripts/prepare-a1-readiness-compact-wall-v1.mjs",
  rotundaClosure: "scripts/prepare-a1-rotunda-vestibule-closure-v1.mjs",
  visualEvidence: "scripts/prepare-a1-visual-acceptance-evidence-v1.mjs",
  finalizer: "scripts/prepare-a1-final-acceptance-authority-v1.mjs",
  lifecycleAnchor: "scripts/prepare-a1-lifecycle-grounded-pose-anchor-v1.mjs",
  heading: "scripts/prepare-a1-inspection-aircraft-cab-heading-v1.mjs",
  browserMigration: "scripts/prepare-current-head-browser-expectations-v1.mjs",
  browser: "tests/browser/a1-ground-contact-evidence.spec.js",
  jetwayBrowser: "tests/browser/a1-jetway-contact-clusters.spec.js",
});
const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, fs.readFileSync(path, "utf8")]),
);

function requireTokens(key, tokens) {
  for (const token of tokens) {
    if (!source[key].includes(token)) {
      throw new Error(`${files[key]}: A1 contract is missing ${token}`);
    }
  }
}

function forbidTokens(key, tokens) {
  for (const token of tokens) {
    if (source[key].includes(token)) {
      throw new Error(`${files[key]}: forbidden A1 behavior remains: ${token}`);
    }
  }
}

const orderedBuildStages = [
  'await runNode("scripts/prepare-a1-terminal-attachment-v14.mjs")',
  'await runNode("scripts/prepare-a1-grounded-terminal-building-v1.mjs")',
  'await runNode("scripts/prepare-a1-terminal-authority-idempotence-v1.mjs")',
  'await runNode("scripts/prepare-a1-photo-registered-stop-v1.mjs")',
  'await runNode("scripts/prepare-a1-compact-source-wall-distance-v1.mjs")',
  'await runNode("scripts/prepare-a1-rigid-parent-orientation-v2.mjs")',
  'await runNode("scripts/prepare-a1-complete-endpoint-axis-v1.mjs")',
  'await runNode("scripts/prepare-a1-terminal-relocation-v4.mjs")',
  'await runNode("scripts/prepare-a1-vector-wall-lock-v1.mjs")',
  'await runNode("scripts/prepare-a1-inspection-aircraft-vertical-registration-v1.mjs")',
  'await runNode("scripts/prepare-a1-exact-bogie-ground-contact-v1.mjs")',
  'await runNode("scripts/prepare-a1-bogie-readiness-v1.mjs")',
  'await runNode("scripts/prepare-a1-authored-ground-contact-v1.mjs")',
  'await runNode("scripts/prepare-a1-rotunda-vestibule-closure-v1.mjs")',
  'await runNode("scripts/prepare-a1-final-acceptance-authority-v1.mjs")',
  'await runNode("scripts/prepare-a1-inspection-aircraft-cab-heading-v1.mjs")',
];
let previousIndex = -1;
for (const stage of orderedBuildStages) {
  const index = source.build.indexOf(stage);
  if (index <= previousIndex) throw new Error(`${files.build}: invalid A1 build order at ${stage}`);
  previousIndex = index;
}

requireTokens("groundedWall", [
  "A1 ramp-level real Terminal 4 source wall v32",
  "const groundedConnection = findTerminalWallConnection(",
  "groundedConnection.distance > 3.4",
  "groundedConnection.distance < 28",
  "groundedConnection.pointY > 2.2",
  "BGATE|DGATE|PHX_TERM400",
  "rampLevelRealTerminalWall: true",
  "finalVisibleVestibuleCheckedAfterRelocation: true",
  "forbidden A1 walkway anchor survived",
]);
requireTokens("wallAuthority", [
  "compact-grounded-A1-authority-idempotence-v31",
  "A1 compact grounded wall returned a forbidden authority",
  "structural-A1-terminal-building-${groundedStructuralAuthority}-v31",
]);
requireTokens("compactWall", [
  "const SOURCE_WALL_MINIMUM_METERS = 3.4",
  "const SOURCE_WALL_MAXIMUM_METERS = 28",
  "const FINAL_VISIBLE_VESTIBULE_METERS = 2.4",
  "A1 ramp-level real-terminal source distance is invalid",
  "sourceRotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  "const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius",
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05",
  "source/final A1 wall measurements are still conflated",
]);
requireTokens("rigidCompact", [
  "post-rigid-a1-exact-visible-vestibule-span-v1",
  "terminalDistance < rotundaOpening.collarRadius + 4.1",
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05",
  "broad A1 terminal span survived rigid orientation",
]);
requireTokens("completeEndpoint", [
  "prepare-a1-rigid-compact-span-v1.mjs?post-rigid=",
  "same-day-photo-complete-cab-to-rotunda-parent-axis-v6",
  "post-rigid-a1-exact-visible-vestibule-span-v1",
]);

requireTokens("controller", [
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
  "requestedAttachedVerticalDropMeters",
  "attachedVerticalDropMeters = 0",
  "authoredBogieGroundPreserved = true",
  "setAttachedVerticalDrop(value)",
  "return 0",
  "retract * retraction.lift",
]);
forbidTokens("controller", [
  "const attachedDrop = deployment * attachedVerticalDrop",
  "attachedDrop / 3",
  "attachedDrop * 2 / 3",
  "attachedDrop + retract * retraction.lift",
]);
requireTokens("controllerVerifier", [
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
  "floating-bogie child-lift behavior remains",
]);

requireTokens("vertical", [
  'const verticalFitAuthority = "grounded-jetway-door-gap-reported-no-child-lift-v1"',
  "Math.abs(appliedA1JetwayVerticalFitMeters) > 0.001",
  "inspectionAircraftDoorSignedVerticalGapMeters",
  "inspectionAircraftJetwayRequestedVerticalFitMeters",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "Cab telemetry is still being moved to conceal the door-height gap",
]);
requireTokens("aircraftGround", [
  "authored-crj-lowest-geometry-contact-clusters-v2",
  "const measureAuthoredLandingGearContact = () =>",
  "contactClusterCount < 3",
  "contactSpan.x < 1",
  "contactSpan.z < 4",
  "const aircraftRelocationY = -landingGearContactBefore.minimumY",
]);
requireTokens("jetwayGround", [
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "const measureAuthoredA1RampContact = () =>",
  "contactPointCount < 8",
  "contactClusterCount < 2",
  "horizontalContactSpanMeters < 1.2",
  "const measuredBogieGroundOffsetMeters = -authoredA1GroundContactBefore.minimumY",
  "Math.abs(measuredBogieGroundClearanceMeters) > 0.005",
  "uploadedJetwayBogieGroundContactClusterCount",
]);
requireTokens("readiness", [
  "bogieGroundContactPointCount < 8",
  "bogieGroundContactClusterCount < 2",
  "bogieGroundHorizontalContactSpan < 1.2",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
]);
requireTokens("readinessCompact", [
  "compact-real-terminal-wall-readiness-v1",
  "a1TerminalWallDistance > 1.5 && a1TerminalWallDistance < 4.1",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
]);

requireTokens("rotundaClosure", [
  "UploadedAirportJetwayA1RotundaVestibuleClosurePanel",
  "connector.userData.apronFacingRotundaOpeningClosed = true",
  "prepare-a1-readiness-compact-wall-v1.mjs?compact-readiness=",
  "prepare-a1-visual-acceptance-evidence-v1.mjs?visual-acceptance=",
]);
requireTokens("visualEvidence", [
  "same-day-a1-continuous-compact-solid-closed-grounded-v1",
  "exact-authored-five-part-chain-no-isolated-node-rotation-v2",
  "const VISIBLE_VESTIBULE_METERS = 2.4",
  "Math.abs(connectorVisibleLength - ${VISIBLE_VESTIBULE_METERS}) > 0.05",
  "isolatedNodeRotationCount !== 0",
  "uploadedJetwayA1NoGeneratedGlassCorridor",
]);
requireTokens("finalizer", [
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
  "inspectionAircraftDoorSignedVerticalGapMeters",
  "inspectionAircraftJetwayRequestedVerticalFitMeters",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "same-day-a1-continuous-compact-solid-closed-grounded-v1",
  "prepare-a1-lifecycle-grounded-pose-anchor-v1.mjs?grounded-pose=",
  "stale A1 grounding, child lift, or pose behavior survived finalization",
]);
requireTokens("lifecycleAnchor", [
  "grounded-a1-training-pose-before-inspection-registration-v1",
  "const trainingAircraftPoseBeforeInspectionRegistration =",
  "sim.aircraft.position.y += aircraftRelocationY",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
]);
requireTokens("heading", [
  "const landingGearContactAfter = measureAuthoredLandingGearContact()",
  "prepare-a1-final-marker-compat-v1.mjs?final-marker=",
  "prepare-current-head-browser-expectations-v1.mjs?current-head=",
  "prepare-a1-no-lift-evidence-json-v1.mjs?no-lift-evidence=",
]);
requireTokens("browserMigration", [
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
  "inspectionAircraftDoorSignedVerticalGapMeters",
  "inspectionAircraftJetwayRequestedVerticalFitMeters",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "stale floating-jetway vertical-fit expectation remains",
]);

requireTokens("browser", [
  "A1 evidence proves the continuous supplied jetway, compact closed vestibule and authored CRJ contact the ramp",
  "a1-measured-ground-contact.png",
  "a1-measured-ground-contact-overhead.png",
  "a1-measured-ground-contact.json",
]);
requireTokens("jetwayBrowser", [
  "A1 authored jetway uses a compact real-terminal anchor and a separated multi-point ramp footprint",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
  "WALK|JETWAY|CONNECTOR|PORTAL",
  "a1-jetway-contact-clusters.json",
]);

console.log("Verified the A1 repair contract: a ramp-level structural source wall distinct from the final exact 2.4 m vestibule, no T4_WALK authority, complete-parent relocation, continuous authored assembly, separated multi-point jetway/CRJ ramp contact, zero attached child lift, retained signed door gap, grounded lifecycle pose, and current-head visual evidence.");
