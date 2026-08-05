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
  await runNode("scripts/prepare-a1-photo-registered-stop-v1.mjs");
  await runNode("scripts/prepare-a1-rigid-parent-orientation-v2.mjs");
  await runNode("scripts/prepare-a1-terminal-relocation-v4.mjs");
  await runNode("scripts/prepare-a1-inspection-aircraft-terminal-relocation-v1.mjs");
  await runNode("scripts/prepare-a1-rotunda-vestibule-closure-v1.mjs");
  await runNode("scripts/prepare-static-jetway-portal-closures-v1.mjs");
  await runNode("scripts/prepare-terminal4-static-jetway-parking-v15.mjs");
  await runNode("scripts/prepare-terminal4-ramp-facade-v16.mjs");
  await runNode("scripts/prepare-terminal4-b-concourse-extension-v17.mjs");
  await runNode("scripts/prepare-terminal4-attachment-evidence-v14.mjs");
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
    if (restored !== committedSource) {
      throw new Error(`Simulator-quality production wrapper failed to restore ${sourcePath} exactly.`);
    }
  }
} catch (error) {
  restorationError = error;
}

if (buildError && restorationError) {
  throw new AggregateError(
    [buildError, restorationError],
    "Simulator-quality production build failed and protected source restoration also failed.",
  );
}
if (restorationError) throw restorationError;
if (buildError) throw buildError;
console.log("RampReady simulator-quality production build preserved the supplied Terminal 4 placement, photo-registered and rigid-parent-oriented the complete A1 jetway at the measured terminal corner with a compact fixed vestibule, registered the inspection aircraft to the relocated exact Cab, closed all parked jetway apron-facing cab mouths without changing supplied GLB node transforms, retained package-native facade variants and exact corridor skins, kept the pinned full-airport aerial visible, filled transparent apron pixels with a crop from the supplied PARKRAMPS texture, retained subtle ADEX surface detail and 2K/4K dynamic shadows, and restored every protected committed source exactly, including the supplied-jetway installation correction and both trainer sources.");
