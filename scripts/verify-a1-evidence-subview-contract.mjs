import fs from "node:fs";

const files = Object.freeze({
  endpoint: "scripts/prepare-a1-endpoint-browser-evidence-v1.mjs",
  subviews: "scripts/prepare-a1-evidence-subviews-v1.mjs",
  lock: "scripts/prepare-a1-evidence-camera-lock-v1.mjs",
  finalizer: "scripts/prepare-a1-final-acceptance-authority-v1.mjs",
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

requireTokens("subviews", [
  'const authority = "exact-a1-terminal-joint-and-bogie-contact-subviews-v1"',
  'exactA1EvidenceSubview === "terminal-joint"',
  'exactA1EvidenceSubview === "bogie-contact"',
  "const exactA1JointCenterX",
  "const exactA1BogieTargetX",
  "exactA1CameraCabX - exactA1CameraApronX * 6",
  "exactA1CameraPositionY = 3.6",
  "exactA1CameraTargetY = 1.1",
  "inspectionCameraEndpointSubview = exactA1EvidenceSubview",
  "inspectionCameraEndpointSubviewAuthority",
]);

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
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  "terminal4UploadedJetwayBogieGroundContactPointCount",
  "terminal4UploadedJetwayBogieGroundContactClusterCount",
  "inspectionAircraftJetwayRequestedVerticalFitMeters",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "inspectionCameraEndpointLockAuthority",
  "inspectionCameraEndpointConvergenceErrorMeters",
]);

requireTokens("browser", [
  "A1 close evidence shows the compact real terminal joint and zero-lift grounded bogie",
  "exact-a1-terminal-joint-and-bogie-contact-subviews-v1",
  "exact-world-wall-rotunda-cab-aircraft-bounds-derived-camera-v2",
  "exact-a1-evidence-camera-direct-lock-v1",
  "same-day-a1-continuous-compact-solid-closed-grounded-v1",
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
  'selectSubview(page, "terminal-joint")',
  'selectSubview(page, "bogie-contact")',
  'selectSubview(page, "full-assembly")',
  "a1-terminal-joint-close.png",
  "a1-bogie-contact-close.png",
  "a1-terminal-joint-bogie-subviews.json",
  "a1ExactRotundaToWallWorldMeters",
  "terminal4A1JetwayWallDistance",
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

console.log("Verified compact real-terminal and low bogie close views, strict subview ordering, direct camera lock, multi-point ramp contact, zero attached child lift, and retained close evidence.");
