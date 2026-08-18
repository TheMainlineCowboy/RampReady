import fs from "node:fs";

const buildPath = "scripts/build-production.mjs";
const marker = "a1-visible-tunnel-c-support-build-hook-v1";
const stairRun = '  await run(process.execPath, ["scripts/prepare-a1-aircraft-side-service-stair-clearance-v1.mjs"]);';
const supportRun = '  await run(process.execPath, ["scripts/prepare-a1-visible-tunnel-c-support-grounding-v1.mjs"]);';
const bogieRun = '  await run(process.execPath, ["scripts/prepare-a1-bogie-footprint-camera-v1.mjs"]);';

let source = fs.readFileSync(buildPath, "utf8");
if (!source.includes(marker)) {
  const stairCount = source.split(stairRun).length - 1;
  if (stairCount !== 1) {
    throw new Error(`${buildPath}: expected one final service-stair solve hook before visible support grounding, found ${stairCount}`);
  }
  if (!source.includes(bogieRun)) {
    throw new Error(`${buildPath}: final bogie evidence hook is missing before visible support grounding`);
  }
  source = source.replace(
    stairRun,
    `${stairRun}\n  // ${marker}\n  // After the exact supplied service stair has been solved against the live CRJ,\n  // ground only disconnected exact-source Tunnel-C mechanical support islands.\n  // This is deliberately before final bogie/contact cameras, so visual evidence\n  // measures the corrected visible hardware rather than an unrelated carrier vertex.\n${supportRun}`,
  );
  fs.writeFileSync(buildPath, source, "utf8");
}

source = fs.readFileSync(buildPath, "utf8");
for (const required of [marker, stairRun, supportRun, bogieRun]) {
  if (!source.includes(required)) {
    throw new Error(`${buildPath}: visible Tunnel-C support build hook is missing ${required}`);
  }
}
if (!(source.indexOf(supportRun) > source.indexOf(stairRun))) {
  throw new Error(`${buildPath}: visible support grounding is not after final service-stair solve`);
}
if (!(source.indexOf(supportRun) < source.indexOf(bogieRun))) {
  throw new Error(`${buildPath}: visible support grounding is not before final bogie evidence`);
}

console.log(`Installed ${marker}: visible exact-source Tunnel-C support grounding now executes after live service-stair clearance and before final bogie/contact evidence.`);
