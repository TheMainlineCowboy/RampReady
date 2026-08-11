import fs from "node:fs";
import path from "node:path";

const browserDirectory = "tests/browser";
const legacyAuthorities = [
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
];
const bogieAuthority = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
const files = fs.readdirSync(browserDirectory)
  .filter((name) => name.endsWith(".spec.js"))
  .map((name) => path.join(browserDirectory, name));

let changed = 0;
for (const file of files) {
  let source = fs.readFileSync(file, "utf8");
  const before = source;
  for (const legacy of legacyAuthorities) source = source.replaceAll(legacy, bogieAuthority);
  if (source !== before) {
    fs.writeFileSync(file, source, "utf8");
    changed += 1;
  }
}

const articulationPath = path.join(browserDirectory, "uploaded-jetway-articulation-v10.spec.js");
let articulation = fs.readFileSync(articulationPath, "utf8");
if (!articulation.includes(`JETWAY_BOGIE_GROUND_AUTHORITY = "${bogieAuthority}"`)) {
  articulation = articulation.replace(
    /const JETWAY_BOGIE_GROUND_AUTHORITY = "[^"]+";/,
    `const JETWAY_BOGIE_GROUND_AUTHORITY = "${bogieAuthority}";`,
  );
}
if (!articulation.includes(`JETWAY_BOGIE_GROUND_AUTHORITY = "${bogieAuthority}"`)) {
  const anchor = `const AIRCRAFT_MODE_POSE_AUTHORITY = "a1-single-aircraft-pose-training-and-free-drive-v1";`;
  if (!articulation.includes(anchor)) throw new Error(`${articulationPath}: bogie authority insertion anchor is missing`);
  articulation = articulation.replace(anchor, `${anchor}\nconst JETWAY_BOGIE_GROUND_AUTHORITY = "${bogieAuthority}";`);
}

if (!articulation.includes("data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieGroundAuthority")) {
  throw new Error(`${articulationPath}: articulation no longer fail-closes on the published bogie authority`);
}
if (!articulation.includes("terminal4UploadedJetwayBogieGroundClearanceMeters")) {
  throw new Error(`${articulationPath}: articulation is missing bogie clearance evidence`);
}
fs.writeFileSync(articulationPath, articulation, "utf8");

let authorityConsumerCount = 0;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const legacy of legacyAuthorities) {
    if (source.includes(legacy)) throw new Error(`${file}: obsolete whole-model ground authority remains: ${legacy}`);
  }
  if (source.includes("terminal4UploadedJetwayBogieGroundContactAuthority")) {
    authorityConsumerCount += 1;
    if (!source.includes(bogieAuthority)) throw new Error(`${file}: bogie consumer was not migrated to ${bogieAuthority}`);
  }
}
if (authorityConsumerCount < 4) throw new Error(`Expected at least four Tunnel-C bogie browser consumers, found ${authorityConsumerCount}`);

console.log(`Migrated ${changed} browser suite(s) to ${bogieAuthority}; ${authorityConsumerCount} consumers now require the actual aircraft-side Tunnel-C support/bogie ground authority instead of the lowest point anywhere in the jetway.`);
await import(`./prepare-fixed-a1-browser-regressions-v1.mjs?fixed-a1-browser=${Date.now()}`);
