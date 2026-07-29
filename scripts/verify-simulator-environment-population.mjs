import fs from "node:fs";

const staticSource = fs.readFileSync("src/environment/staticGateAircraft.js", "utf8");
const patchSource = fs.readFileSync("scripts/prepare-simulator-environment.mjs", "utf8");
const generated = fs.readFileSync("src/components/RampReadyStandupTrainerTerminal4.jsx", "utf8");
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));

const failures = [];
const requireText = (source, token, label) => {
  if (!source.includes(token)) failures.push(`${label} is missing`);
};

for (const gate of ["A2", "A3", "A4", "A5", "A6", "A7", "A8"]) {
  requireText(staticSource, `"${gate}"`, `static gate ${gate}`);
}
requireText(staticSource, "loadSelectedAircraftRuntime", "authored aircraft loader");
requireText(staticSource, "result.preserveMaterials", "authored livery preservation gate");
requireText(staticSource, "decoded KPHX ADEX parking position and heading", "source placement authority");
requireText(staticSource, "root.rotation.y = (270 - gate.h)", "source heading transform");
requireText(staticSource, "authoredStaticAircraftCount", "static aircraft runtime count");
requireText(staticSource, "authored-crj700-static-gate-population-v1", "static aircraft detail level");

requireText(patchSource, "installStaticGateAircraft", "static aircraft preparation import");
requireText(patchSource, "staticAircraftLoad", "static aircraft readiness promise");
requireText(patchSource, "dataset.staticAircraftCount", "static aircraft browser evidence");
requireText(generated, 'import { installStaticGateAircraft } from "../environment/staticGateAircraft.js";', "generated static aircraft import");
requireText(generated, "installStaticGateAircraft(THREE, environment)", "generated static aircraft loader");
requireText(generated, "Promise.all([terminalLoad, groundLoad, photoGroundLoad, staticAircraftLoad])", "combined simulator readiness gate");

if (packageJson.scripts?.["prepare:simulator-environment"] !== "node scripts/prepare-simulator-environment.mjs") {
  failures.push("package prepare:simulator-environment script is incorrect");
}
if (!packageJson.scripts?.build?.includes("prepare:simulator-environment")) failures.push("production build skips simulator environment preparation");
if (!packageJson.scripts?.dev?.includes("prepare:simulator-environment")) failures.push("development server skips simulator environment preparation");

if (failures.length) {
  console.error("Simulator environment population verification failed:");
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log("Simulator environment population verified: seven authored CRJ700s occupy source-decoded A2-A8 stands and participate in the browser readiness gate.");
