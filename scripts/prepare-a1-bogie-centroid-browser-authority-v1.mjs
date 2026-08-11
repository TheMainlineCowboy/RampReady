import fs from "node:fs";
import path from "node:path";

const browserDirectory = "tests/browser";
const legacyAuthorities = [
  "exact-authored-a1-lowest-geometry-ramp-contact-v1",
  "exact-authored-a1-lowest-geometry-ramp-contact-v2",
  "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3",
];
const bogieAuthority = "exact-authored-a1-connected-wheel-pair-ramp-contact-v4";
const files = fs.readdirSync(browserDirectory)
  .filter((name) => name.endsWith(".spec.js"))
  .map((name) => path.join(browserDirectory, name));

let changed = 0;
for (const file of files) {
  let source = fs.readFileSync(file, "utf8");
  const before = source;
  for (const legacy of legacyAuthorities) source = source.replaceAll(legacy, bogieAuthority);
  source = source
    .replaceAll("terminal4UploadedJetwayBogieGroundContactPointCount) >= 4", "terminal4UploadedJetwayBogieGroundContactPointCount) >= 8")
    .replaceAll("terminal4UploadedJetwayBogieGroundContactClusterCount) >= 1", "terminal4UploadedJetwayBogieGroundContactClusterCount) >= 2")
    .replaceAll("terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters) >= 0.35", "terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters) >= 1.4");
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

const waitAuthorityLine = "      && data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieGroundAuthority";
const waitClearanceLine = "      && Math.abs(Number(data?.terminal4UploadedJetwayBogieGroundClearanceMeters)) <= 0.015";
const waitPointLine = "      && Number(data?.terminal4UploadedJetwayBogieGroundContactPointCount) >= 8";
const waitClusterLine = "      && Number(data?.terminal4UploadedJetwayBogieGroundContactClusterCount) >= 2";
const waitSpanLine = "      && Number(data?.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters) >= 1.4";
if (!articulation.includes(waitAuthorityLine)) {
  throw new Error(`${articulationPath}: articulation no longer fail-closes on the published bogie authority`);
}
let waitBlock = waitAuthorityLine;
for (const line of [waitClearanceLine, waitPointLine, waitClusterLine, waitSpanLine]) {
  if (!articulation.includes(line)) waitBlock += `\n${line}`;
}
if (waitBlock !== waitAuthorityLine) articulation = articulation.replace(waitAuthorityLine, waitBlock);

const runtimeAuthorityAssertion = "  expect(runtime.terminal4UploadedJetwayBogieGroundContactAuthority).toBe(JETWAY_BOGIE_GROUND_AUTHORITY);";
const runtimeAssertions = [
  "  expect(Math.abs(Number(runtime.terminal4UploadedJetwayBogieGroundClearanceMeters))).toBeLessThanOrEqual(0.015);",
  "  expect(Number(runtime.terminal4UploadedJetwayBogieGroundContactPointCount)).toBeGreaterThanOrEqual(8);",
  "  expect(Number(runtime.terminal4UploadedJetwayBogieGroundContactClusterCount)).toBeGreaterThanOrEqual(2);",
  "  expect(Number(runtime.terminal4UploadedJetwayBogieGroundHorizontalContactSpanMeters)).toBeGreaterThanOrEqual(1.4);",
];
if (!articulation.includes(runtimeAuthorityAssertion)) {
  throw new Error(`${articulationPath}: runtime bogie authority assertion is missing`);
}
let runtimeBlock = runtimeAuthorityAssertion;
for (const line of runtimeAssertions) if (!articulation.includes(line)) runtimeBlock += `\n${line}`;
if (runtimeBlock !== runtimeAuthorityAssertion) articulation = articulation.replace(runtimeAuthorityAssertion, runtimeBlock);

fs.writeFileSync(articulationPath, articulation, "utf8");

let authorityConsumerCount = 0;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  for (const legacy of legacyAuthorities) {
    if (source.includes(legacy)) throw new Error(`${file}: obsolete non-wheel ground authority remains: ${legacy}`);
  }
  if (source.includes("terminal4UploadedJetwayBogieGroundContactAuthority")) {
    authorityConsumerCount += 1;
    if (!source.includes(bogieAuthority)) throw new Error(`${file}: bogie consumer was not migrated to ${bogieAuthority}`);
  }
}
if (authorityConsumerCount < 4) throw new Error(`Expected at least four exact-wheel bogie browser consumers, found ${authorityConsumerCount}`);

for (const required of [
  `JETWAY_BOGIE_GROUND_AUTHORITY = "${bogieAuthority}"`,
  waitAuthorityLine.trim(),
  waitClearanceLine.trim(),
  waitPointLine.trim(),
  waitClusterLine.trim(),
  waitSpanLine.trim(),
  ...runtimeAssertions.map((line) => line.trim()),
]) {
  if (!articulation.includes(required)) throw new Error(`${articulationPath}: exact-wheel bogie browser gate is missing ${required}`);
}

console.log(`Migrated ${changed} browser suite(s) to ${bogieAuthority}; articulation now requires <=1.5 cm clearance, at least two wheel-contact clusters and a >=1.4 m paired-wheel footprint, while ${authorityConsumerCount} consumers reject v1/v2/v3 non-wheel authorities.`);
await import(`./prepare-fixed-a1-browser-regressions-v1.mjs?fixed-a1-browser=${Date.now()}`);
