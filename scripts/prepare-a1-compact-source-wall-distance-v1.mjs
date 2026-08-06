import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const MINIMUM_A1_WALL_SPAN_METERS = 1.5;
const MAXIMUM_A1_WALL_SPAN_METERS = 4.1;
const staleGuard = `  if (!(sourceTerminalDistance > A1_PHOTO_VISIBLE_VESTIBULE_METERS + 1 && sourceTerminalDistance < 28)) {
    throw new Error(\`A1 measured terminal wall distance is invalid for photo registration: \${sourceTerminalDistance}\`);
  }`;
const broadMeasuredGuard = `  // The source wall distance is the package-authored A1 terminal anchor, not the
  // final visible vestibule span. Same-day A1 evidence shows a compact terminal
  // attachment; the 2.4 m visible vestibule is established independently below.
  if (!(sourceTerminalDistance > 0.4 && sourceTerminalDistance < 28)) {
    throw new Error(\`A1 measured compact terminal wall distance is invalid for photo registration: \${sourceTerminalDistance}\`);
  }`;
const compactMeasuredGuard = `  // Same-day A1 ramp photos show the Rotunda immediately beside the real
  // terminal wall. A distant source anchor would recreate the fabricated long
  // corridor or reconnect the bridge to T4_WALK, so reject it rather than
  // hiding the placement error behind a generated vestibule.
  if (!(sourceTerminalDistance > ${MINIMUM_A1_WALL_SPAN_METERS} && sourceTerminalDistance < ${MAXIMUM_A1_WALL_SPAN_METERS})) {
    throw new Error(\`A1 measured real-terminal wall span is not compact: \${sourceTerminalDistance}\`);
  }`;

if (source.includes(staleGuard)) {
  source = source.replace(staleGuard, compactMeasuredGuard);
} else if (source.includes(broadMeasuredGuard)) {
  source = source.replace(broadMeasuredGuard, compactMeasuredGuard);
} else if (!source.includes("A1 measured real-terminal wall span is not compact")) {
  throw new Error(`${installationPath}: A1 source-distance guard is missing`);
}

for (const [before, after] of [
  ["terminalDistance > 0.4 && terminalDistance < 28", `terminalDistance > ${MINIMUM_A1_WALL_SPAN_METERS} && terminalDistance < ${MAXIMUM_A1_WALL_SPAN_METERS}`],
  ["terminalDistance > 0.4 && terminalDistance < 12", `terminalDistance > ${MINIMUM_A1_WALL_SPAN_METERS} && terminalDistance < ${MAXIMUM_A1_WALL_SPAN_METERS}`],
  ["sourceTerminalDistance > 0.4 && sourceTerminalDistance < 28", `sourceTerminalDistance > ${MINIMUM_A1_WALL_SPAN_METERS} && sourceTerminalDistance < ${MAXIMUM_A1_WALL_SPAN_METERS}`],
  ["mainVisibleLength > 0.25 && mainVisibleLength < 28", `mainVisibleLength > 0.25 && mainVisibleLength < ${MAXIMUM_A1_WALL_SPAN_METERS}`],
  ["mainVisibleLength > 0.25 && mainVisibleLength < 12", `mainVisibleLength > 0.25 && mainVisibleLength < ${MAXIMUM_A1_WALL_SPAN_METERS}`],
]) {
  source = source.replaceAll(before, after);
}

for (const token of [
  `sourceTerminalDistance > ${MINIMUM_A1_WALL_SPAN_METERS}`,
  `sourceTerminalDistance < ${MAXIMUM_A1_WALL_SPAN_METERS}`,
  "A1 measured real-terminal wall span is not compact",
  "sourceRotundaOpening.collarRadius + A1_PHOTO_VISIBLE_VESTIBULE_METERS",
  `mainVisibleLength < ${MAXIMUM_A1_WALL_SPAN_METERS}`,
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: compact source-wall correction is missing ${token}`);
  }
}
for (const forbidden of [
  "sourceTerminalDistance < 28",
  "terminalDistance < 28",
  "mainVisibleLength < 28",
  "terminalDistance < 12",
  "mainVisibleLength < 12",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${installationPath}: long A1 corridor allowance remains: ${forbidden}`);
  }
}

fs.writeFileSync(installationPath, source, "utf8");
console.log("Required the A1 Rotunda to meet the real Terminal 4 wall through a compact 1.5-4.1 m source span; distant walkway and long-corridor anchors now fail closed.");
