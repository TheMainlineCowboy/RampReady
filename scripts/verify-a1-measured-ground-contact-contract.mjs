import fs from "node:fs";

const files = Object.freeze({
  build: "scripts/build-production-simulator-quality.mjs",
  groundedWall: "scripts/prepare-a1-grounded-terminal-building-v1.mjs",
  wallAuthority: "scripts/prepare-a1-terminal-authority-idempotence-v1.mjs",
  photoRegistration: "scripts/prepare-a1-photo-registered-stop-v1.mjs",
  sourceFinalWall: "scripts/prepare-a1-compact-source-wall-distance-v1.mjs",
  rigidCompact: "scripts/prepare-a1-rigid-compact-span-v1.mjs",
  endpointAxis: "scripts/prepare-a1-complete-endpoint-axis-v1.mjs",
  controller: "src/environment/uploadedAirportJetwayModelSpaceControllerV7.js",
  controllerVerifier: "scripts/prepare-uploaded-a1-model-space-retraction-v7.mjs",
  vertical: "scripts/prepare-a1-inspection-aircraft-vertical-registration-v1.mjs",
  aircraftGround: "scripts/prepare-a1-authored-ground-contact-v1.mjs",
  jetwayGround: "scripts/prepare-a1-exact-bogie-ground-contact-v1.mjs",
  readiness: "scripts/prepare-a1-bogie-readiness-v1.mjs",
  finalDistance: "scripts/prepare-a1-readiness-compact-wall-v1.mjs",
  closure: "scripts/prepare-a1-rotunda-vestibule-closure-v1.mjs",
  visual: "scripts/prepare-a1-visual-acceptance-evidence-v1.mjs",
  endpointEvidence: "scripts/prepare-a1-endpoint-browser-evidence-v1.mjs",
  finalizer: "scripts/prepare-a1-final-acceptance-authority-v1.mjs",
  lifecycleAnchor: "scripts/prepare-a1-lifecycle-grounded-pose-anchor-v1.mjs",
  heading: "scripts/prepare-a1-inspection-aircraft-cab-heading-v1.mjs",
  browserMigration: "scripts/prepare-current-head-browser-expectations-v1.mjs",
  groundEvidence: "tests/browser/a1-ground-contact-evidence.spec.js",
  contactEvidence: "tests/browser/a1-jetway-contact-clusters.spec.js",
  closeEvidence: "tests/browser/a1-terminal-joint-bogie-subviews.spec.js",
});

const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, fs.readFileSync(path, "utf8")]),
);

function requireTokens(key, tokens) {
  for (const token of tokens) {
    if (!source[key].includes(token)) {
      throw new Error(`${files[key]}: current A1 repair contract is missing ${token}`);
    }
  }
}

function forbidRuntimeTokens(key, tokens) {
  for (const token of tokens) {
    if (source[key].includes(token)) {
      throw new Error(`${files[key]}: forbidden runtime A1 behavior remains: ${token}`);
    }
  }
}

const orderedBuildStages = [
  "prepare-a1-terminal-attachment-v14.mjs",
  "prepare-a1-grounded-terminal-building-v1.mjs",
  "prepare-a1-terminal-authority-idempotence-v1.mjs",
  "prepare-a1-photo-registered-stop-v1.mjs",
  "prepare-a1-compact-source-wall-distance-v1.mjs",
  "prepare-a1-rigid-parent-orientation-v2.mjs",
  "prepare-a1-complete-endpoint-axis-v1.mjs",
  "prepare-a1-terminal-relocation-v4.mjs",
  "prepare-a1-vector-wall-lock-v1.mjs",
  "prepare-a1-inspection-aircraft-vertical-registration-v1.mjs",
  "prepare-a1-exact-bogie-ground-contact-v1.mjs",
  "prepare-a1-bogie-readiness-v1.mjs",
  "prepare-a1-authored-ground-contact-v1.mjs",
  "prepare-a1-endpoint-browser-evidence-v1.mjs",
  "prepare-a1-rotunda-vestibule-closure-v1.mjs",
  "prepare-static-jetway-portal-closures-v1.mjs",
  "prepare-a1-final-acceptance-authority-v1.mjs",
  "prepare-a1-inspection-aircraft-cab-heading-v1.mjs",
];
let previous = -1;
for (const stage of orderedBuildStages) {
  const index = source.build.indexOf(`await runNode("scripts/${stage}")`);
  if (index <= previous) throw new Error(`${files.build}: A1 build order is invalid at ${stage}`);
  previous = index;
}

// These are migration scripts, so legacy text may appear only as a replacement
// anchor. Verify that each script also contains a fail-closed generated-output
// check rather than treating the cleanup vocabulary itself as runtime behavior.
requireTokens("groundedWall", [
  "A1 ramp-level real Terminal 4 source wall v32",
  "const MINIMUM_A1_SOURCE_WALL_DISTANCE_METERS = 3.4",
  "const MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS = 28",
  "const MAXIMUM_A1_WALL_HEIGHT_METERS = 2.2",
  "groundedConnection.distance > ${MINIMUM_A1_SOURCE_WALL_DISTANCE_METERS}",
  "groundedConnection.distance < ${MAXIMUM_A1_SOURCE_WALL_DISTANCE_METERS}",
  "groundedConnection.pointY > ${MAXIMUM_A1_WALL_HEIGHT_METERS}",
  "BGATE|DGATE|PHX_TERM400",
  "rampLevelRealTerminalWall: true",
  "finalVisibleVestibuleCheckedAfterRelocation: true",
  "const forbiddenWalkwayAuthority",
  "const forbiddenWalkwayPortalVariable",
  "forbidden A1 walkway anchor survived grounded-terminal preparation",
]);
requireTokens("wallAuthority", [
  "compact-grounded-A1-authority-idempotence-v31",
  "const legacyStructuralMembership",
  "const forbiddenWalkwayAuthority",
  "A1 compact grounded wall returned a forbidden authority",
  "structural-A1-terminal-building-${groundedStructuralAuthority}-v31",
  "stale or forbidden A1 authority behavior remains",
]);

requireTokens("photoRegistration", [
  "const sourceTerminalDistance = Number(a1Placement.wallConnectorLength)",
  "const terminalDistance = sourceRotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  "a1Anchor.position.x += relocationX",
  "a1Anchor.position.z += relocationZ",
  "const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius",
]);
requireTokens("sourceFinalWall", [
  "const SOURCE_WALL_MINIMUM_METERS = 3.4",
  "const SOURCE_WALL_MAXIMUM_METERS = 28",
  "const FINAL_VISIBLE_VESTIBULE_METERS = 2.4",
  "sourceTerminalDistance > ${SOURCE_WALL_MINIMUM_METERS}",
  "sourceTerminalDistance < ${SOURCE_WALL_MAXIMUM_METERS}",
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05",
  "source/final A1 wall measurements are still conflated",
]);
requireTokens("rigidCompact", [
  "post-rigid-a1-exact-visible-vestibule-span-v1",
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05",
  "terminalDistance < rotundaOpening.collarRadius + 4.1",
]);
requireTokens("endpointAxis", [
  "prepare-a1-rigid-compact-span-v1.mjs?post-rigid=",
  "same-day-photo-complete-cab-to-rotunda-parent-axis-v6",
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
forbidRuntimeTokens("controller", [
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
  "const staleVerticalFitAuthorities",
  "for (const stale of staleVerticalFitAuthorities)",
  "Math.abs(appliedA1JetwayVerticalFitMeters) > 0.001",
  "inspectionAircraftDoorSignedVerticalGapMeters",
  "inspectionAircraftJetwayRequestedVerticalFitMeters",
  "inspectionAircraftJetwayVerticalFitMeters",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "stale A1 child-lift authority remains",
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
requireTokens("finalDistance", [
  "compact-real-terminal-wall-readiness-v2",
  "const FINAL_CENTER_TO_WALL_MINIMUM_METERS = 2.9",
  "const FINAL_CENTER_TO_WALL_MAXIMUM_METERS = 5.8",
  "a1TerminalWallDistance > ${FINAL_CENTER_TO_WALL_MINIMUM_METERS} && a1TerminalWallDistance < ${FINAL_CENTER_TO_WALL_MAXIMUM_METERS}",
  "connectorVisibleLength > 0.25 && connectorVisibleLength < 12",
]);

requireTokens("closure", [
  "UploadedAirportJetwayA1RotundaVestibuleClosurePanel",
  "connector.userData.apronFacingRotundaOpeningClosed = true",
  "prepare-a1-readiness-compact-wall-v1.mjs?compact-readiness=",
  "prepare-a1-visual-acceptance-evidence-v1.mjs?visual-acceptance=",
]);
requireTokens("visual", [
  "same-day-a1-continuous-compact-solid-closed-grounded-v1",
  "exact-authored-five-part-chain-no-isolated-node-rotation-v2",
  "const VISIBLE_VESTIBULE_METERS = 2.4",
  "Math.abs(connectorVisibleLength - ${VISIBLE_VESTIBULE_METERS}) > 0.05",
  "isolatedNodeRotationCount !== 0",
  "uploadedJetwayA1NoGeneratedGlassCorridor",
]);
requireTokens("endpointEvidence", [
  "prepare-a1-dynamic-evidence-camera-v1.mjs?exact-endpoint-camera=",
  "prepare-a1-evidence-subviews-v1.mjs?exact-evidence-subviews=",
  "prepare-a1-evidence-camera-lock-v1.mjs?exact-camera-lock=",
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
]);
requireTokens("lifecycleAnchor", [
  "grounded-a1-training-pose-before-inspection-registration-v1",
  "const trainingAircraftPoseBeforeInspectionRegistration =",
  "sim.aircraft.position.y += aircraftRelocationY",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
]);
requireTokens("heading", [
  "prepare-a1-final-marker-compat-v1.mjs?final-marker=",
  "prepare-current-head-browser-expectations-v1.mjs?current-head=",
  "prepare-a1-no-lift-evidence-json-v1.mjs?no-lift-evidence=",
]);
requireTokens("browserMigration", [
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
  "inspectionAircraftDoorSignedVerticalGapMeters",
  "inspectionAircraftJetwayRequestedVerticalFitMeters",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "expect(a1WallDistance).toBeGreaterThan(1.5)",
  "expect(a1WallDistance).toBeLessThan(4.0)",
]);

requireTokens("groundEvidence", [
  "a1-measured-ground-contact.png",
  "a1-measured-ground-contact-overhead.png",
  "a1-measured-ground-contact.json",
]);
requireTokens("contactEvidence", [
  "A1 authored jetway uses an exact 2.4 m real-terminal vestibule and a separated multi-point ramp footprint",
  "centerToWallDistance > 2.9",
  "centerToWallDistance < 5.8",
  "Math.abs(visibleVestibuleLength - 2.4) <= 0.05",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "WALK|JETWAY|CONNECTOR|PORTAL",
  "a1-jetway-contact-clusters.json",
]);
requireTokens("closeEvidence", [
  "A1 close evidence shows the exact 2.4 m terminal vestibule and zero-lift grounded bogie",
  "centerToWallDistance > 2.9",
  "centerToWallDistance < 5.8",
  "a1-terminal-joint-close.png",
  "a1-bogie-contact-close.png",
]);

console.log("Verified staged A1 repair contracts: ramp-level real wall migration, exact 2.4 m visible vestibule, continuous five-part authored assembly, closed apron side, separated multi-point jetway/CRJ contact, zero attached child lift, retained signed door gap, grounded lifecycle pose, and close/full browser evidence without confusing migration anchors for runtime regressions.");
