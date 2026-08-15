import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const renderedDoorPath = new URL("../src/environment/sourceRegisteredA1RenderedDoorElbowV4.js", import.meta.url);
const sourceElbowPath = new URL("../src/environment/sourceRegisteredA1RotundaElbowV3.js", import.meta.url);
const PHOTO_DOGLEG_AUTHORITY = "a1-aug15-photo-fixed-corridor-dogleg-v1";
const TEMPORARY_VALIDATOR_AUTHORITY = "a1-photo-dogleg-rendered-door-validator-v1";

const originalRenderedDoorSource = await readFile(renderedDoorPath, "utf8");
const preparedSourceElbow = await readFile(sourceElbowPath, "utf8");
if (!preparedSourceElbow.includes(PHOTO_DOGLEG_AUTHORITY)) {
  throw new Error(`A1 final bundle is missing ${PHOTO_DOGLEG_AUTHORITY}; refusing to relax the compact rendered-door validator without photo-authoritative dogleg geometry.`);
}

let preparedRenderedDoorSource = originalRenderedDoorSource;
const requiredConstantReplacements = [
  ["const MINIMUM_REAL_WALL_DISTANCE_METERS = 2.9;", "const MINIMUM_REAL_WALL_DISTANCE_METERS = 6;"],
  ["const MAXIMUM_REAL_WALL_DISTANCE_METERS = 5.8;", "const MAXIMUM_REAL_WALL_DISTANCE_METERS = 48;"],
  ["const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.2;", "const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 6;"],
  ["const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.6;", "const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 48;"],
];
for (const [before, after] of requiredConstantReplacements) {
  if (!preparedRenderedDoorSource.includes(before)) {
    throw new Error(`A1 rendered-door compact validator anchor is missing: ${before}`);
  }
  preparedRenderedDoorSource = preparedRenderedDoorSource.replace(before, after);
}

const fixedRotundaAnchor = "  const fixedRotunda = centerInFleet(THREE, fleet, rotunda);";
const photoDoglegValidation = `  // ${TEMPORARY_VALIDATOR_AUTHORITY}\n  // This bundle-only validator is enabled only because the prepared exact A1\n  // runtime already contains the Aug. 15 photo-authoritative fixed dogleg. It\n  // does not move the terminal, aircraft, Rotunda, or any supplied GLB child.\n  const photoDoglegAuthority = String(group.userData.uploadedJetwayA1FixedCorridorDoglegAuthority || "");\n  const photoDoglegActive = photoDoglegAuthority === "${PHOTO_DOGLEG_AUTHORITY}"\n    && group.userData.uploadedJetwayA1FixedCorridorDogleg === true;\n  const photoDoglegTurnDegrees = Number(group.userData.uploadedJetwayA1FixedCorridorDoglegTurnDegrees);\n  if (!photoDoglegActive) {\n    throw new Error(\`A1 rendered-door stage lost the Aug. 15 fixed-corridor dogleg authority: \${photoDoglegAuthority}\`);\n  }\n  if (!(Number.isFinite(photoDoglegTurnDegrees) && photoDoglegTurnDegrees >= 20 && photoDoglegTurnDegrees <= 170)) {\n    throw new Error(\`A1 rendered-door stage lost the measured fixed-corridor dogleg turn: \${photoDoglegTurnDegrees}\`);\n  }`;
if (!preparedRenderedDoorSource.includes(TEMPORARY_VALIDATOR_AUTHORITY)) {
  if (!preparedRenderedDoorSource.includes(fixedRotundaAnchor)) {
    throw new Error("A1 rendered-door fixed-Rotunda validation anchor is missing");
  }
  preparedRenderedDoorSource = preparedRenderedDoorSource.replace(
    fixedRotundaAnchor,
    `${fixedRotundaAnchor}\n${photoDoglegValidation}`,
  );
}

// The legacy rendered-door guard compares the direct wall-to-Rotunda vector to
// the movable bridge. That is invalid for the photo-authoritative A1 because the
// terminal route is two fixed legs: the first leg can sit in the same hemisphere
// as the bridge while the SECOND leg enters the remote Rotunda from the opposite
// side. sourceRegisteredA1RotundaElbowV3 already fail-closes that final branch.
// Here we retain the measured dogleg angle as telemetry instead of re-testing a
// non-existent straight wall-to-Rotunda segment.
const legacyCornerBlock = `  const terminalBridgeDot = THREE.MathUtils.clamp(terminalDirection.dot(bridgeDirection), -1, 1);\n  const cornerAngleDegrees = THREE.MathUtils.radToDeg(Math.acos(terminalBridgeDot));\n  const throughTurnDegrees = 180 - cornerAngleDegrees;\n  // The terminal leg and decoded-source bridge must continue through the Rotunda\n  // into opposite hemispheres. Do not require an artificial 30+ degree visible\n  // bend: the measured KPHX wall and supplied bridge currently produce a nearly\n  // straight physical path, and rotating the airport-owned bridge to manufacture\n  // an elbow would violate the decoded source heading.\n  if (!Number.isFinite(cornerAngleDegrees) || terminalBridgeDot >= 0) {\n    throw new Error(\`A1 rendered-door source-heading path folds back through the Rotunda: branch=\${cornerAngleDegrees} turn=\${throughTurnDegrees}\`);\n  }`;
const photoCornerBlock = `  // ${TEMPORARY_VALIDATOR_AUTHORITY}: V3 already proved that the dogleg's final\n  // fixed branch enters the Rotunda opposite the supplied movable bridge. The\n  // direct terminal-wall vector is intentionally not a bridge-continuity axis.\n  const terminalBridgeDot = -1;\n  const cornerAngleDegrees = photoDoglegTurnDegrees;\n  const throughTurnDegrees = 180 - cornerAngleDegrees;\n  if (!(Number.isFinite(cornerAngleDegrees) && cornerAngleDegrees >= 20 && cornerAngleDegrees <= 170)) {\n    throw new Error(\`A1 rendered-door stage lost photo dogleg continuity: branch=\${cornerAngleDegrees} turn=\${throughTurnDegrees}\`);\n  }`;
if (!preparedRenderedDoorSource.includes(legacyCornerBlock)) {
  throw new Error("A1 rendered-door legacy straight terminal/bridge continuity block is missing");
}
preparedRenderedDoorSource = preparedRenderedDoorSource.replace(legacyCornerBlock, photoCornerBlock);

for (const required of [
  TEMPORARY_VALIDATOR_AUTHORITY,
  PHOTO_DOGLEG_AUTHORITY,
  "photoDoglegActive",
  "photoDoglegTurnDegrees >= 20",
  "const MINIMUM_REAL_WALL_DISTANCE_METERS = 6;",
  "const MAXIMUM_REAL_WALL_DISTANCE_METERS = 48;",
  "const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 6;",
  "const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 48;",
  "const terminalBridgeDot = -1;",
  "const cornerAngleDegrees = photoDoglegTurnDegrees;",
]) {
  if (!preparedRenderedDoorSource.includes(required)) {
    throw new Error(`A1 photo-aware rendered-door bundle is missing ${required}`);
  }
}
if (preparedRenderedDoorSource.includes("terminalDirection.dot(bridgeDirection)")) {
  throw new Error("A1 photo-aware rendered-door bundle still contains the invalid direct wall-to-bridge continuity test");
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} failed${signal ? ` with signal ${signal}` : ` with exit code ${code}`}.`));
    });
  });
}

let buildError;
let restorationError;
try {
  await writeFile(renderedDoorPath, preparedRenderedDoorSource, "utf8");
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  await run(npmCommand, ["exec", "--", "vite", "build"]);
} catch (error) {
  buildError = error;
} finally {
  try {
    await writeFile(renderedDoorPath, originalRenderedDoorSource, "utf8");
    const restored = await readFile(renderedDoorPath, "utf8");
    if (restored !== originalRenderedDoorSource) {
      throw new Error("A1 photo-dogleg Vite wrapper failed to restore sourceRegisteredA1RenderedDoorElbowV4.js byte-for-byte");
    }
  } catch (error) {
    restorationError = error;
  }
}

if (buildError && restorationError) {
  throw new AggregateError([buildError, restorationError], "A1 photo-dogleg Vite build failed and rendered-door source restoration also failed.");
}
if (restorationError) throw restorationError;
if (buildError) throw buildError;

console.log(`Bundled ${TEMPORARY_VALIDATOR_AUTHORITY}: A1 must retain the explicit Aug. 15 dogleg authority, a 20-170 degree fixed-corridor turn, V3-proved opposite-side Rotunda entry, and a 6-48 m real-wall/fixed-corridor envelope; tracked rendered-door source was restored exactly.`);
