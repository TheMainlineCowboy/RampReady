import fs from "node:fs";
import path from "node:path";

const browserDirectory = "tests/browser";
const legacyAuthority = "exact-authored-a1-lowest-geometry-ramp-contact-v1";
const centroidAuthority = "exact-authored-a1-lowest-geometry-ramp-contact-v2";
const files = fs.readdirSync(browserDirectory)
  .filter((name) => name.endsWith(".spec.js"))
  .map((name) => path.join(browserDirectory, name));

let changed = 0;
let authorityConsumerCount = 0;
for (const file of files) {
  let source = fs.readFileSync(file, "utf8");
  if (source.includes(legacyAuthority)) {
    source = source.replaceAll(legacyAuthority, centroidAuthority);
    fs.writeFileSync(file, source, "utf8");
    changed += 1;
  }
  if (source.includes("terminal4UploadedJetwayBogieGroundContactAuthority")) {
    authorityConsumerCount += 1;
    if (!source.includes(centroidAuthority)) {
      throw new Error(`${file}: bogie ground authority consumer was not migrated to ${centroidAuthority}`);
    }
  }
}

if (authorityConsumerCount < 3) {
  throw new Error(`Expected at least three bogie-ground browser consumers, found ${authorityConsumerCount}`);
}
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(legacyAuthority)) {
    throw new Error(`${file}: legacy bogie ground authority remains after centroid migration`);
  }
}

console.log(`Migrated ${changed} browser suite(s) to ${centroidAuthority}; verified ${authorityConsumerCount} exact bogie-ground consumers.`);
