import fs from "node:fs";

const buildPath = "scripts/build-production.mjs";
const marker = "a1-aircraft-side-reference-evidence-build-hook-v1";
const anchor = '  await run(process.execPath, ["scripts/prepare-a1-bogie-footprint-camera-v1.mjs"]);';
const cameraRun = '  await run(process.execPath, ["scripts/prepare-a1-aircraft-side-evidence-subviews-v1.mjs"]);';
let source = fs.readFileSync(buildPath, "utf8");

if (!source.includes(marker)) {
  const anchorCount = source.split(anchor).length - 1;
  if (anchorCount !== 1) {
    throw new Error(`${buildPath}: expected one final bogie-footprint camera hook, found ${anchorCount}`);
  }
  source = source.replace(
    anchor,
    `${anchor}\n  // ${marker}\n  // Install the dedicated outboard side-profile and aircraft-side cameras only\n  // after final visible Tunnel-C/service-stair geometry and bogie camera telemetry\n  // have been normalized. This changes evidence framing only, never geometry.\n${cameraRun}`,
  );
  fs.writeFileSync(buildPath, source, "utf8");
}

source = fs.readFileSync(buildPath, "utf8");
for (const required of [
  marker,
  anchor,
  cameraRun,
  'scripts/run-vite-with-a1-photo-dogleg-rendered-door-v2.mjs',
]) {
  if (!source.includes(required)) {
    throw new Error(`${buildPath}: final aircraft-side evidence build hook is missing ${required}`);
  }
}
if (source.indexOf(cameraRun) <= source.indexOf(anchor)) {
  throw new Error(`${buildPath}: aircraft-side evidence cameras are not after final bogie-footprint camera preparation`);
}

console.log(`Installed ${marker}: the true final pre-Vite path now adds side-profile and aircraft-side A1 reference cameras after service-stair and bogie normalization, without moving airport, aircraft or supplied jetway geometry.`);
