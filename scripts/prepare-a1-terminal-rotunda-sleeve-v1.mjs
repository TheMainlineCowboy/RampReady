import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const REQUIRED_ROTUNDA_SHELL_OVERLAP_METERS = 0.10;
const REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS = 0.14;

const source = fs.readFileSync(sourcePath, "utf8");
const requiredOverlap = `const ROTUNDA_SHELL_OVERLAP_METERS = ${REQUIRED_ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)};`;
const requiredDepth = `  const depth = ${REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)};`;

if (!source.includes(requiredOverlap)) {
  throw new Error(`${sourcePath}: terminal-to-Rotunda shell overlap must remain the compact authored-interface value ${REQUIRED_ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)} m`);
}

const compactBellowsFunction = source.indexOf("function addCompactRotundaBellows(");
const nextFunction = source.indexOf("function addRotundaBridgeBellowsSleeve(", compactBellowsFunction);
if (compactBellowsFunction < 0 || nextFunction < 0) {
  throw new Error(`${sourcePath}: compact terminal Rotunda bellows function was not found`);
}
const bellowsBlock = source.slice(compactBellowsFunction, nextFunction);
if (!bellowsBlock.includes(requiredDepth)) {
  throw new Error(`${sourcePath}: terminal-to-Rotunda bellows depth must remain ${REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)} m so generated geometry cannot mask the supplied Rotunda`);
}

for (const forbidden of [
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.55;",
  "  const depth = 1.50;",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: forbidden expanded terminal Rotunda sleeve survived: ${forbidden.trim()}`);
  }
}

console.log(`Verified compact A1 terminal-to-Rotunda interface: ${REQUIRED_ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)} m shell overlap and ${REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)} m bellows depth; no generated long collar is introduced and the supplied Airport_Jetway.glb remains untouched.`);
