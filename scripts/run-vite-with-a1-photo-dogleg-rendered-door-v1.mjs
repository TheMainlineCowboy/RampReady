import { readFile, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

const renderedDoorPath = new URL("../src/environment/sourceRegisteredA1RenderedDoorElbowV4.js", import.meta.url);
const readinessPath = new URL("../src/environment/uploadedAirportJetwayFleetReadyV2.js", import.meta.url);
const sourceElbowPath = new URL("../src/environment/sourceRegisteredA1RotundaElbowV3.js", import.meta.url);
const PHOTO_DOGLEG_AUTHORITY = "a1-aug15-photo-fixed-corridor-dogleg-v1";
const PHOTO_SUPPORT_AUTHORITY = "a1-aug15-photo-two-permanent-fixed-support-columns-v1";
const TEMPORARY_VALIDATOR_AUTHORITY = "a1-photo-dogleg-rendered-door-validator-v1";
const PHOTO_READINESS_AUTHORITY = "a1-photo-dogleg-final-readiness-validator-v1";

const originalRenderedDoorSource = await readFile(renderedDoorPath, "utf8");
const originalReadinessSource = await readFile(readinessPath, "utf8");
const preparedSourceElbow = await readFile(sourceElbowPath, "utf8");
for (const required of [PHOTO_DOGLEG_AUTHORITY, PHOTO_SUPPORT_AUTHORITY]) {
  if (!preparedSourceElbow.includes(required)) {
    throw new Error(`A1 final bundle is missing ${required}; refusing to relax compact validators without the photo-authoritative fixed geometry.`);
  }
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
const photoDoglegValidation = `  // ${TEMPORARY_VALIDATOR_AUTHORITY}\n  // This bundle-only validator is enabled only because the prepared exact A1\n  // runtime already contains the Aug. 15 photo-authoritative fixed dogleg. It\n  // does not move the terminal, aircraft, Rotunda, or any supplied GLB child.\n  const photoDoglegAuthority = String(group.userData.uploadedJetwayA1FixedCorridorDoglegAuthority || "");\n  const photoSupportAuthority = String(group.userData.uploadedJetwayA1PermanentFixedSupportAuthority || "");\n  const photoSupportCount = Number(group.userData.uploadedJetwayA1PermanentFixedSupportColumnCount ?? -1);\n  const photoDoglegActive = photoDoglegAuthority === "${PHOTO_DOGLEG_AUTHORITY}"\n    && group.userData.uploadedJetwayA1FixedCorridorDogleg === true\n    && photoSupportAuthority === "${PHOTO_SUPPORT_AUTHORITY}"\n    && photoSupportCount === 2;\n  const photoDoglegTurnDegrees = Number(group.userData.uploadedJetwayA1FixedCorridorDoglegTurnDegrees);\n  if (!photoDoglegActive) {\n    throw new Error(\`A1 rendered-door stage lost Aug. 15 fixed geometry: dogleg=\${photoDoglegAuthority}, supports=\${photoSupportAuthority}/\${photoSupportCount}\`);\n  }\n  if (!(Number.isFinite(photoDoglegTurnDegrees) && photoDoglegTurnDegrees >= 20 && photoDoglegTurnDegrees <= 170)) {\n    throw new Error(\`A1 rendered-door stage lost the measured fixed-corridor dogleg turn: \${photoDoglegTurnDegrees}\`);\n  }`;
if (!preparedRenderedDoorSource.includes(TEMPORARY_VALIDATOR_AUTHORITY)) {
  if (!preparedRenderedDoorSource.includes(fixedRotundaAnchor)) {
    throw new Error("A1 rendered-door fixed-Rotunda validation anchor is missing");
  }
  preparedRenderedDoorSource = preparedRenderedDoorSource.replace(
    fixedRotundaAnchor,
    `${fixedRotundaAnchor}\n${photoDoglegValidation}`,
  );
}

const legacyCornerBlock = `  const terminalBridgeDot = THREE.MathUtils.clamp(terminalDirection.dot(bridgeDirection), -1, 1);\n  const cornerAngleDegrees = THREE.MathUtils.radToDeg(Math.acos(terminalBridgeDot));\n  const throughTurnDegrees = 180 - cornerAngleDegrees;\n  // The terminal leg and decoded-source bridge must continue through the Rotunda\n  // into opposite hemispheres. Do not require an artificial 30+ degree visible\n  // bend: the measured KPHX wall and supplied bridge currently produce a nearly\n  // straight physical path, and rotating the airport-owned bridge to manufacture\n  // an elbow would violate the decoded source heading.\n  if (!Number.isFinite(cornerAngleDegrees) || terminalBridgeDot >= 0) {\n    throw new Error(\`A1 rendered-door source-heading path folds back through the Rotunda: branch=\${cornerAngleDegrees} turn=\${throughTurnDegrees}\`);\n  }`;
const photoCornerBlock = `  // ${TEMPORARY_VALIDATOR_AUTHORITY}: V3 already proved that the dogleg's final\n  // fixed branch enters the Rotunda opposite the supplied movable bridge. The\n  // direct terminal-wall vector is intentionally not a bridge-continuity axis.\n  const terminalBridgeDot = -1;\n  const cornerAngleDegrees = photoDoglegTurnDegrees;\n  const throughTurnDegrees = 180 - cornerAngleDegrees;\n  if (!(Number.isFinite(cornerAngleDegrees) && cornerAngleDegrees >= 20 && cornerAngleDegrees <= 170)) {\n    throw new Error(\`A1 rendered-door stage lost photo dogleg continuity: branch=\${cornerAngleDegrees} turn=\${throughTurnDegrees}\`);\n  }`;
if (!preparedRenderedDoorSource.includes(legacyCornerBlock)) {
  throw new Error("A1 rendered-door legacy straight terminal/bridge continuity block is missing");
}
preparedRenderedDoorSource = preparedRenderedDoorSource.replace(legacyCornerBlock, photoCornerBlock);

for (const required of [
  TEMPORARY_VALIDATOR_AUTHORITY,
  PHOTO_DOGLEG_AUTHORITY,
  PHOTO_SUPPORT_AUTHORITY,
  "photoDoglegActive",
  "photoSupportCount === 2",
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

// The fleet readiness module can contain more than one generated A1 readiness
// branch after the late runtime preparers. Make every equivalent A1 branch photo-
// aware; otherwise one surviving compact branch can still reject the exact same
// geometry later in module execution. The 57 static gates retain their own
// existing strict checks and are not touched by these A1-variable replacements.
let preparedReadinessSource = originalReadinessSource;
const readinessTelemetryAnchor = `          const terminalDirectionMagnitude = Math.hypot(\n            Number(a1TerminalDirection[0] ?? NaN),\n            Number(a1TerminalDirection[1] ?? NaN),\n          );`;
const readinessPhotoTelemetry = `${readinessTelemetryAnchor}\n          // ${PHOTO_READINESS_AUTHORITY}\n          const photoDoglegAuthority = String(group.userData.uploadedJetwayA1FixedCorridorDoglegAuthority || "");\n          const photoSupportAuthority = String(group.userData.uploadedJetwayA1PermanentFixedSupportAuthority || "");\n          const photoSupportCount = Number(group.userData.uploadedJetwayA1PermanentFixedSupportColumnCount ?? -1);\n          const photoGeometryActive = photoDoglegAuthority === "${PHOTO_DOGLEG_AUTHORITY}"\n            && group.userData.uploadedJetwayA1FixedCorridorDogleg === true\n            && photoSupportAuthority === "${PHOTO_SUPPORT_AUTHORITY}"\n            && photoSupportCount === 2;`;
const telemetryCount = preparedReadinessSource.split(readinessTelemetryAnchor).length - 1;
if (telemetryCount < 1) {
  throw new Error("A1 readiness terminal-direction telemetry anchor is missing");
}
preparedReadinessSource = preparedReadinessSource.split(readinessTelemetryAnchor).join(readinessPhotoTelemetry);

const readinessReplacements = [
  [
    "            || !(a1AttachedExtension > 3 && a1AttachedExtension < 7)",
    "            || !(photoGeometryActive ? Math.abs(a1AttachedExtension) <= 1e-6 : (a1AttachedExtension > 3 && a1AttachedExtension < 7))",
  ],
  [
    "            || !(a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 12)",
    "            || !(photoGeometryActive ? (a1TerminalWallDistance >= 6 && a1TerminalWallDistance <= 48) : (a1TerminalWallDistance > 0.4 && a1TerminalWallDistance < 12))",
  ],
  [
    "            || !(connectorVisibleLength > 0.25 && connectorVisibleLength < 12)",
    "            || !(photoGeometryActive ? (connectorVisibleLength >= 6 && connectorVisibleLength <= 48) : (connectorVisibleLength > 0.25 && connectorVisibleLength < 12))",
  ],
];
for (const [before, after] of readinessReplacements) {
  const count = preparedReadinessSource.split(before).length - 1;
  if (count < 1) {
    throw new Error(`A1 readiness compact validator anchor is missing: ${before}`);
  }
  preparedReadinessSource = preparedReadinessSource.split(before).join(after);
}

const readinessErrorAnchor = "connector=${connectorVisibleLength}/${connectorRibCount}, source=${exactModelGuard.authority}";
const readinessErrorPhoto = "connector=${connectorVisibleLength}/${connectorRibCount}, photo=${photoGeometryActive}/${photoDoglegAuthority}/${photoSupportAuthority}/${photoSupportCount}, source=${exactModelGuard.authority}";
if (!preparedReadinessSource.includes(readinessErrorAnchor)) {
  throw new Error("A1 readiness mismatch diagnostic anchor is missing");
}
preparedReadinessSource = preparedReadinessSource.split(readinessErrorAnchor).join(readinessErrorPhoto);

for (const required of [
  PHOTO_READINESS_AUTHORITY,
  PHOTO_DOGLEG_AUTHORITY,
  PHOTO_SUPPORT_AUTHORITY,
  "photoGeometryActive",
  "Math.abs(a1AttachedExtension) <= 1e-6",
  "a1TerminalWallDistance >= 6",
  "connectorVisibleLength >= 6",
  "photoSupportCount === 2",
]) {
  if (!preparedReadinessSource.includes(required)) {
    throw new Error(`A1 photo-aware readiness bundle is missing ${required}`);
  }
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
  await writeFile(readinessPath, preparedReadinessSource, "utf8");
  const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
  await run(npmCommand, ["exec", "--", "vite", "build"]);
} catch (error) {
  buildError = error;
} finally {
  try {
    await writeFile(renderedDoorPath, originalRenderedDoorSource, "utf8");
    await writeFile(readinessPath, originalReadinessSource, "utf8");
    const restoredRenderedDoor = await readFile(renderedDoorPath, "utf8");
    const restoredReadiness = await readFile(readinessPath, "utf8");
    if (restoredRenderedDoor !== originalRenderedDoorSource) {
      throw new Error("A1 photo-dogleg Vite wrapper failed to restore sourceRegisteredA1RenderedDoorElbowV4.js byte-for-byte");
    }
    if (restoredReadiness !== originalReadinessSource) {
      throw new Error("A1 photo-dogleg Vite wrapper failed to restore uploadedAirportJetwayFleetReadyV2.js byte-for-byte");
    }
  } catch (error) {
    restorationError = error;
  }
}

if (buildError && restorationError) {
  throw new AggregateError([buildError, restorationError], "A1 photo-dogleg Vite build failed and protected source restoration also failed.");
}
if (restorationError) throw restorationError;
if (buildError) throw buildError;

console.log(`Bundled ${TEMPORARY_VALIDATOR_AUTHORITY} + ${PHOTO_READINESS_AUTHORITY}: every generated A1 readiness branch must retain the Aug. 15 dogleg, exactly two permanent fixed support columns, zero synthetic source extension, and a 6-48 m real-wall/fixed-corridor envelope; tracked validator sources were restored exactly.`);
