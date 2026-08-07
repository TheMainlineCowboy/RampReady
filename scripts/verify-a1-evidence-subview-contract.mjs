import fs from "node:fs";

await import(`./verify-a1-grounded-lifecycle-order-v1.mjs?close-preflight=${Date.now()}`);

const files = Object.freeze({
  endpoint: "scripts/prepare-a1-endpoint-browser-evidence-v1.mjs",
  subviews: "scripts/prepare-a1-evidence-subviews-v1.mjs",
  bogieGround: "scripts/prepare-a1-exact-bogie-ground-contact-v1.mjs",
  readiness: "scripts/prepare-a1-bogie-readiness-v1.mjs",
  lock: "scripts/prepare-a1-evidence-camera-lock-v1.mjs",
  finalizer: "scripts/prepare-a1-final-acceptance-authority-v1.mjs",
  heading: "scripts/prepare-a1-inspection-aircraft-cab-heading-v1.mjs",
  postLifecycle: "scripts/prepare-a1-post-lifecycle-evidence-v1.mjs",
  browser: "tests/browser/a1-terminal-joint-bogie-subviews.spec.js",
});
const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, fs.readFileSync(path, "utf8")]),
);

function requireTokens(key, tokens) {
  for (const token of tokens) {
    if (!source[key].includes(token)) {
      throw new Error(`${files[key]}: A1 close-evidence contract is missing ${token}`);
    }
  }
}

const dynamicIndex = source.endpoint.indexOf("prepare-a1-dynamic-evidence-camera-v1.mjs?exact-endpoint-camera=");
const subviewIndex = source.endpoint.indexOf("prepare-a1-evidence-subviews-v1.mjs?exact-evidence-subviews=");
const lockIndex = source.endpoint.indexOf("prepare-a1-evidence-camera-lock-v1.mjs?exact-camera-lock=");
if (!(dynamicIndex >= 0 && subviewIndex > dynamicIndex && lockIndex > subviewIndex)) {
  throw new Error(
    `${files.endpoint}: A1 close-evidence preparation must run after dynamic framing and before direct camera lock`,
  );
}

requireTokens("bogieGround", [
  'exact-authored-a1-lowest-geometry-ramp-contact-v2',
  "const contactCenter = contactBounds.getCenter",
  "bogieGroundContactCenterX: authoredA1GroundContactAfter.centerX",
  "uploadedJetwayBogieGroundContactCenterX",
  "uploadedJetwayBogieGroundContactCenterY",
  "uploadedJetwayBogieGroundContactCenterZ",
]);

requireTokens("readiness", [
  'exact-authored-a1-lowest-geometry-ramp-contact-v2',
  "bogieGroundContactCenterX",
  "authoredTerminal4UploadedJetwayBogieGroundContactCenterX",
  "terminal4UploadedJetwayBogieGroundContactCenterX",
  "terminal4UploadedJetwayBogieGroundContactCenterY",
  "terminal4UploadedJetwayBogieGroundContactCenterZ",
]);

requireTokens("subviews", [
  'const authority = "exact-a1-terminal-joint-and-bogie-contact-subviews-v1"',
  'exactA1EvidenceSubview === "terminal-joint"',
  'exactA1EvidenceSubview === "bogie-contact"',
  "const exactA1JointCenterX",
  "const exactA1JointSpan",
  "exactA1CameraApronX * 1.15",
  "const exactA1BogieContactX",
  "uploadedJetwayBogieGroundContactCenterX",
  "inspectionCameraEndpointJointCenter",
  "inspectionCameraEndpointJointSpanMeters",
  "inspectionCameraEndpointBogieContactCenter",
  "inspectionCameraEndpointSubview = exactA1EvidenceSubview",
  "inspectionCameraEndpointSubviewAuthority",
]);
for (const forbidden of [
  "exactA1CameraCabX - exactA1CameraApronX * 6",
  "exactA1CameraApronX * 8",
  "exactA1CameraSideSign * 12",
]) {
  if (source.subviews.includes(forbidden)) {
    throw new Error(`${files.subviews}: obsolete guessed close-camera target remains: ${forbidden}`);
  }
}

requireTokens("lock", [
  "exact-a1-evidence-camera-direct-lock-v1",
  "camera.position.copy(desiredCamera)",
  "inspectionCameraEndpointConvergenceErrorMeters",
]);

requireTokens("finalizer", [
  "same-day-a1-continuous-compact-solid-closed-grounded-v1",
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
  "terminal4A1JetwayWallDistance",
  "terminal4A1ConnectionAuthority",
  "terminal4UploadedJetwayA1VisibleVestibuleLengthMeters",
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "inspectionAircraftJetwayRequestedVerticalFitMeters",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "inspectionCameraEndpointLockAuthority",
  "inspectionCameraEndpointConvergenceErrorMeters",
]);

requireTokens("heading", [
  "prepare-current-head-browser-expectations-v1.mjs?current-head=",
  "prepare-a1-no-lift-evidence-json-v1.mjs?no-lift-evidence=",
  "prepare-a1-post-lifecycle-evidence-v1.mjs?post-lifecycle-evidence=",
]);

requireTokens("postLifecycle", [
  "post-lifecycle-grounded-a1-evidence-v1",
  'data?.inspectionAircraftPoseStored === "true"',
  'data?.inspectionAircraftPoseApplied === "true"',
  'data?.inspectionAircraftPoseAuthority === "${POSE_AUTHORITY}"',
  "Number(data?.inspectionAircraftPoseErrorMeters) <= 0.01",
  'data?.inspectionAircraftHeadingAuthority === "${HEADING_AUTHORITY}"',
  "Number.isFinite(Number(data?.inspectionAircraftYaw))",
  "a1-ground-contact-evidence.spec.js",
  "a1-terminal-joint-bogie-subviews.spec.js",
]);

requireTokens("browser", [
  "A1 close evidence shows the exact 2.4 m terminal vestibule and zero-lift grounded bogie",
  "exact-a1-terminal-joint-and-bogie-contact-subviews-v1",
  "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2",
  "exact-a1-evidence-camera-direct-lock-v1",
  "same-day-a1-continuous-compact-solid-closed-grounded-v1",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
  'selectSubview(page, "terminal-joint")',
  'selectSubview(page, "bogie-contact")',
  'selectSubview(page, "full-assembly")',
  "a1-terminal-joint-close.png",
  "a1-bogie-contact-close.png",
  "a1-terminal-joint-bogie-subviews.json",
  "inspectionCameraEndpointJointCenter",
  "inspectionCameraEndpointBogieContactCenter",
  "terminal4UploadedJetwayBogieGroundContactCenterX",
  "distance3(terminalCameraTarget, terminalJointCenter)",
  "distance3(bogieContactCenter, publishedBogieContactCenter)",
  "distance3(bogieCameraPosition, bogieCameraTarget)",
  "a1ExactRotundaToWallWorldMeters",
  "terminal4A1JetwayWallDistance",
  "terminal4UploadedJetwayA1VisibleVestibuleLengthMeters",
  "centerToWallDistance > 2.9",
  "centerToWallDistance < 5.8",
  "Math.abs(visibleVestibuleLength - 2.4) <= 0.05",
  "terminal4A1ConnectionAuthority",
  "WALK|JETWAY|CONNECTOR|PORTAL",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters",
  "inspectionAircraftJetwayVerticalFitMeters",
  "inspectionAircraftJetwayRequestedVerticalFitMeters",
  "inspectionAircraftDoorSignedVerticalGapMeters",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
]);

console.log("Verified grounded lifecycle order and exact close framing: the terminal camera targets the measured wall/Rotunda midpoint, the bogie camera targets the authored low-contact centroid, both remain tightly bounded, and zero-lift/ground-contact evidence is retained.");
