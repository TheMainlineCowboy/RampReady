import { readFile, writeFile } from "node:fs/promises";
import { execFileSync, spawn } from "node:child_process";

const protectedSourcePaths = Object.freeze([
  "src/components/RampReadyStandupTrainerTerminal4.jsx",
  "src/components/RampReadyStandupTrainer.jsx",
  "src/environment/sourcePlacedTerminal4Jetways.js",
  "src/environment/uploadedAirportJetwayFleet.js",
  "src/environment/uploadedAirportJetwayFleetReadyV2.js",
  "src/environment/correctUploadedJetwayInstallationV1.js",
  "src/environment/authoredTerminal4Visual.js",
  "src/environment/authoredKphxGround.js",
  "src/environment/authoredKphxPhotoGround.js",
  "src/environment/terminal4LowerFacadeSkinV9.js",
  "src/environment/terminal4JetwaySimulatorPolishV13.js",
  "src/environment/staticJetwayPortalClosures.js",
  "src/environment/registerStaticJetwayFleetToFacadeV1.js",
  "src/environment/sourceRegisteredA1RotundaElbowV3.js",
  "tests/browser/a1-close-readiness-diagnostic.spec.js",
  "tests/browser/a1-ground-contact-evidence.spec.js",
  "tests/browser/a1-jetway-contact-clusters.spec.js",
  "tests/browser/a1-terminal-joint-bogie-subviews.spec.js",
  "tests/browser/crj700-runtime.spec.js",
  "tests/browser/full-airport-inspection.spec.js",
  "tests/browser/kphx-ground-runtime.spec.js",
  "tests/browser/source-first-a1-repair.spec.js",
  "tests/browser/uploaded-jetway-articulation-v10.spec.js",
  "scripts/build-production.mjs",
]);
const committedSources = new Map(protectedSourcePaths.map((sourcePath) => [
  sourcePath,
  execFileSync("git", ["show", `HEAD:${sourcePath}`], { encoding: "utf8" }),
]));
const requiredBaselines = Object.freeze([
  ["src/components/RampReadyStandupTrainerTerminal4.jsx", "export default function RampReadyStandupTrainer", "Terminal 4 trainer"],
  ["src/components/RampReadyStandupTrainer.jsx", "export default function RampReadyStandupTrainer", "secondary trainer"],
  ["src/environment/sourcePlacedTerminal4Jetways.js", "buildSourcePlacedTerminal4Jetways", "Terminal 4 jetway"],
  ["src/environment/uploadedAirportJetwayFleet.js", "installUploadedAirportJetwayFleet", "supplied airport jetway fleet"],
  ["src/environment/uploadedAirportJetwayFleetReadyV2.js", "installUploadedAirportJetwayFleet", "supplied airport jetway readiness"],
  ["src/environment/correctUploadedJetwayInstallationV1.js", "correctUploadedJetwayInstallation", "supplied airport jetway installation correction"],
  ["src/environment/authoredTerminal4Visual.js", "installAuthoredTerminal4Visual", "authored Terminal 4"],
  ["src/environment/authoredKphxGround.js", "installAuthoredKphxGround", "authored KPHX ground"],
  ["src/environment/authoredKphxPhotoGround.js", "installAuthoredKphxPhotoGround", "authored KPHX source aerial"],
  ["src/environment/terminal4LowerFacadeSkinV9.js", "buildTerminal4LowerFacadeSkin", "Terminal 4 lower-facade"],
  ["src/environment/terminal4JetwaySimulatorPolishV13.js", "applyTerminal4JetwaySimulatorPolish", "Terminal 4 jetway-polish"],
  ["scripts/build-production.mjs", "restoreA1TerminalConnectorV11", "production restorer"],
]);
for (const [sourcePath, token, label] of requiredBaselines) {
  if (!committedSources.get(sourcePath)?.includes(token)) {
    throw new Error(`Could not read the committed ${label} baseline from HEAD.`);
  }
}

function runNode(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { stdio: "inherit", env: process.env });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${script} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

let buildError;
try {
  await runNode("scripts/prepare-a1-connection-camera-v5.mjs");
  await runNode("scripts/prepare-inspection-route-lifecycle.mjs");
  await runNode("scripts/prepare-inspection-preset-telemetry.mjs");
  await runNode("scripts/prepare-simulator-render-quality.mjs");
  await runNode("scripts/prepare-kphx-nearfield-pavement-v6.mjs");
  await runNode("scripts/prepare-kphx-source-aerial-priority-v41.mjs");
  await runNode("scripts/prepare-kphx-aerial-underlay-depth-v42.mjs");
  await runNode("scripts/prepare-kphx-source-pavement-underlay-v43.mjs");
  await runNode("scripts/prepare-terminal4-a1-legacy-block-filter.mjs");
  await runNode("scripts/prepare-terminal4-floating-roof-filter.mjs");
  await runNode("scripts/prepare-terminal4-jetway-simulator-polish.mjs");
  await runNode("scripts/prepare-a1-terminal-attachment-v14.mjs");
  await runNode("scripts/prepare-a1-grounded-terminal-building-v1.mjs");
  await runNode("scripts/prepare-a1-terminal-authority-idempotence-v1.mjs");
  await runNode("scripts/prepare-a1-photo-registered-stop-v1.mjs");
  await runNode("scripts/prepare-a1-compact-source-wall-distance-v1.mjs");
  await runNode("scripts/prepare-a1-readiness-compact-wall-v1.mjs");
  await runNode("scripts/prepare-a1-rigid-parent-orientation-v2.mjs");
  await runNode("scripts/prepare-a1-rigid-compact-span-v1.mjs");
  await runNode("scripts/prepare-a1-complete-endpoint-axis-v1.mjs");
  await runNode("scripts/prepare-a1-terminal-relocation-v4.mjs");
  await runNode("scripts/prepare-a1-vector-wall-lock-v1.mjs");
  await runNode("scripts/prepare-a1-inspection-aircraft-terminal-relocation-v1.mjs");
  await runNode("scripts/prepare-a1-inspection-aircraft-vertical-registration-v1.mjs");
  await runNode("scripts/prepare-exact-airport-jetway-wheel-level-source-v1.mjs");
  await runNode("scripts/prepare-a1-exact-bogie-ground-contact-v1.mjs");
  await runNode("scripts/prepare-a1-bogie-readiness-v1.mjs");
  await runNode("scripts/prepare-a1-authored-ground-contact-v1.mjs");
  await runNode("scripts/prepare-a1-endpoint-browser-evidence-v1.mjs");
  await runNode("scripts/prepare-a1-inspection-aircraft-pose-declaration-v1.mjs");
  await runNode("scripts/prepare-a1-lifecycle-grounded-pose-anchor-v1.mjs");
  await runNode("scripts/prepare-a1-inspection-aircraft-pose-lifecycle-v2.mjs");
  await runNode("scripts/prepare-a1-rotunda-vestibule-closure-v1.mjs");
  await runNode("scripts/prepare-terminal4-ramp-facade-v16.mjs");
  await runNode("scripts/prepare-terminal4-b-concourse-extension-v17.mjs");
  await runNode("scripts/prepare-terminal4-attachment-evidence-v14.mjs");
  await runNode("scripts/prepare-terminal4-lower-facade-fit-accounting-v1.mjs");
  await runNode("scripts/prepare-inspection-preset-telemetry.mjs");
  await runNode("scripts/prepare-a1-inspection-aircraft-pose-lifecycle-v2.mjs");
  await runNode("scripts/prepare-a1-inspection-aircraft-cab-heading-v1.mjs");
  await runNode("scripts/prepare-a1-fixed-source-gate-aircraft-pose-v1.mjs");
  await runNode("scripts/prepare-a1-live-visual-contact-monitor-v1.mjs");
  await runNode("scripts/prepare-static-jetway-source-placement-integrity-v1.mjs");
  await runNode("scripts/prepare-a1-unified-aircraft-pose-v1.mjs");
  await runNode("scripts/prepare-a1-final-acceptance-authority-v1.mjs");
  await runNode("scripts/prepare-a1-final-marker-compat-v1.mjs");
  await runNode("scripts/prepare-jetway-readiness-airport-ownership-v1.mjs");
  await import(`./run-production-with-a1-authored-filter-cleanup.mjs?simulator-quality=${Date.now()}`);
} catch (error) {
  buildError = error;
}

let restorationError;
try {
  for (const [sourcePath, committedSource] of committedSources) {
    await writeFile(new URL(`../${sourcePath}`, import.meta.url), committedSource, "utf8");
  }
  for (const [sourcePath, committedSource] of committedSources) {
    const restored = await readFile(new URL(`../${sourcePath}`, import.meta.url), "utf8");
    if (restored !== committedSource) throw new Error(`Simulator-quality production wrapper failed to restore ${sourcePath} exactly.`);
  }
} catch (error) {
  restorationError = error;
}

if (buildError && restorationError) {
  throw new AggregateError([buildError, restorationError], "Simulator-quality production build failed and protected source restoration also failed.");
}
if (restorationError) throw restorationError;
if (buildError) throw buildError;

await runNode("scripts/prepare-current-head-browser-expectations-v1.mjs");
await runNode("scripts/prepare-a1-post-lifecycle-evidence-v1.mjs");
await runNode("scripts/prepare-a1-bogie-centroid-browser-authority-v1.mjs");

const articulationTestPath = new URL("../tests/browser/uploaded-jetway-articulation-v10.spec.js", import.meta.url);
const preparedArticulationTest = await readFile(articulationTestPath, "utf8");
for (const forbidden of [
  "expect(renderedAircraftVerticalError).toBeLessThanOrEqual(0.01)",
  "grounded-aircraft-door-progressive-tunnel-slope-v2",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
  "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3",
]) {
  if (preparedArticulationTest.includes(forbidden)) throw new Error(`Post-restoration browser preparation left retired articulation expectation ${forbidden}`);
}
for (const required of [
  "articulationSignedDoorVerticalGapMeters",
  "articulationRequestedJetwayVerticalFitMeters",
  "articulationAppliedJetwayVerticalFitMeters",
  "renderedAircraftVerticalError).toBeLessThanOrEqual(6)",
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
  "inspectionAircraftJetwayAuthoredBogieGroundPreserved",
  "exact-authored-a1-connected-wheel-pair-ramp-contact-v4",
  "terminal4UploadedJetwayBogieGroundContactPointCount) >= 8",
  "terminal4UploadedJetwayBogieGroundContactClusterCount) >= 2",
  "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters) >= 1.4",
]) {
  if (!preparedArticulationTest.includes(required)) throw new Error(`Post-restoration browser preparation is missing ${required}`);
}

console.log("RampReady simulator-quality production build requires the intact source-owned A1 assembly and the exact connected authored two-wheel bogie pair on the ramp; a grounded terminal pedestal or arbitrary Tunnel-C low point can no longer masquerade as grounded aircraft-side wheels.");
