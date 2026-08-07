import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const SOURCE_WALL_MINIMUM_METERS = 3.4;
const SOURCE_WALL_MAXIMUM_METERS = 28;
const FINAL_VISIBLE_VESTIBULE_METERS = 2.4;

const compactSourceGuard = `  // The ramp-level structural source hit can be farther away because the
  // complete supplied A1 parent is relocated afterward. Keep that source
  // distance honest and bounded, while the final visible vestibule is enforced
  // independently at exactly 2.4 m.
  if (!(sourceTerminalDistance > ${SOURCE_WALL_MINIMUM_METERS} && sourceTerminalDistance < ${SOURCE_WALL_MAXIMUM_METERS})) {
    throw new Error(\`A1 ramp-level real-terminal source distance is invalid: \${sourceTerminalDistance}\`);
  }`;

const sourceGuardPatterns = [
  `  if (!(sourceTerminalDistance > A1_PHOTO_VISIBLE_VESTIBULE_METERS + 1 && sourceTerminalDistance < 28)) {
    throw new Error(\`A1 measured terminal wall distance is invalid for photo registration: \${sourceTerminalDistance}\`);
  }`,
  `  // The source wall distance is the package-authored A1 terminal anchor, not the
  // final visible vestibule span. Same-day A1 evidence shows a compact terminal
  // attachment; the 2.4 m visible vestibule is established independently below.
  if (!(sourceTerminalDistance > 0.4 && sourceTerminalDistance < 28)) {
    throw new Error(\`A1 measured compact terminal wall distance is invalid for photo registration: \${sourceTerminalDistance}\`);
  }`,
  `  // Same-day A1 ramp photos show the Rotunda immediately beside the real
  // terminal wall. A distant source anchor would recreate the fabricated long
  // corridor or reconnect the bridge to T4_WALK, so reject it rather than
  // hiding the placement error behind a generated vestibule.
  if (!(sourceTerminalDistance > 1.5 && sourceTerminalDistance < 4.1)) {
    throw new Error(\`A1 measured real-terminal wall span is not compact: \${sourceTerminalDistance}\`);
  }`,
];
let replacedSourceGuard = false;
for (const pattern of sourceGuardPatterns) {
  if (!source.includes(pattern)) continue;
  source = source.replace(pattern, compactSourceGuard);
  replacedSourceGuard = true;
  break;
}
if (!replacedSourceGuard && !source.includes("A1 ramp-level real-terminal source distance is invalid")) {
  throw new Error(`${installationPath}: A1 source-distance guard is missing`);
}

// Final geometry—not source search distance—must remain compact. The complete
// parent relocation computes terminalDistance from collar radius plus 2.4 m;
// no later stage may broaden that into a 12/28 m fabricated corridor.
source = source
  .replaceAll(
    "terminalDistance > 0.4 && terminalDistance < 28",
    "terminalDistance > rotundaOpening.collarRadius + 0.25 && terminalDistance < rotundaOpening.collarRadius + 4.1",
  )
  .replaceAll(
    "terminalDistance > 0.4 && terminalDistance < 12",
    "terminalDistance > rotundaOpening.collarRadius + 0.25 && terminalDistance < rotundaOpening.collarRadius + 4.1",
  )
  .replaceAll(
    "mainVisibleLength > 0.25 && mainVisibleLength < 28",
    "mainVisibleLength > 0.25 && mainVisibleLength < 4.1",
  )
  .replaceAll(
    "mainVisibleLength > 0.25 && mainVisibleLength < 12",
    "mainVisibleLength > 0.25 && mainVisibleLength < 4.1",
  );

for (const token of [
  `sourceTerminalDistance > ${SOURCE_WALL_MINIMUM_METERS}`,
  `sourceTerminalDistance < ${SOURCE_WALL_MAXIMUM_METERS}`,
  "A1 ramp-level real-terminal source distance is invalid",
  "sourceRotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  `A1_PHOTO_VISIBLE_VESTIBULE_METERS = ${FINAL_VISIBLE_VESTIBULE_METERS}`,
  "const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius",
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS) > 0.05",
  "mainVisibleLength < 4.1",
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: separated source/final A1 wall contract is missing ${token}`);
  }
}
for (const forbidden of [
  "sourceTerminalDistance > 1.5 && sourceTerminalDistance < 4.1",
  "terminalDistance < 28",
  "terminalDistance < 12",
  "mainVisibleLength < 28",
  "mainVisibleLength < 12",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${installationPath}: source/final A1 wall measurements are still conflated: ${forbidden}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Separated the ramp-level real-wall source distance from the final geometry: source hit 3.4-28 m, complete-parent relocation, and an exact 2.4 m visible vestibule with no later long-corridor allowance.");
