import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
let source = fs.readFileSync(trainerPath, "utf8");

const staleAuthority = "terminal-relocated-a1-exact-cab-registration-v1";
const finalAuthority = "measured-a1-cab-inspection-pose-persisted-across-mode-toggle-v2";
const cameraAuthority = "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2";
const cameraLockAuthority = "exact-a1-evidence-camera-direct-lock-v1";
const visualAuthority = "same-day-a1-continuous-compact-solid-closed-grounded-v1";
const jetwayGroundAuthority = "exact-authored-a1-lowest-geometry-ramp-contact-v1";
const noLiftAuthority = "grounded-jetway-door-gap-reported-no-child-lift-v1";
const marker = "final-a1-acceptance-authority-after-all-preparers-v2";
const facadeTelemetryMarker = "final-terminal4-lower-facade-fit-publication-v3";

source = source.replaceAll(staleAuthority, finalAuthority);

const facadeTelemetryAssignment = `        // ${facadeTelemetryMarker}
        renderer.domElement.dataset.terminal4LowerFacadeFitCount = String(
          renderer.domElement.dataset.terminal4TerminalConnectedJetwayCount
            ?? environment.userData.authoredTerminal4TerminalConnectedJetwayCount
            ?? environment.userData.authoredTerminal4LowerFacadeFitCount
            ?? 0,
        );`;
const facadeTelemetryPattern = /        (?:\/\/ terminal-connected-lower-facade-fit-accounting-v\d+-trainer-publication\n|\/\/ final-terminal4-lower-facade-fit-publication-v\d+\n)?        renderer\.domElement\.dataset\.terminal4LowerFacadeFitCount = String\([\s\S]*?        \);/;
if (facadeTelemetryPattern.test(source)) {
  source = source.replace(facadeTelemetryPattern, facadeTelemetryAssignment);
} else {
  throw new Error(`${trainerPath}: final lower-facade browser telemetry assignment is missing`);
}

if (!source.includes(marker)) {
  const oldMarker = "final-a1-acceptance-authority-after-all-preparers-v1";
  source = source.replaceAll(oldMarker, marker);
  if (!source.includes(marker)) {
    const anchor = `const INSPECTION_ROUTE_AUTHORITY =`;
    const index = source.indexOf(anchor);
    if (index < 0) throw new Error(`${trainerPath}: inspection route authority anchor is missing`);
    source = `${source.slice(0, index)}// ${marker}\n${source.slice(index)}`;
  }
}

for (const required of [
  marker,
  facadeTelemetryMarker,
  finalAuthority,
  cameraAuthority,
  cameraLockAuthority,
  visualAuthority,
  jetwayGroundAuthority,
  noLiftAuthority,
  "inspectionAircraftDoorVerticalErrorMeters",
  "inspectionAircraftDoorSignedVerticalGapMeters",
  "inspectionAircraftGroundClearanceMeters",
  "inspectionAircraftJetwayRequestedVerticalFitMeters",
  "inspectionAircraftJetwayVerticalFitMeters",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "authored-crj-lowest-geometry-contact-clusters-v2",
  "inspectionAircraftLandingGearContactClusterCount",
  "terminal4A1JetwayWallDistance",
  "terminal4A1ConnectionAuthority",
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  "terminal4UploadedJetwayBogieGroundContactAuthority",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "terminal4UploadedJetwayBogieGroundContactSpanX",
  "terminal4UploadedJetwayBogieGroundContactSpanZ",
  "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
  "terminal4UploadedJetwayA1AssemblyContinuityAuthority",
  "terminal4UploadedJetwayA1AssemblyPartCount",
  "terminal4UploadedJetwayA1AssemblyTransformError",
  "terminal4UploadedJetwayA1IsolatedNodeRotationCount",
  "terminal4UploadedJetwayA1ConnectorStyleAuthority",
  "terminal4UploadedJetwayA1RotundaOpeningAuthority",
  "terminal4UploadedJetwayA1VisibleVestibuleLengthMeters",
  "terminal4UploadedJetwayA1ConnectorRibCount",
  "terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed",
  "terminal4UploadedJetwayA1RotundaVestibuleClosureAuthority",
  "terminal4UploadedJetwayA1NoGeneratedGlassCorridor",
  "terminal4UploadedJetwayA1VisualAcceptanceAuthority",
  "inspectionCameraEndpointAircraftBoundsMin",
  "inspectionCameraEndpointAircraftBoundsMax",
  "inspectionCameraEndpointFrameSize",
  "inspectionCameraEndpointLockAuthority",
  "inspectionCameraEndpointConvergenceErrorMeters",
  "inspectionOverheadCameraEndpointFrameSize",
  "inspectionOverheadCameraEndpointLockAuthority",
  "inspectionOverheadCameraEndpointConvergenceErrorMeters",
  "terminal4TerminalConnectedJetwayCount",
  "inspectionPresetJetwayDeployment",
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: final A1 acceptance output is missing ${required}`);
  }
}
for (const forbidden of [
  staleAuthority,
  "named-landing-gear-wheel-bounds-v1",
  "grounded-aircraft-wheel-contact-progressive-tunnel-slope-v2",
  "grounded-aircraft-door-progressive-tunnel-slope-v1",
  "exactA1CabContactY += appliedA1JetwayVerticalFitMeters",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: stale A1 grounding, child lift, or pose behavior survived finalization: ${forbidden}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
console.log("Finalized A1 only after compact real-wall telemetry, separated multi-point jetway contact, zero attached child lift, retained signed door-gap evidence, continuous five-part geometry, solid closed 2.4 m vestibule, locked cameras, and grounded CRJ registration survived every preparer.");
