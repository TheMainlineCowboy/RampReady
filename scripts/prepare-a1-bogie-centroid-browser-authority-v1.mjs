import fs from "node:fs";
import path from "node:path";

const browserDirectory = "tests/browser";
const legacyAuthority = "exact-authored-a1-lowest-geometry-ramp-contact-v1";
const centroidAuthority = "exact-authored-a1-lowest-geometry-ramp-contact-v2";
const files = fs.readdirSync(browserDirectory)
  .filter((name) => name.endsWith(".spec.js"))
  .map((name) => path.join(browserDirectory, name));

let changed = 0;
for (const file of files) {
  let source = fs.readFileSync(file, "utf8");
  if (source.includes(legacyAuthority)) {
    source = source.replaceAll(legacyAuthority, centroidAuthority);
    fs.writeFileSync(file, source, "utf8");
    changed += 1;
  }
}

// The articulation suite previously checked only telescoping and Cab closure,
// so the post-build safeguard could not prove that this exact browser path was
// observing the centroid-enabled grounded jetway. Wire the authority into the
// actual readiness predicate, runtime assertion, and retained evidence.
const articulationPath = path.join(browserDirectory, "uploaded-jetway-articulation-v10.spec.js");
let articulation = fs.readFileSync(articulationPath, "utf8");
const constantAnchor = `const STATIC_CAB_CLOSURE_EVIDENCE_AUTHORITY = "57-static-cab-endpoints-opaque-zero-open-area-no-authored-transform-v1";`;
const constantBlock = `${constantAnchor}
const JETWAY_BOGIE_GROUND_AUTHORITY = "${centroidAuthority}";`;
if (!articulation.includes("JETWAY_BOGIE_GROUND_AUTHORITY")) {
  if (!articulation.includes(constantAnchor)) {
    throw new Error(`${articulationPath}: static authority constant anchor is missing`);
  }
  articulation = articulation.replace(constantAnchor, constantBlock);
}

const mainWaitBefore = `  await page.waitForFunction(({ closureAuthority, evidenceAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return (
      data?.terminal4UploadedJetwayLoadState === "ready"`;
const mainWaitAfter = `  await page.waitForFunction(({ closureAuthority, evidenceAuthority, bogieGroundAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return (
      data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieGroundAuthority`;
if (!articulation.includes("bogieGroundAuthority }) =>")) {
  if (!articulation.includes(mainWaitBefore)) {
    throw new Error(`${articulationPath}: main exact-jetway readiness anchor is missing`);
  }
  articulation = articulation.replace(mainWaitBefore, mainWaitAfter);
}

const mainArgsBefore = `  }, {
    closureAuthority: STATIC_CAB_CLOSURE_AUTHORITY,
    evidenceAuthority: STATIC_CAB_CLOSURE_EVIDENCE_AUTHORITY,
  }, { timeout: 90_000, polling: 100 });`;
const mainArgsAfter = `  }, {
    closureAuthority: STATIC_CAB_CLOSURE_AUTHORITY,
    evidenceAuthority: STATIC_CAB_CLOSURE_EVIDENCE_AUTHORITY,
    bogieGroundAuthority: JETWAY_BOGIE_GROUND_AUTHORITY,
  }, { timeout: 90_000, polling: 100 });`;
if (!articulation.includes("bogieGroundAuthority: JETWAY_BOGIE_GROUND_AUTHORITY")) {
  if (!articulation.includes(mainArgsBefore)) {
    throw new Error(`${articulationPath}: main exact-jetway readiness arguments are missing`);
  }
  articulation = articulation.replace(mainArgsBefore, mainArgsAfter);
}

const runtimeAssertionAnchor = `  expect(runtime.terminal4UploadedJetwayArticulationAuthority).toBe(
    "user-supplied-airport-jetway-per-gate-telescoping-v10",
  );`;
const runtimeAssertionBlock = `${runtimeAssertionAnchor}
  expect(runtime.terminal4UploadedJetwayBogieGroundContactAuthority).toBe(
    JETWAY_BOGIE_GROUND_AUTHORITY,
  );`;
if (!articulation.includes("expect(runtime.terminal4UploadedJetwayBogieGroundContactAuthority)")) {
  if (!articulation.includes(runtimeAssertionAnchor)) {
    throw new Error(`${articulationPath}: articulation runtime assertion anchor is missing`);
  }
  articulation = articulation.replace(runtimeAssertionAnchor, runtimeAssertionBlock);
}

const evidenceAnchor = `    authority: runtime.terminal4UploadedJetwayArticulationAuthority,`;
const evidenceBlock = `${evidenceAnchor}
    bogieGroundAuthority: runtime.terminal4UploadedJetwayBogieGroundContactAuthority,`;
if (!articulation.includes("bogieGroundAuthority: runtime.terminal4UploadedJetwayBogieGroundContactAuthority")) {
  if (!articulation.includes(evidenceAnchor)) {
    throw new Error(`${articulationPath}: articulation JSON evidence anchor is missing`);
  }
  articulation = articulation.replace(evidenceAnchor, evidenceBlock);
}
fs.writeFileSync(articulationPath, articulation, "utf8");

let authorityConsumerCount = 0;
for (const file of files) {
  const source = fs.readFileSync(file, "utf8");
  if (source.includes(legacyAuthority)) {
    throw new Error(`${file}: legacy bogie ground authority remains after centroid migration`);
  }
  if (source.includes("terminal4UploadedJetwayBogieGroundContactAuthority")) {
    authorityConsumerCount += 1;
    if (!source.includes(centroidAuthority)) {
      throw new Error(`${file}: bogie ground authority consumer was not migrated to ${centroidAuthority}`);
    }
  }
}

for (const token of [
  `JETWAY_BOGIE_GROUND_AUTHORITY = "${centroidAuthority}"`,
  "bogieGroundAuthority }) =>",
  "data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieGroundAuthority",
  "bogieGroundAuthority: JETWAY_BOGIE_GROUND_AUTHORITY",
  "expect(runtime.terminal4UploadedJetwayBogieGroundContactAuthority)",
  "bogieGroundAuthority: runtime.terminal4UploadedJetwayBogieGroundContactAuthority",
]) {
  if (!articulation.includes(token)) {
    throw new Error(`${articulationPath}: exact v2 bogie authority gate is missing ${token}`);
  }
}
if (authorityConsumerCount < 4) {
  throw new Error(`Expected at least four bogie-ground browser consumers including articulation, found ${authorityConsumerCount}`);
}

await import(`./prepare-source-locked-a1-elbow-finalizer-v1.mjs?post-bogie-source-lock=${Date.now()}`);
console.log(`Migrated ${changed} browser suite(s) to ${centroidAuthority}; articulation requires the v2 authority, and the exact source-locked A1 Rotunda elbow was re-applied after the final legacy A1 migration.`);
