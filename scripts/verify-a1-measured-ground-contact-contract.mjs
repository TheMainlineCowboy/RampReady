import fs from "node:fs";

const files = Object.freeze({
  build: "scripts/build-production-simulator-quality.mjs",
  groundedWall: "scripts/prepare-a1-grounded-terminal-building-v1.mjs",
  compactWall: "scripts/prepare-a1-compact-source-wall-distance-v1.mjs",
  vertical: "scripts/prepare-a1-inspection-aircraft-vertical-registration-v1.mjs",
  aircraftGround: "scripts/prepare-a1-authored-ground-contact-v1.mjs",
  jetwayGround: "scripts/prepare-a1-exact-bogie-ground-contact-v1.mjs",
  readiness: "scripts/prepare-a1-bogie-readiness-v1.mjs",
  endpointEvidence: "scripts/prepare-a1-endpoint-browser-evidence-v1.mjs",
  dynamicCamera: "scripts/prepare-a1-dynamic-evidence-camera-v1.mjs",
  cameraLock: "scripts/prepare-a1-evidence-camera-lock-v1.mjs",
  rotundaClosure: "scripts/prepare-a1-rotunda-vestibule-closure-v1.mjs",
  visualEvidence: "scripts/prepare-a1-visual-acceptance-evidence-v1.mjs",
  heading: "scripts/prepare-a1-inspection-aircraft-cab-heading-v1.mjs",
  finalizer: "scripts/prepare-a1-final-acceptance-authority-v1.mjs",
  browser: "tests/browser/a1-ground-contact-evidence.spec.js",
  jetwayBrowser: "tests/browser/a1-jetway-contact-clusters.spec.js",
});
const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, fs.readFileSync(path, "utf8")]),
);

function requireTokens(key, tokens) {
  for (const token of tokens) {
    if (!source[key].includes(token)) {
      throw new Error(`${files[key]}: measured A1 acceptance contract is missing ${token}`);
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

const buildStages = [
  'await runNode("scripts/prepare-a1-grounded-terminal-building-v1.mjs")',
  'await runNode("scripts/prepare-a1-compact-source-wall-distance-v1.mjs")',
  'await runNode("scripts/prepare-a1-inspection-aircraft-vertical-registration-v1.mjs")',
  'await runNode("scripts/prepare-a1-exact-bogie-ground-contact-v1.mjs")',
  'await runNode("scripts/prepare-a1-bogie-readiness-v1.mjs")',
  'await runNode("scripts/prepare-a1-authored-ground-contact-v1.mjs")',
  'await runNode("scripts/prepare-a1-endpoint-browser-evidence-v1.mjs")',
  'await runNode("scripts/prepare-a1-rotunda-vestibule-closure-v1.mjs")',
  'await runNode("scripts/prepare-a1-final-acceptance-authority-v1.mjs")',
  'await runNode("scripts/prepare-a1-inspection-aircraft-cab-heading-v1.mjs")',
];
let previousIndex = -1;
for (const stage of buildStages) {
  const index = source.build.indexOf(stage);
  if (index <= previousIndex) {
    throw new Error(`${files.build}: A1 preparation order is invalid at ${stage}`);
  }
  previousIndex = index;
}

requireTokens("groundedWall", [
  "A1 compact grounded Terminal 4 building connection v31",
  "const groundedConnection = findTerminalWallConnection(",
  "groundedConnection.distance > 1.5",
  "groundedConnection.distance < 4.1",
  "groundedConnection.pointY > 2.2",
  "A1 grounded real-terminal wall span is not compact",
  "compactRealTerminalWall: true",
  "BGATE|DGATE|PHX_TERM400",
  "exact-T4_WALK-A1-terminal-portal-v25",
  "exactWalkwayPortalX",
]);

requireTokens("compactWall", [
  "const MINIMUM_A1_WALL_SPAN_METERS = 1.5",
  "const MAXIMUM_A1_WALL_SPAN_METERS = 4.1",
  "A1 measured real-terminal wall span is not compact",
  "sourceRotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  "long A1 corridor allowance remains",
]);

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
  "const measureAuthoredA1RampContact = () =>",
  "contactPointCount < 8",
  "contactClusterCount < 2",
  "horizontalContactSpanMeters < 1.2",
  "const measuredBogieGroundOffsetMeters = -authoredA1GroundContactBefore.minimumY",
  "Math.abs(measuredBogieGroundOffsetMeters) > 3",
  "fleet.position.y += measuredBogieGroundOffsetMeters",
  "const measuredBogieGroundClearanceMeters = authoredA1GroundContactAfter.minimumY",
  "bogieGroundContactClusterCount: authoredA1GroundContactAfter.contactClusterCount",
  "uploadedJetwayBogieGroundContactPointCount",
  "uploadedJetwayBogieGroundContactClusterCount",
  "uploadedJetwayBogieGroundHorizontalContactSpanMeters",
  "hard-coded fleet ground correction remains active",
]);

requireTokens("readiness", [
  "Math.abs(Math.abs(fleetGroundOffset) - bogieTireCorrection) > 1e-6",
  "Math.abs(fleetGroundOffset) > 3",
  "Math.abs(bogieGroundClearance) > 0.005",
  "bogieGroundContactPointCount < 8",
  "bogieGroundContactClusterCount < 2",
  "bogieGroundHorizontalContactSpan < 1.2",
  "authoredTerminal4UploadedJetwayBogieGroundContactClusterCount",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
  "obsolete fixed bogie correction range remains",
]);

requireTokens("endpointEvidence", [
  "exact-a1-world-endpoint-browser-evidence-v1",
  "uploadedJetwayA1FinalMeasuredWallWorldX",
  "uploadedJetwayA1FinalRotundaWorldX",
  "uploadedJetwayA1CabContactWorldX",
  "prepare-a1-dynamic-evidence-camera-v1.mjs?exact-endpoint-camera=",
  "prepare-a1-evidence-camera-lock-v1.mjs?exact-camera-lock=",
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

requireTokens("cameraLock", [
  "exact-a1-evidence-camera-direct-lock-v1",
  "camera.position.copy(desiredCamera)",
  "inspectionCameraEndpointLockAuthority",
  "inspectionCameraEndpointConvergenceErrorMeters",
  "inspectionOverheadCameraEndpointLockAuthority",
  "inspectionOverheadCameraEndpointConvergenceErrorMeters",
  "distanceTo(desiredCamera).toFixed(6)",
  "endpoint-derived perspective camera interpolation block is missing",
  "endpoint-derived overhead camera interpolation block is missing",
]);

requireTokens("rotundaClosure", [
  "UploadedAirportJetwayA1RotundaVestibuleClosurePanel",
  "connector.userData.apronFacingRotundaOpeningClosed = true",
  "same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1",
  "prepare-a1-visual-acceptance-evidence-v1.mjs?visual-acceptance=",
]);

requireTokens("visualEvidence", [
  "same-day-a1-continuous-compact-solid-closed-grounded-v1",
  "exact-authored-five-part-chain-no-isolated-node-rotation-v2",
  "same-day-a1-photo-visible-solid-terminal-vestibule-v12",
  "exact-authored-opposite-rotunda-to-tunnel-a-axis-v5",
  "same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1",
  "const VISIBLE_VESTIBULE_METERS = 2.4",
  "Math.abs(connectorVisibleLength - ${VISIBLE_VESTIBULE_METERS}) > 0.05",
  "isolatedNodeRotationCount !== 0",
  "uploadedJetwayA1ApronFacingRotundaOpeningClosed",
  "uploadedJetwayA1NoGeneratedGlassCorridor",
  "authoredTerminal4UploadedJetwayA1VisualAcceptanceAuthority",
  "terminal4UploadedJetwayA1VisibleVestibuleLengthMeters",
  "terminal4UploadedJetwayA1RotundaVestibuleClosureAuthority",
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
  "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2",
  "exact-a1-evidence-camera-direct-lock-v1",
  "same-day-a1-continuous-compact-solid-closed-grounded-v1",
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  "terminal4UploadedJetwayA1AssemblyContinuityAuthority",
  "terminal4UploadedJetwayA1VisibleVestibuleLengthMeters",
  "terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed",
  "terminal4UploadedJetwayA1NoGeneratedGlassCorridor",
  "inspectionCameraEndpointLockAuthority",
  "inspectionCameraEndpointConvergenceErrorMeters",
  "inspectionOverheadCameraEndpointLockAuthority",
  "inspectionOverheadCameraEndpointConvergenceErrorMeters",
  "named-landing-gear-wheel-bounds-v1",
  "grounded-aircraft-wheel-contact-progressive-tunnel-slope-v2",
]);

requireTokens("browser", [
  "A1 evidence proves the continuous supplied jetway, compact closed vestibule and authored CRJ contact the ramp",
  "same-day-a1-continuous-compact-solid-closed-grounded-v1",
  "exact-authored-five-part-chain-no-isolated-node-rotation-v2",
  "same-day-a1-photo-visible-solid-terminal-vestibule-v12",
  "same-day-a1-photo-solid-rotunda-vestibule-bulkhead-v1",
  "terminal4UploadedJetwayA1AssemblyContinuityAuthority",
  "terminal4UploadedJetwayA1AssemblyTransformError",
  "terminal4UploadedJetwayA1IsolatedNodeRotationCount",
  "terminal4UploadedJetwayA1VisibleVestibuleLengthMeters",
  "terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed",
  "terminal4UploadedJetwayA1NoGeneratedGlassCorridor",
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  "inspectionAircraftLandingGearContactClusterCount",
  "inspectionAircraftGroundClearanceMeters",
  "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2",
  "exact-a1-evidence-camera-direct-lock-v1",
  "inspectionCameraEndpointAuthority",
  "inspectionCameraEndpointLockAuthority",
  "inspectionCameraEndpointConvergenceErrorMeters",
  "inspectionCameraEndpointPosition",
  "inspectionCameraEndpointAircraftBoundsMin",
  "inspectionCameraEndpointAircraftBoundsMax",
  "inspectionCameraEndpointFrameSize",
  "inspectionOverheadCameraEndpointAuthority",
  "inspectionOverheadCameraEndpointLockAuthority",
  "inspectionOverheadCameraEndpointConvergenceErrorMeters",
  "inspectionOverheadCameraEndpointFrameSize",
  "aircraftBoundsSize",
  "rotundaWallDistance",
  "a1-measured-ground-contact.png",
  "a1-measured-ground-contact-overhead.png",
  "a1-measured-ground-contact.json",
]);

requireTokens("jetwayBrowser", [
  "A1 authored jetway uses a compact real-terminal anchor and a separated multi-point ramp footprint",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
  "terminal4A1JetwayWallDistance",
  "WALK|JETWAY|CONNECTOR|PORTAL",
  "terminal4UploadedJetwayA1AssemblyTransformError",
  "terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed",
  "terminal4UploadedJetwayA1NoGeneratedGlassCorridor",
  "a1-jetway-contact-clusters.json",
]);

console.log("Verified compact ramp-level A1 wall selection, continuous authored assembly, solid closed vestibule, separated multi-point jetway/CRJ ramp contact, locked evidence cameras, and retained perspective/overhead evidence contracts.");
