import fs from "node:fs";

const installationPath = "src/environment/correctUploadedJetwayInstallationV1.js";
let source = fs.readFileSync(installationPath, "utf8");

const marker = "post-fixed-rotunda-a1-measured-short-terminal-span-v2";
const MIN_VISIBLE_TERMINAL_LEG_METERS = 0.15;
const MAX_VISIBLE_TERMINAL_LEG_METERS = 4.5;

// The physical Rotunda-elbow stage already computes terminalDistance from the
// aligned authored opening to the measured structural wall. Do not relocate A1
// again to manufacture the historical 2.40 m photo constant. Keep only a short,
// physically measured fixed leg and fail closed on a long/fabricated corridor.
const spanPattern = /  const terminalDistance = wallOffsetX \* rotundaOpening\.openingDirectionX\n    \+ wallOffsetZ \* rotundaOpening\.openingDirectionZ;\n  if \(!\(terminalDistance > rotundaOpening\.collarRadius \+ 0\.25 && terminalDistance < 12\)\) \{\n    throw new Error\(`A1 (?:cab-pivot|fixed-Rotunda) terminal span is invalid: \\?\$\{terminalDistance\}`\);\n  \}/;

if (!source.includes(marker)) {
  const match = source.match(spanPattern);
  if (!match) {
    throw new Error(`${installationPath}: measured post-elbow terminal span block is missing`);
  }
  const replacement = `  const terminalDistance = wallOffsetX * rotundaOpening.openingDirectionX
    + wallOffsetZ * rotundaOpening.openingDirectionZ;
  const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius;
  // ${marker}: the final fixed leg is measured from the physically aligned
  // Rotunda aperture to the real structural wall. No magic 2.40 m relocation.
  if (!(actualVisibleVestibuleMeters > ${MIN_VISIBLE_TERMINAL_LEG_METERS}
    && actualVisibleVestibuleMeters < ${MAX_VISIBLE_TERMINAL_LEG_METERS})) {
    throw new Error(\`A1 fixed-Rotunda measured terminal leg is not physically short: total=\${terminalDistance}, visible=\${actualVisibleVestibuleMeters}\`);
  }`;
  source = source.replace(match[0], replacement);
}

// The elbow writer historically declares this once more immediately before the
// connector. Keep one declaration so all later code consumes the same measured
// value established above.
const duplicateVisibleDeclaration = `
  const actualVisibleVestibuleMeters = terminalDistance - rotundaOpening.collarRadius;
  const correctedA1Placement = Object.freeze({`;
if (source.includes(duplicateVisibleDeclaration)) {
  source = source.replace(
    duplicateVisibleDeclaration,
    `
  const correctedA1Placement = Object.freeze({`,
  );
}

for (const token of [
  marker,
  `actualVisibleVestibuleMeters > ${MIN_VISIBLE_TERMINAL_LEG_METERS}`,
  `actualVisibleVestibuleMeters < ${MAX_VISIBLE_TERMINAL_LEG_METERS}`,
  "A1 fixed-Rotunda measured terminal leg is not physically short",
  "connector.userData.visibleMainLengthMeters = actualVisibleVestibuleMeters",
]) {
  if (!source.includes(token)) {
    throw new Error(`${installationPath}: measured fixed-Rotunda A1 span is missing ${token}`);
  }
}
for (const forbidden of [
  "post-rigid-a1-exact-visible-vestibule-span-v1",
  "A1 post-orientation terminal span is not the same-day-photo 2.4 m vestibule",
  "Math.abs(actualVisibleVestibuleMeters - A1_PHOTO_VISIBLE_VESTIBULE_METERS)",
]) {
  if (source.includes(forbidden)) {
    throw new Error(`${installationPath}: stale magic-distance A1 span survived physical elbow preparation: ${forbidden}`);
  }
}
const visibleDeclarationCount = (source.match(/const actualVisibleVestibuleMeters =/g) || []).length;
if (visibleDeclarationCount !== 1) {
  throw new Error(`${installationPath}: expected one measured post-elbow visible-leg declaration, received ${visibleDeclarationCount}`);
}

fs.writeFileSync(installationPath, source, "utf8");
console.log(`Preserved the physical A1 Rotunda elbow span: final terminal leg must be measured from the aligned authored opening and stay between ${MIN_VISIBLE_TERMINAL_LEG_METERS.toFixed(2)} and ${MAX_VISIBLE_TERMINAL_LEG_METERS.toFixed(2)} m; no 2.40 m relocation is allowed.`);
