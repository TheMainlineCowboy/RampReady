import fs from "node:fs";

const files = Object.freeze({
  build: "scripts/build-production-simulator-quality.mjs",
  vertical: "scripts/prepare-a1-inspection-aircraft-vertical-registration-v1.mjs",
  aircraftGround: "scripts/prepare-a1-authored-ground-contact-v1.mjs",
  jetwayGround: "scripts/prepare-a1-exact-bogie-ground-contact-v1.mjs",
  readiness: "scripts/prepare-a1-bogie-readiness-v1.mjs",
  heading: "scripts/prepare-a1-inspection-aircraft-cab-heading-v1.mjs",
  finalizer: "scripts/prepare-a1-final-acceptance-authority-v1.mjs",
  browser: "tests/browser/a1-ground-contact-evidence.spec.js",
});
const source = Object.fromEntries(
  Object.entries(files).map(([key, path]) => [key, fs.readFileSync(path, "utf8")]),
);

function requireTokens(key, tokens) {
  for (const token of tokens) {
    if (!source[key].includes(token)) {
      throw new Error(`${files[key]}: measured A1 ground-contact contract is missing ${token}`);
    }
  }
}

function forbidTokens(key, tokens) {
  for (const token of tokens) {
    if (source[key].includes(token)) {
      throw new Error(`${files[key]}: stale A1 ground-contact contract remains: ${token}`);
    }
  }
}

const buildStages = [
  'await runNode("scripts/prepare-a1-inspection-aircraft-vertical-registration-v1.mjs")',
  'await runNode("scripts/prepare-a1-exact-bogie-ground-contact-v1.mjs")',
  'await runNode("scripts/prepare-a1-bogie-readiness-v1.mjs")',
  'await runNode("scripts/prepare-a1-authored-ground-contact-v1.mjs")',
  'await runNode("scripts/prepare-a1-final-acceptance-authority-v1.mjs")',
  'await runNode("scripts/prepare-a1-inspection-aircraft-cab-heading-v1.mjs")',
];
let previousIndex = -1;
for (const stage of buildStages) {
  const index = source.build.indexOf(stage);
  if (index <= previousIndex) {
    throw new Error(`${files.build}: measured A1 preparation order is invalid at ${stage}`);
  }
  previousIndex = index;
}

requireTokens("vertical", [
  'const verticalFitAuthority = "grounded-aircraft-door-progressive-tunnel-slope-v1"',
  "landingGearWheelBoundsBefore",
  "inspectionAircraftJetwayVerticalFitAuthority",
]);
forbidTokens("vertical", [
  "grounded-aircraft-wheel-contact-progressive-tunnel-slope-v2",
  "const aircraftRelocationY = -renderedBoundsBefore.min.y",
]);

requireTokens("aircraftGround", [
  "authored-crj-lowest-geometry-contact-clusters-v2",
  "const measureAuthoredLandingGearContact = () =>",
  "contactClusterCount < 3",
  "contactSpan.x < 1",
  "contactSpan.z < 4",
  "const aircraftRelocationY = -landingGearContactBefore.minimumY",
  "inspectionAircraftLandingGearContactClusterCount",
]);
forbidTokens("aircraftGround", [
  "landingGearWheelBoundsBefore",
  "landingGearWheelBoundsAfter",
  "named-landing-gear-wheel-bounds-v1",
  "`\${Math.floor(point.x",
  "`\${cellX + dx}",
]);

requireTokens("jetwayGround", [
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "const measuredBogieGroundOffsetMeters = -authoredA1GroundBoundsBefore.min.y",
  "Math.abs(measuredBogieGroundOffsetMeters) > 0.5",
  "Math.abs(measuredBogieGroundClearanceMeters) > 0.005",
  "uploadedJetwayBogieGroundContactAuthority",
]);
forbidTokens("jetwayGround", [
  "measuredBogieGroundOffsetMeters >= 0",
  "fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS",
]);

requireTokens("readiness", [
  "Math.abs(bogieGroundClearance) > 0.005",
  "authoredTerminal4UploadedJetwayBogieGroundClearanceMeters",
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  "terminal4UploadedJetwayBogieGroundContactAuthority",
]);
forbidTokens("readiness", ["bogieTireCorrection > 0.04 && bogieTireCorrection < 0.1"]);

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
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
]);
forbidTokens("finalizer", [
  "named-landing-gear-wheel-bounds-v1\",\n])",
]);

requireTokens("browser", [
  "A1 evidence proves the supplied jetway and authored CRJ contact the ramp",
  "terminal4UploadedJetwayBogieGroundClearanceMeters",
  "inspectionAircraftLandingGearContactClusterCount",
  "a1-measured-ground-contact.png",
  "a1-measured-ground-contact.json",
]);

console.log("Verified the explicit measured A1 jetway/CRJ ground-contact build order, authorities, browser publication, and rendered-evidence contract.");
