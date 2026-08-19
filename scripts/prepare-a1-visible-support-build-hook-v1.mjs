import fs from "node:fs";

const buildPath = "scripts/build-production.mjs";
const marker = "a1-final-rigid-scene-registration-hook-v1";
const stairRun = '  await run(process.execPath, ["scripts/prepare-a1-aircraft-side-service-stair-clearance-v1.mjs"]);';
const oldSupportRun = '  await run(process.execPath, ["scripts/prepare-a1-visible-tunnel-c-support-grounding-v1.mjs"]);';
const oldSupportV2Run = '  await run(process.execPath, ["scripts/prepare-a1-visible-tunnel-c-support-grounding-v2.mjs"]);';
const terminalContinuityRun = '  await run(process.execPath, ["scripts/prepare-a1-terminal-continuity-final-v1.mjs"]);';
const sourceParkingRun = '  await run(process.execPath, ["scripts/prepare-a1-source-parking-final-v1.mjs"]);';
const bogieRun = '  await run(process.execPath, ["scripts/prepare-a1-bogie-footprint-camera-v1.mjs"]);';

let source = fs.readFileSync(buildPath, "utf8");
if (!source.includes(stairRun)) {
  throw new Error(`${buildPath}: final service-stair solve hook is missing`);
}
if (!source.includes(bogieRun)) {
  throw new Error(`${buildPath}: final bogie evidence hook is missing`);
}

// Retire the V1/V2 support-mesh deformation chain. It was stretching selected
// Tunnel-B/Tunnel-C vertices to pavement and can visibly skew a structural leg.
// The supplied GLB now remains rigid; whole-gate Y registration to the rendered
// KPHX pavement is owned by uploadedAirportJetwayFleet.js.
source = source.replaceAll(`${oldSupportRun}\n`, "");
source = source.replaceAll(`${oldSupportV2Run}\n`, "");
source = source.replaceAll(oldSupportRun, "");
source = source.replaceAll(oldSupportV2Run, "");

if (!source.includes(marker)) {
  source = source.replace(
    stairRun,
    `${stairRun}\n  // ${marker}\n  // Final photo geometry is solved as rigid assemblies: seal A1 into the real\n  // terminal facade and return the CRJ to the decoded A1 parking center.\n${terminalContinuityRun}\n${sourceParkingRun}`,
  );
}

for (const required of [marker, stairRun, terminalContinuityRun, sourceParkingRun, bogieRun]) {
  if (!source.includes(required)) throw new Error(`${buildPath}: final rigid registration hook is missing ${required}`);
}
for (const forbidden of [oldSupportRun, oldSupportV2Run]) {
  if (source.includes(forbidden)) throw new Error(`${buildPath}: destructive support deformation survived: ${forbidden}`);
}
if (!(source.indexOf(terminalContinuityRun) > source.indexOf(stairRun))) {
  throw new Error(`${buildPath}: terminal continuity must run after service-stair preparation`);
}
if (!(source.indexOf(sourceParkingRun) > source.indexOf(terminalContinuityRun))) {
  throw new Error(`${buildPath}: source parking registration must run after final terminal continuity`);
}
if (!(source.indexOf(sourceParkingRun) < source.indexOf(bogieRun))) {
  throw new Error(`${buildPath}: final rigid scene registration must precede evidence capture`);
}

fs.writeFileSync(buildPath, source, "utf8");
console.log(`Installed ${marker}: removed per-vertex support stretching, sealed A1 to Terminal 4, and locked the CRJ back to the decoded A1 parking center before final bogie/evidence capture.`);
