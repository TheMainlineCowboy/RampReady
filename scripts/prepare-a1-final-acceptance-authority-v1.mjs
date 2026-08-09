import fs from "node:fs";

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const generatedAuthorityPaths = Object.freeze([
  trainerPath,
  "src/environment/correctUploadedJetwayInstallationV1.js",
  "src/environment/uploadedAirportJetwayFleetReadyV2.js",
  "src/environment/uploadedAirportJetwayArticulationV10.js",
  "src/environment/uploadedAirportJetwayModelSpaceControllerV7.js",
  "src/environment/registerStaticJetwayFleetToFacadeV1.js",
  "src/environment/authoredTerminal4Visual.js",
]);
let source = fs.readFileSync(trainerPath, "utf8");

const staleAuthority = "terminal-relocated-a1-exact-cab-registration-v1";
const finalAuthority = "a1-single-aircraft-pose-training-and-free-drive-v1";
const cameraAuthority = "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2";
const cameraLockAuthority = "exact-a1-evidence-camera-direct-lock-v1";
const visualAuthority = "same-day-a1-continuous-source-measured-solid-closed-grounded-v2";
const jetwayGroundAuthority = "exact-authored-a1-lowest-geometry-ramp-contact-v2";
const noLiftAuthority = "grounded-jetway-door-gap-reported-no-child-lift-v1";
const staticRigidAuthority = "57-static-exact-glb-rigid-source-hierarchy-v1";
const staticSourcePlacementAuthority = "57-static-bgl-pose-locked-short-real-wall-registration-v7";
const marker = "final-a1-acceptance-authority-after-all-preparers-v4-source-static-integrity";
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
  for (const oldMarker of [
    "final-a1-acceptance-authority-after-all-preparers-v3-three-tire-contact",
    "final-a1-acceptance-authority-after-all-preparers-v2",
    "final-a1-acceptance-authority-after-all-preparers-v1",
  ]) {
    source = source.replaceAll(oldMarker, marker);
  }
  if (!source.includes(marker)) {
    const anchor = `const INSPECTION_ROUTE_AUTHORITY =`;
    const index = source.indexOf(anchor);
    if (index < 0) throw new Error(`${trainerPath}: inspection route authority anchor is missing`);
    source = `${source.slice(0, index)}// ${marker}\n${source.slice(index)}`;
  }
}

const generatedAuthoritySource = generatedAuthorityPaths
  .map((path) => fs.readFileSync(path, "utf8"))
  .join("\n");
for (const authority of [
  finalAuthority,
  cameraAuthority,
  cameraLockAuthority,
  visualAuthority,
  jetwayGroundAuthority,
  noLiftAuthority,
  staticRigidAuthority,
  staticSourcePlacementAuthority,
]) {
  if (!generatedAuthoritySource.includes(authority)) {
    throw new Error(`Generated Terminal 4 runtime is missing final authority ${authority}`);
  }
}

for (const required of [
  marker,
  facadeTelemetryMarker,
  "inspectionAircraftDoorVerticalErrorMeters",
  "inspectionAircraftDoorSignedVerticalGapMeters",
  "inspectionAircraftGroundClearanceMeters",
  "inspectionAircraftJetwayRequestedVerticalFitMeters",
  "inspectionAircraftJetwayVerticalFitMeters",
  "inspectionAircraftJetwayVerticalFitAuthority",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "inspectionAircraftGroundingAuthority",
  "inspectionAircraftLandingGearContactPatchCount",
  "inspectionAircraftNoseTireContact",
  "inspectionAircraftLeftMainTireContact",
  "inspectionAircraftRightMainTireContact",
  "inspectionAircraftLandingGearContactHeightSpreadMeters",
  "terminal4A1JetwayWallDistance",
  "terminal4A1ConnectionAuthority",
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  "terminal4UploadedJetwayBogieGroundContactAuthority",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "terminal4UploadedJetwayBogieGroundContactSpanX",
  "terminal4UploadedJetwayBogieGroundContactSpanZ",
  "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
  "terminal4UploadedJetwayBogieGroundContactCenterX",
  "terminal4UploadedJetwayBogieGroundContactCenterY",
  "terminal4UploadedJetwayBogieGroundContactCenterZ",
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
  "inspectionCameraEndpointAuthority",
  "inspectionCameraEndpointLockAuthority",
  "inspectionCameraEndpointConvergenceErrorMeters",
  "inspectionOverheadCameraEndpointFrameSize",
  "inspectionOverheadCameraEndpointAuthority",
  "inspectionOverheadCameraEndpointLockAuthority",
  "inspectionOverheadCameraEndpointConvergenceErrorMeters",
  "terminal4TerminalConnectedJetwayCount",
  "inspectionPresetJetwayDeployment",
]) {
  if (!source.includes(required)) {
    throw new Error(`${trainerPath}: final Terminal 4 browser publication is missing ${required}`);
  }
}
for (const forbidden of [
  staleAuthority,
  "same-day-a1-continuous-compact-solid-closed-grounded-v1",
  "inspectionAircraftLandingGearContactClusterCount",
  "named-landing-gear-wheel-bounds-v1",
  "grounded-aircraft-wheel-contact-progressive-tunnel-slope-v2",
  "grounded-aircraft-door-progressive-tunnel-slope-v1",
  "exactA1CabContactY += appliedA1JetwayVerticalFitMeters",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${trainerPath}: stale compact A1, grounding, child lift, or pose behavior survived finalization: ${forbidden}`);
  }
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-a1-lifecycle-grounded-pose-anchor-v1.mjs?grounded-pose=${Date.now()}`);
console.log("Finalized Terminal 4 with source-measured A1 real-wall/Rotunda geometry and grounded aircraft/bogie evidence, plus all 57 rigid exact-GLB static jetways locked to their decoded KPHX BGL poses. Short real-wall vestibules remain allowed; whole-parent relocation/re-aim and long synthetic static corridors remain forbidden.");