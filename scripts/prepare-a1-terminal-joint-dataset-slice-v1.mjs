import fs from 'node:fs';

const path = 'scripts/verify-a1-terminal-joint-browser.cjs';
let source = fs.readFileSync(path, 'utf8');
const legacy = "canvas.evaluate(element => ({ ...element.dataset }))";
const keys = [
  'terminal4UploadedJetwayLoadState','terminal4UploadedJetwayCount',
  'terminal4UploadedJetwayA1VisibleVestibuleLengthMeters','terminal4UploadedJetwayA1ConnectorStyleAuthority','terminal4A1JetwayWallDistance',
  'inspectionAircraftDoorVerticalErrorMeters',
  'inspectionAircraftCabDoorFacingVertexCount','inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters',
  'inspectionAircraftCabDoorContactPlaneCovered','inspectionAircraftCabDoorLaterallyCovered','inspectionAircraftCabDoorVerticallyCovered',
  'inspectionAircraftCabDoorMinimumHeightMeters','inspectionAircraftCabDoorMaximumHeightMeters',
  'inspectionAircraftCabDoorContactAuthority','inspectionAircraftFixedSourceGateAuthority',
  'terminal4UploadedJetwayBogieGroundContactAuthority','terminal4UploadedJetwayBogieGroundClearanceMeters',
  'inspectionCameraEndpointSubviewAuthority','inspectionCameraEndpointJointAircraftSideShiftMeters',
  'inspectionCameraEndpointSubview','inspectionCameraEndpointAuthority','inspectionCameraEndpointLockAuthority',
  'inspectionCameraEndpointConvergenceErrorMeters','inspectionCameraEndpointJointWallViewCosine',
  'inspectionCameraEndpointJointTunnelAViewCosine','inspectionCameraEndpointJointBranchViewImbalance',
  'inspectionCameraEndpointJointRenderedApronHalfPlaneOffsetMeters','inspectionCameraEndpointJointProfileAuthority',
  'inspectionCameraEndpointJointClearSideAuthority','inspectionCameraEndpointJointClearSideFlipped',
  'inspectionCameraEndpointJointT4WalkOccluded','inspectionCameraEndpointBogieApronHalfPlaneOffsetMeters',
  'inspectionCameraEndpointBogieProfileAuthority','terminal4UploadedJetwayA1VisualAcceptanceAuthority',
  'terminal4UploadedJetwayA1AssemblyContinuityAuthority','terminal4UploadedJetwayA1AssemblyPartCount',
  'terminal4UploadedJetwayA1IsolatedNodeRotationCount','terminal4UploadedJetwayA1ApronFacingRotundaOpeningClosed',
  'terminal4UploadedJetwayA1NoGeneratedGlassCorridor','terminal4UploadedJetwayBogieGroundContactPointCount',
  'terminal4UploadedJetwayBogieGroundContactClusterCount','terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters',
  'terminal4A1ConnectionAuthority','inspectionMode','inspectionPreset','a1JetwayDeployment','a1JetwayState'
];
const requiredPhotoFields = [
  'terminal4UploadedJetwayA1ConnectorStyleAuthority',
  'inspectionAircraftCabDoorFacingVertexCount','inspectionAircraftCabDoorMinimumHorizontalVertexDistanceMeters',
  'inspectionAircraftCabDoorContactPlaneCovered','inspectionAircraftCabDoorLaterallyCovered','inspectionAircraftCabDoorVerticallyCovered',
  'inspectionAircraftCabDoorMinimumHeightMeters','inspectionAircraftCabDoorMaximumHeightMeters'
];
for (const key of requiredPhotoFields) {
  if (!keys.includes(key)) throw new Error(`A1 terminal-joint evidence slice is missing required photo field: ${key}`);
}
const replacement = `page.evaluate((keys) => { const element = document.querySelector('canvas.trainerCanvas'); if (!(element instanceof HTMLCanvasElement)) throw new Error('A1 evidence canvas is missing'); return Object.fromEntries(keys.map((key) => [key, element.dataset[key]])); }, ${JSON.stringify(keys)})`;
const occurrences = source.split(legacy).length - 1;
if (occurrences < 3) throw new Error(`Expected at least 3 full canvas dataset transfers, found ${occurrences}`);
source = source.split(legacy).join(replacement);
if (source.includes(legacy) || source.includes('canvas.evaluate((element, keys)')) {
  throw new Error('A locator-based A1 terminal-joint dataset transfer survived bounded evidence preparation');
}
fs.writeFileSync(path, source);
console.log(`Bounded A1 terminal-joint dataset transfer to ${keys.length} fields across ${occurrences} direct page-context reads, retaining exact Cab surface, photo connector and grounded-bogie authority.`);
