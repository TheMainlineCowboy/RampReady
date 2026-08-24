import fs from "node:fs";

// The final acceptance stage owns the last geometry mutation point. Run the
// physical door-fit/controller-rebase here, after the decoded-KPHX wall and
// photo dogleg preparers but before acceptance inspects the generated runtime.
await import(`./prepare-a1-final-physical-door-fit-controller-rebase-v1.mjs?final-acceptance=${Date.now()}`);

const trainerPath = "src/components/RampReadyStandupTrainerTerminal4.jsx";
const sourceElbowPath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const generatedAuthorityPaths = Object.freeze([
  trainerPath,
  "src/environment/correctUploadedJetwayInstallationV1.js",
  "src/environment/uploadedAirportJetwayFleetReadyV2.js",
  "src/environment/uploadedAirportJetwayArticulationV10.js",
  "src/environment/uploadedAirportJetwayModelSpaceControllerV7.js",
  "src/environment/registerStaticJetwayFleetToFacadeV1.js",
  "src/environment/authoredTerminal4Visual.js",
  sourceElbowPath,
]);
let source = fs.readFileSync(trainerPath, "utf8");

const staleAuthority = "terminal-relocated-a1-exact-cab-registration-v1";
const finalAuthority = "a1-single-aircraft-pose-training-and-free-drive-v1";
const cameraAuthority = "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2";
const cameraLockAuthority = "exact-a1-evidence-camera-direct-lock-v1";
// The retired same-day compact visual authority was removed with the short-wall
// A1 model. Final acceptance must now require the Aug. 15 long fixed corridor /
// dogleg / remote-Rotunda authority that is produced by the current A1 path.
const visualAuthority = "a1-real-photo-remote-rotunda-fixed-corridor-v1";
const jetwayGroundAuthority = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
const sourceOwnershipAuthority = "a1-real-wall-registered-rotunda-decoded-kphx-heading-intact-parent-v2";
const sourceWallAuthority = "a1-measured-real-wall-preserved-rotunda-v2";
const legacyRawBglRotundaAuthority = "a1-decoded-kphx-bgl-rotunda-and-heading-own-physical-jetway-v1";
const noLiftAuthority = "grounded-jetway-door-gap-reported-no-child-lift-v1";
const staticRigidAuthority = "57-static-exact-glb-own-gate-inward-telescope-v2";
const staticSourcePlacementAuthority = "57-static-bgl-source-pose-real-wall-registration-v10";
const marker = "final-a1-acceptance-authority-after-all-preparers-v8-long-fixed-route";
const facadeTelemetryMarker = "final-terminal4-lower-facade-fit-publication-v3";

source = source.replaceAll(staleAuthority, finalAuthority);
for (const oldMarker of [
  "final-a1-acceptance-authority-after-all-preparers-v7-intact-source-bogie",
  "final-a1-acceptance-authority-after-all-preparers-v6-own-gate-real-wall-static",
  "final-a1-acceptance-authority-after-all-preparers-v5-source-heading-real-wall-static",
  "final-a1-acceptance-authority-after-all-preparers-v4-source-static-integrity",
  "final-a1-acceptance-authority-after-all-preparers-v3-three-tire-contact",
  "final-a1-acceptance-authority-after-all-preparers-v2",
  "final-a1-acceptance-authority-after-all-preparers-v1",
]) source = source.replaceAll(oldMarker, marker);

const facadeTelemetryAssignment = `        // ${facadeTelemetryMarker}
        renderer.domElement.dataset.terminal4LowerFacadeFitCount = String(
          renderer.domElement.dataset.terminal4TerminalConnectedJetwayCount
            ?? environment.userData.authoredTerminal4TerminalConnectedJetwayCount
            ?? environment.userData.authoredTerminal4LowerFacadeFitCount
            ?? 0,
        );`;
const facadeTelemetryPattern = /        (?:\/\/ terminal-connected-lower-facade-fit-accounting-v\d+-trainer-publication\n|\/\/ final-terminal4-lower-facade-fit-publication-v\d+\n)?        renderer\.domElement\.dataset\.terminal4LowerFacadeFitCount = String\([\s\S]*?        \);/;
if (facadeTelemetryPattern.test(source)) source = source.replace(facadeTelemetryPattern, facadeTelemetryAssignment);
else throw new Error(`${trainerPath}: final lower-facade browser telemetry assignment is missing`);

if (!source.includes(marker)) {
  const anchor = `const INSPECTION_ROUTE_AUTHORITY =`;
  const index = source.indexOf(anchor);
  if (index < 0) throw new Error(`${trainerPath}: inspection route authority anchor is missing`);
  source = `${source.slice(0, index)}// ${marker}\n${source.slice(index)}`;
}

const sourceElbow = fs.readFileSync(sourceElbowPath, "utf8");
for (const forbidden of [
  "UploadedAirportJetwayA1AircraftSidePivot",
  "bridgePivot.attach(root)",
  "bridgePivot.rotation.y = yawDelta",
  "a1-fixed-terminal-rotunda-aircraft-side-pivot-v1",
  legacyRawBglRotundaAuthority,
  "const sourceRotundaTarget = new THREE.Vector3(Number(placement.x)",
]) {
  if (sourceElbow.includes(forbidden)) {
    throw new Error(`${sourceElbowPath}: visually destructive/raw-origin A1 behavior survived finalization: ${forbidden}`);
  }
}
for (const required of [
  sourceOwnershipAuthority,
  sourceWallAuthority,
  "const sourceRotundaTarget = fixedRotundaCenter.clone();",
  "anchor.rotation.y = Number(placement.yaw)",
  "const yawDelta = 0;",
  "uploadedJetwayA1RawBglPlacementX",
  "uploadedJetwayA1SourceRotundaPositionErrorMeters",
  "uploadedJetwayA1MeasuredRealWallAuthority",
]) {
  if (!sourceElbow.includes(required)) {
    throw new Error(`${sourceElbowPath}: final intact measured-wall source-owned A1 is missing ${required}`);
  }
}

const generatedAuthoritySource = generatedAuthorityPaths.map((path) => fs.readFileSync(path, "utf8")).join("\n");
for (const authority of [
  finalAuthority,
  cameraAuthority,
  cameraLockAuthority,
  visualAuthority,
  jetwayGroundAuthority,
  sourceOwnershipAuthority,
  sourceWallAuthority,
  noLiftAuthority,
  staticRigidAuthority,
  staticSourcePlacementAuthority,
]) {
  if (!generatedAuthoritySource.includes(authority)) throw new Error(`Generated Terminal 4 runtime is missing final authority ${authority}`);
}

// Do not require the retired compact-A1 browser publications here. Those fields
// were produced by the old 1.2-3.6 m short vestibule/finalizer path and became
// false blockers once A1 moved to the Aug. 15 long fixed corridor/dogleg/remote
// Rotunda architecture. Final acceptance instead requires the live wall/Rotunda,
// grounded Tunnel-C, aircraft, camera and fleet telemetry that survives the
// current long-route production path.
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
  if (!source.includes(required)) throw new Error(`${trainerPath}: final Terminal 4 browser publication is missing ${required}`);
}

for (const forbidden of [
  staleAuthority,
  "same-day-a1-continuous-compact-solid-closed-grounded-v1",
  "same-day-a1-continuous-source-measured-solid-closed-grounded-v2",
  "inspectionAircraftLandingGearContactClusterCount",
  "named-landing-gear-wheel-bounds-v1",
  "grounded-aircraft-wheel-contact-progressive-tunnel-slope-v2",
  "grounded-aircraft-door-progressive-tunnel-slope-v1",
  "exactA1CabContactY += appliedA1JetwayVerticalFitMeters",
  "57-static-bgl-pose-locked-short-real-wall-registration-v7",
  "57-static-source-heading-real-wall-compact-registration-v8",
  "57-static-exact-glb-rigid-source-hierarchy-v1",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
]) {
  if (source.includes(forbidden)) throw new Error(`${trainerPath}: stale A1/static/grounding behavior survived finalization: ${forbidden}`);
}

fs.writeFileSync(trainerPath, source, "utf8");
await import(`./prepare-a1-lifecycle-grounded-pose-anchor-v1.mjs?grounded-pose=${Date.now()}`);
console.log("Finalized Terminal 4 with A1 preserved at its measured real-wall Rotunda position as one intact decoded-KPHX supplied assembly, with Tunnel-C aircraft-side bogie/support geometry required on the ramp. Retired compact-A1 browser publications are no longer accepted as geometry authority.");
