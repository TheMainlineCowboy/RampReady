import fs from "node:fs";

const buildPath = "scripts/build-production.mjs";
const oldMarker = "a1-final-rigid-scene-registration-hook-v1";
const marker = "a1-final-rigid-scene-registration-hook-v2-source-wheel-contact";
const stairRun = '  await run(process.execPath, ["scripts/prepare-a1-aircraft-side-service-stair-clearance-v1.mjs"]);';
const oldSupportRun = '  await run(process.execPath, ["scripts/prepare-a1-visible-tunnel-c-support-grounding-v1.mjs"]);';
const oldSupportV2Run = '  await run(process.execPath, ["scripts/prepare-a1-visible-tunnel-c-support-grounding-v2.mjs"]);';
const terminalContinuityRun = '  await run(process.execPath, ["scripts/prepare-a1-terminal-continuity-final-v1.mjs"]);';
const sourceParkingRun = '  await run(process.execPath, ["scripts/prepare-a1-source-parking-final-v1.mjs"]);';
const supportSleeveRun = '  await run(process.execPath, ["scripts/prepare-a1-visible-support-sleeves-v1.mjs"]);';
const bogieRun = '  await run(process.execPath, ["scripts/prepare-a1-bogie-footprint-camera-v1.mjs"]);';

let source = fs.readFileSync(buildPath, "utf8");
if (!source.includes(stairRun)) throw new Error(`${buildPath}: final service-stair solve hook is missing`);
if (!source.includes(bogieRun)) throw new Error(`${buildPath}: final bogie evidence hook is missing`);

// Do not mutate supplied support vertices and do not draw synthetic black columns
// beneath whichever small disconnected component a detector happened to find.
// V9 fleet registration now seats the intact A1 parent from compact supplied
// Tunnel-C wheel/contact geometry. The original support/wheel geometry must be
// visible at pavement by itself; otherwise final bogie evidence must fail.
for (const obsolete of [oldSupportRun, oldSupportV2Run, supportSleeveRun]) {
  source = source.replaceAll(`${obsolete}\n`, "");
  source = source.replaceAll(obsolete, "");
}

if (!source.includes(marker)) {
  // Preserve the final terminal seal and fixed aircraft registration stages, but
  // eliminate the synthetic sleeve stage that produced disconnected hanging bars.
  if (!source.includes(terminalContinuityRun)) {
    source = source.replace(stairRun, `${stairRun}\n  // ${marker}\n${terminalContinuityRun}\n${sourceParkingRun}`);
  } else if (!source.includes(sourceParkingRun)) {
    source = source.replace(terminalContinuityRun, `${terminalContinuityRun}\n${sourceParkingRun}`);
  }
  if (source.includes(oldMarker)) source = source.replaceAll(oldMarker, marker);
  else if (!source.includes(marker)) source = source.replace(stairRun, `${stairRun}\n  // ${marker}`);
}

for (const required of [marker, stairRun, terminalContinuityRun, sourceParkingRun, bogieRun]) {
  if (!source.includes(required)) throw new Error(`${buildPath}: final source-wheel registration hook is missing ${required}`);
}
for (const forbidden of [oldSupportRun, oldSupportV2Run, supportSleeveRun]) {
  if (source.includes(forbidden)) throw new Error(`${buildPath}: obsolete support deformation/sleeves survived: ${forbidden}`);
}
if (!(source.indexOf(terminalContinuityRun) > source.indexOf(stairRun))) {
  throw new Error(`${buildPath}: terminal continuity must run after service-stair preparation`);
}
if (!(source.indexOf(sourceParkingRun) > source.indexOf(terminalContinuityRun))) {
  throw new Error(`${buildPath}: source parking registration must run after final terminal continuity`);
}
if (!(source.indexOf(sourceParkingRun) < source.indexOf(bogieRun))) {
  throw new Error(`${buildPath}: source parking registration must precede final bogie/evidence capture`);
}

fs.writeFileSync(buildPath, source, "utf8");
console.log(`Installed ${marker}: retired synthetic lower support sleeves; final A1 must show its supplied Tunnel-C wheel/support geometry at pavement after rigid wheel-contact registration.`);
