import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const controllerPath = "src/environment/uploadedAirportJetwayModelSpaceControllerV7.js";
const fleet = fs.readFileSync(fleetPath, "utf8");
const controller = fs.readFileSync(controllerPath, "utf8");

for (const token of [
  'from "./uploadedAirportJetwayModelSpaceControllerV7.js"',
  "A1_MODEL_SPACE_RETRACTION_MODE_V7",
  "tunnelB: 0.79",
  "tunnelC: 1.59",
  "cab: 2.38",
  "createModelSpaceA1Controller(THREE",
  "modeAuthority: A1_MODEL_SPACE_RETRACTION_MODE_V7",
  "controller.bind(anchor)",
]) {
  if (!fleet.includes(token)) throw new Error(`${fleetPath}: exact A1 model-space retraction is missing ${token}`);
}

for (const token of [
  "grounded-jetway-door-gap-reported-no-child-lift-v1",
  "requestedAttachedVerticalDropMeters",
  "attachedVerticalDropMeters = 0",
  "authoredBogieGroundPreserved = true",
  "setAttachedVerticalDrop(value)",
  "return 0",
  "nodes.tunnelB",
  "nodes.tunnelC",
  "nodes.cab",
  "retract * retraction.lift",
]) {
  if (!controller.includes(token)) {
    throw new Error(`${controllerPath}: grounded-bogie controller contract is missing ${token}`);
  }
}
for (const forbidden of [
  "const attachedDrop = deployment * attachedVerticalDrop",
  "attachedDrop / 3",
  "attachedDrop * 2 / 3",
  "attachedDrop + retract * retraction.lift",
  'attachedVerticalFitAuthority = "grounded-aircraft-door-progressive-tunnel-slope-v1"',
]) {
  if (controller.includes(forbidden)) {
    throw new Error(`${controllerPath}: floating-bogie child-lift behavior remains: ${forbidden}`);
  }
}

console.log("Verified exact A1 horizontal model-space retraction with zero attached child lift: the grounded bogie is preserved while the requested door-height gap remains diagnostic only.");
