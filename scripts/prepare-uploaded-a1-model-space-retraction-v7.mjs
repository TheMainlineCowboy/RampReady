import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const source = fs.readFileSync(fleetPath, "utf8");
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
  if (!source.includes(token)) throw new Error(`${fleetPath}: exact A1 model-space retraction is missing ${token}`);
}
console.log("Prepared exact A1 model-space retraction: B 0.79 m, C 1.59 m, Cab 2.38 m, no yaw sweep.");
