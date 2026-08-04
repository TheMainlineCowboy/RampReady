import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const importLine = 'import { createModelSpaceA1Controller, A1_MODEL_SPACE_RETRACTION_MODE_V7 } from "./uploadedAirportJetwayModelSpaceControllerV7.js";\n';
let source = fs.readFileSync(fleetPath, "utf8");

const oldRetraction = 'const A1_RETRACTION = Object.freeze({ rotation: 0.052, tunnelB: 0.42, tunnelC: 0.78, cab: 1.18, lift: 0.08, totalClearanceMeters: 2.38 });';
const newRetraction = 'const A1_RETRACTION = Object.freeze({ rotation: 0, tunnelB: 0.79, tunnelC: 1.59, cab: 2.38, lift: 0.08, totalClearanceMeters: 2.38 });';
const oldFactory = "const controller = createController();";
const newFactory = `const controller = createModelSpaceA1Controller(THREE, {
    retraction: A1_RETRACTION,
    authority: A1_RETRACTION_AUTHORITY,
    modeAuthority: A1_MODEL_SPACE_RETRACTION_MODE_V7,
  });`;

if (!source.includes("A1_MODEL_SPACE_RETRACTION_MODE_V7")) {
  if (!source.includes(oldRetraction)) {
    throw new Error(`${fleetPath}: legacy A1 retraction constants are missing`);
  }
  if (!source.includes(oldFactory)) {
    throw new Error(`${fleetPath}: legacy A1 controller factory call is missing`);
  }
  source = `${importLine}${source}`;
  source = source.replace(oldRetraction, newRetraction);
  source = source.replace(oldFactory, newFactory);
  fs.writeFileSync(fleetPath, source, "utf8");
}

source = fs.readFileSync(fleetPath, "utf8");
for (const token of [
  "uploadedAirportJetwayModelSpaceControllerV7.js",
  "A1_MODEL_SPACE_RETRACTION_MODE_V7",
  "tunnelB: 0.79",
  "tunnelC: 1.59",
  "cab: 2.38",
  "createModelSpaceA1Controller(THREE",
  "modeAuthority: A1_MODEL_SPACE_RETRACTION_MODE_V7",
]) {
  if (!source.includes(token)) throw new Error(`${fleetPath}: model-space A1 retraction is missing ${token}`);
}

console.log("Prepared supplied A1 model-space retraction through an imported controller: B 0.79 m, C 1.59 m, Cab 2.38 m, no yaw sweep.");
