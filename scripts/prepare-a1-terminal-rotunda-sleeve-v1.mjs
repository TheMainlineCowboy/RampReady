import fs from "node:fs";

const sourcePath = "src/environment/sourceRegisteredA1RotundaElbowV3.js";
const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;
const TERMINAL_WALL_HIDDEN_OVERLAP_METERS = 0.18;
const REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS = 0.14;

let source = fs.readFileSync(sourcePath, "utf8");

// The same-day A1 reference shows a short rigid white vestibule meeting the
// terminal-side Rotunda at a normal joint. Do not hide a placement error by
// burying metres of generated shell inside the authored Rotunda or terminal.
// Keep only a small construction overlap at each end so the exact supplied
// Rotunda remains visually readable and the real wall owns the attachment.
source = source
  .replace(
    /const ROTUNDA_SHELL_OVERLAP_METERS = [^;]+;/,
    `const ROTUNDA_SHELL_OVERLAP_METERS = ${ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)};`,
  )
  .replace(
    /const TERMINAL_HIDDEN_OVERLAP_METERS = [^;]+;/,
    `const TERMINAL_HIDDEN_OVERLAP_METERS = ${TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)};`,
  );

const compactBellowsFunction = source.indexOf("function addCompactRotundaBellows(");
const nextFunction = source.indexOf("function addRotundaBridgeBellowsSleeve(", compactBellowsFunction);
if (compactBellowsFunction < 0 || nextFunction < 0) {
  throw new Error(`${sourcePath}: compact terminal Rotunda bellows function was not found`);
}
const bellowsBlock = source.slice(compactBellowsFunction, nextFunction);
const requiredDepth = `  const depth = ${REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)};`;
if (!bellowsBlock.includes(requiredDepth)) {
  throw new Error(`${sourcePath}: terminal-to-Rotunda bellows must remain the compact ${REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)} m seam`);
}

for (const forbidden of [
  "const ROTUNDA_SHELL_OVERLAP_METERS = 1.50;",
  "const TERMINAL_HIDDEN_OVERLAP_METERS = 0.70;",
  "  const depth = 1.50;",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${sourcePath}: forbidden masking overlap survived: ${forbidden.trim()}`);
  }
}
for (const required of [
  `const ROTUNDA_SHELL_OVERLAP_METERS = ${ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)};`,
  `const TERMINAL_HIDDEN_OVERLAP_METERS = ${TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)};`,
]) {
  if (!source.includes(required)) throw new Error(`${sourcePath}: missing final A1 overlap ${required}`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log(`Prepared A1 terminal-to-Rotunda joint with only ${ROTUNDA_SHELL_OVERLAP_METERS.toFixed(2)} m Rotunda overlap and ${TERMINAL_WALL_HIDDEN_OVERLAP_METERS.toFixed(2)} m terminal-wall overlap; the exact supplied Rotunda remains visually exposed and the flexible seam stays ${REQUIRED_TERMINAL_ROTUNDA_BELLOWS_DEPTH_METERS.toFixed(2)} m deep.`);
