import fs from "node:fs";

const fleetPath = "src/environment/uploadedAirportJetwayFleet.js";
const doorFitPath = "src/environment/uploadedAirportJetwayA1DoorFitV11.js";
const importLine = 'import { createModelSpaceA1Controller, A1_MODEL_SPACE_RETRACTION_MODE_V7 } from "./uploadedAirportJetwayModelSpaceControllerV7.js";\n';
let source = fs.readFileSync(fleetPath, "utf8");
let doorFit = fs.readFileSync(doorFitPath, "utf8");

const oldDoorTarget = `// Measured directly from the exact authored CRJ. The visible forward entry
// door extends down as an integrated airstair, but the passenger-cabin threshold
// where a jetway hood meets the fuselage is approximately 2.52 m above grade.
const CRJ_FORWARD_LEFT_DOOR = Object.freeze({
  x: -1.35,
  centerY: 3.10,
  sillY: 2.52,
  z: 2.22,
});`;
const measuredDoorTarget = `// Measured from the exact authored CRJ forward-left door mesh. Its opening is
// X -1.292..-0.471 m, Y 1.803..3.736 m and Z 1.760..2.722 m. The hood floor
// therefore meets the real lower threshold, centered longitudinally on the door.
const CRJ_FORWARD_LEFT_DOOR = Object.freeze({
  x: -1.35,
  centerY: 2.77,
  sillY: 1.85,
  z: 2.24,
});`;
if (!doorFit.includes("sillY: 1.85")) {
  if (!doorFit.includes(oldDoorTarget)) {
    throw new Error(`${doorFitPath}: prior CRJ door target block is missing`);
  }
  doorFit = doorFit.replace(oldDoorTarget, measuredDoorTarget);
  fs.writeFileSync(doorFitPath, doorFit, "utf8");
}

doorFit = fs.readFileSync(doorFitPath, "utf8");
for (const token of [
  "X -1.292..-0.471 m",
  "centerY: 2.77",
  "sillY: 1.85",
  "z: 2.24",
  "pivotY: rotundaCenter.y",
  "const cabVerticalAdjustment = targetYInAnchor - cabAssembly.front.floorY",
]) {
  if (!doorFit.includes(token)) throw new Error(`${doorFitPath}: exact CRJ door fit is missing ${token}`);
}

const oldRetraction = 'const A1_RETRACTION = Object.freeze({ rotation: 0.052, tunnelB: 0.42, tunnelC: 0.78, cab: 1.18, lift: 0.08, totalClearanceMeters: 2.38 });';
const newRetraction = 'const A1_RETRACTION = Object.freeze({ rotation: 0.14, tunnelB: 0.79, tunnelC: 1.59, cab: 2.38, lift: 0.08, totalClearanceMeters: 2.38 });';
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
  "rotation: 0.14",
  "tunnelB: 0.79",
  "tunnelC: 1.59",
  "cab: 2.38",
  "createModelSpaceA1Controller(THREE",
  "modeAuthority: A1_MODEL_SPACE_RETRACTION_MODE_V7",
]) {
  if (!source.includes(token)) throw new Error(`${fleetPath}: model-space A1 retraction is missing ${token}`);
}

console.log("Prepared exact CRJ door threshold and supplied A1 departure: telescope B/C/Cab 0.79/1.59/2.38 m, then swing 0.14 rad around the Rotunda.");
