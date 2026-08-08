import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const HIDDEN_ROTUNDA_SHELL_OVERLAP_METERS = 1.50;
const REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS = 0.14;

let source = fs.readFileSync(sourcePath, "utf8");
const originalOverlap = "const ROTUNDA_SHELL_OVERLAP_METERS = 0.10;";
const preparedOverlap = `const ROTUNDA_SHELL_OVERLAP_METERS = ${HIDDEN_ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)};`;
const requiredDepth = `  const depth = ${REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)};`;

// The authored Rotunda's visible terminal opening is recessed behind its outer
// circular shell. Do not fill that recess with a long black generated collar.
// Instead, carry the existing white vestibule shell farther into the Rotunda so
// its extra length is hidden by the supplied Rotunda geometry and reaches the
// actual recessed opening. The flexible dark seam remains the compact 0.14 m
// frame from the source interface.
if (source.includes(originalOverlap)) {
  source = source.replace(originalOverlap, preparedOverlap);
} else if (!source.includes(preparedOverlap)) {
  throw new Error(`${sourcePath}: A1 Rotunda shell-overlap anchor was not found`);
}

const compactBellowsFunction = source.indexOf("function addCompactRotundaBellows(");
const nextFunction = source.indexOf("function addRotundaBridgeBellowsSleeve(", compactBellowsFunction);
if (compactBellowsFunction < 0 || nextFunction < 0) {
  throw new Error(`${sourcePath}: compact terminal Rotunda bellows function was not found`);
}
const bellowsBlock = source.slice(compactBellowsFunction, nextFunction);
if (!bellowsBlock.includes(requiredDepth)) {
  throw new Error(`${sourcePath}: terminal-to-Rotunda bellows must remain the compact ${REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)} m seam`);
}

for (const forbidden of [
  "const ROTUNDA_SHELL_OVERLAP_METERS = 0.55;",
  "  const depth = 1.50;",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: forbidden long black collar state survived: ${forbidden.trim()}`);
  }
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared A1 terminal-to-Rotunda joint with ${HIDDEN_ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)} m of white vestibule shell hidden inside the authored Rotunda recess and only a ${REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)} m dark flexible seam; no supplied jetway transform changed.`);
