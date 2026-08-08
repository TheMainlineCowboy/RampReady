import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const ROTUNDA_SHELL_OVERLAP_METERS = 0.55;
const TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS = 0.90;

let source = fs.readFileSync(sourcePath, "utf8");

const oldOverlap = "const ROTUNDA_SHELL_OVERLAP_METERS = 0.10;";
const preparedOverlap = `const ROTUNDA_SHELL_OVERLAP_METERS = ${ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)};`;
if (source.includes(oldOverlap)) {
  source = source.replace(oldOverlap, preparedOverlap);
} else if (!source.includes(preparedOverlap)) {
  throw new Error(`${sourcePath}: A1 terminal Rotunda overlap anchor was not found`);
}

const compactBellowsFunction = source.indexOf("function addCompactRotundaBellows(");
const nextFunction = source.indexOf("function addRotundaBridgeBellowsSleeve(", compactBellowsFunction);
if (compactBellowsFunction < 0 || nextFunction < 0) {
  throw new Error(`${sourcePath}: compact terminal Rotunda bellows function was not found`);
}
const beforeBellows = source.slice(0, compactBellowsFunction);
let bellowsBlock = source.slice(compactBellowsFunction, nextFunction);
const afterBellows = source.slice(nextFunction);
const oldDepth = "  const depth = 0.14;";
const preparedDepth = `  const depth = ${TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)};`;
if (bellowsBlock.includes(oldDepth)) {
  bellowsBlock = bellowsBlock.replace(oldDepth, preparedDepth);
} else if (!bellowsBlock.includes(preparedDepth)) {
  throw new Error(`${sourcePath}: compact terminal Rotunda bellows depth anchor was not found`);
}
source = beforeBellows + bellowsBlock + afterBellows;

if (!source.includes(preparedOverlap) || !source.includes(preparedDepth)) {
  throw new Error(`${sourcePath}: final terminal Rotunda sleeve values were not installed`);
}
if (source.includes(oldOverlap) || bellowsBlock.includes(oldDepth)) {
  throw new Error(`${sourcePath}: stale detached terminal Rotunda sleeve values survived preparation`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared A1 terminal-to-Rotunda flexible sleeve: ${ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)} m shell overlap and ${TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)} m enclosed bellows depth; no jetway parent or supplied child transform changed.`);
