import fs from "node:fs";

const buildPath = "scripts/build-production.mjs";
const marker = "a1-visible-tunnel-c-support-build-hook-v1";
const stairRun = '  await run(process.execPath, ["scripts/prepare-a1-aircraft-side-service-stair-clearance-v1.mjs"]);';
const supportRun = '  await run(process.execPath, ["scripts/prepare-a1-visible-tunnel-c-support-grounding-v1.mjs"]);';
const supportV2Run = '  await run(process.execPath, ["scripts/prepare-a1-visible-tunnel-c-support-grounding-v2.mjs"]);';
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
    `${stairRun}\n  // ${marker}\n  // After the exact supplied service stair has been solved against the live CRJ,\n  // ground the exact-source Tunnel-C mechanical supports, then run the stricter\n  // post-V3 visible-rod pass before final bogie/contact evidence.\n${supportRun}\n${supportV2Run}`,
  );
  fs.writeFileSync(buildPath, source, "utf8");
}

source = fs.readFileSync(buildPath, "utf8");
if (!source.includes(supportV2Run)) {
  const supportCount = source.split(supportRun).length - 1;
  if (supportCount !== 1) {
    throw new Error(`${buildPath}: expected one visible support V1 hook before adding strict V2 wrapper, found ${supportCount}`);
  }
  source = source.replace(supportRun, `${supportRun}\n${supportV2Run}`);
  fs.writeFileSync(buildPath, source, "utf8");
}

source = fs.readFileSync(buildPath, "utf8");
for (const required of [marker, stairRun, supportRun, supportV2Run, bogieRun]) {
  if (!source.includes(required)) {
    throw new Error(`${buildPath}: visible Tunnel-C support build hook is missing ${required}`);
  }
}
if (!(source.indexOf(supportRun) > source.indexOf(stairRun))) {
  throw new Error(`${buildPath}: visible support grounding is not after final service-stair solve`);
}
if (!(source.indexOf(supportV2Run) > source.indexOf(supportRun))) {
  throw new Error(`${buildPath}: strict visible-rod wrapper is not after V3 support preparation`);
}
if (!(source.indexOf(supportV2Run) < source.indexOf(bogieRun))) {
  throw new Error(`${buildPath}: strict visible-rod wrapper is not before final bogie evidence`);
}

console.log(`Installed ${marker}: visible exact-source Tunnel-C support grounding now executes after live service-stair clearance, followed by strict remaining-rod correction, before final bogie/contact evidence.`);
