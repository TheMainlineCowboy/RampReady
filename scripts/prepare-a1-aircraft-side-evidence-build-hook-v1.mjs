import fs from "node:fs";

const buildPath = "scripts/build-production.mjs";
const marker = "a1-aircraft-side-reference-evidence-build-hook-v2-cab-microfit";
const bogieAnchor = '  await run(process.execPath, ["scripts/prepare-a1-bogie-footprint-camera-v1.mjs"]);';
const cameraRun = '  await run(process.execPath, ["scripts/prepare-a1-aircraft-side-evidence-subviews-v1.mjs"]);';
const sillAnchor = '  await run(process.execPath, ["scripts/prepare-a1-final-cab-sill-surface-fit-v1.mjs"]);';
const microFitRun = '  await run(process.execPath, ["scripts/prepare-a1-final-cab-horizontal-microfit-v1.mjs"]);';
let source = fs.readFileSync(buildPath, "utf8");

if (!source.includes(microFitRun)) {
  const sillCount = source.split(sillAnchor).length - 1;
  if (sillCount !== 1) {
    throw new Error(`${buildPath}: expected one final Cab sill-fit hook, found ${sillCount}`);
  }
  source = source.replace(
    sillAnchor,
    `${sillAnchor}\n  // ${marker}\n  // Close only the small residual left by the coarse hinge/yaw solver on the\n  // supplied Cab itself. Aircraft, Terminal 4, Rotunda and Tunnel-C stay fixed.\n${microFitRun}`,
  );
}

if (!source.includes(cameraRun)) {
  const bogieCount = source.split(bogieAnchor).length - 1;
  if (bogieCount !== 1) {
    throw new Error(`${buildPath}: expected one final bogie-footprint camera hook, found ${bogieCount}`);
  }
  source = source.replace(
    bogieAnchor,
    `${bogieAnchor}\n  // ${marker}\n  // Install the dedicated outboard side-profile and aircraft-side cameras only\n  // after final visible Tunnel-C/service-stair geometry and bogie camera telemetry\n  // have been normalized. This changes evidence framing only, never geometry.\n${cameraRun}`,
  );
}

fs.writeFileSync(buildPath, source, "utf8");
source = fs.readFileSync(buildPath, "utf8");
for (const required of [
  marker,
  sillAnchor,
  microFitRun,
  bogieAnchor,
  cameraRun,
  'scripts/run-vite-with-a1-photo-dogleg-rendered-door-v2.mjs',
]) {
  if (!source.includes(required)) {
    throw new Error(`${buildPath}: final aircraft-side evidence/Cab micro-fit hook is missing ${required}`);
  }
}
if (source.indexOf(microFitRun) <= source.indexOf(sillAnchor)) {
  throw new Error(`${buildPath}: final Cab micro-fit is not after the supplied Cab sill fit`);
}
if (source.indexOf(cameraRun) <= source.indexOf(bogieAnchor)) {
  throw new Error(`${buildPath}: aircraft-side evidence cameras are not after final bogie-footprint camera preparation`);
}

console.log(`Installed ${marker}: the true final pre-Vite path closes the <=8 cm Cab coarse-fit residual on the supplied Cab before service-stair/contact proof, then adds side-profile and aircraft-side evidence cameras after final bogie normalization.`);
