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

// Keep backward compatibility with the older articulation test, but do not
// rewrite the newer source-integrity suite back into the obsolete fake-Cab-box
// contract. The current suite already gates on the same centroid authority and
// additionally verifies rigid static source geometry and a single aircraft pose.
const articulationPath = path.join(browserDirectory, "uploaded-jetway-articulation-v10.spec.js");
let articulation = fs.readFileSync(articulationPath, "utf8");
const hasCurrentSourceIntegritySuite = articulation.includes("A1 uses one aircraft pose")
  && articulation.includes("57-static-exact-glb-rigid-source-hierarchy-v1")
  && articulation.includes("a1-single-aircraft-pose-training-and-free-drive-v1");

if (!articulation.includes(`JETWAY_BOGIE_GROUND_AUTHORITY = "${centroidAuthority}"`)) {
  const oldConstantAnchor = `const STATIC_CAB_CLOSURE_EVIDENCE_AUTHORITY = "57-static-cab-endpoints-opaque-zero-open-area-no-authored-transform-v1";`;
  const currentConstantAnchor = `const AIRCRAFT_MODE_POSE_AUTHORITY = "a1-single-aircraft-pose-training-and-free-drive-v1";`;
  const anchor = articulation.includes(currentConstantAnchor) ? currentConstantAnchor : oldConstantAnchor;
  if (!articulation.includes(anchor)) {
    throw new Error(`${articulationPath}: bogie authority constant anchor is missing`);
  }
  articulation = articulation.replace(
    anchor,
    `${anchor}\nconst JETWAY_BOGIE_GROUND_AUTHORITY = "${centroidAuthority}";`,
  );
}

if (!articulation.includes("data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieGroundAuthority")) {
  const oldWait = `  await page.waitForFunction(({ closureAuthority, evidenceAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return (
      data?.terminal4UploadedJetwayLoadState === "ready"`;
  const patchedWait = `  await page.waitForFunction(({ closureAuthority, evidenceAuthority, bogieGroundAuthority }) => {
    const data = document.querySelector("canvas.trainerCanvas")?.dataset;
    return (
      data?.terminal4UploadedJetwayLoadState === "ready"
      && data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieGroundAuthority`;
  if (!articulation.includes(oldWait)) {
    throw new Error(`${articulationPath}: bogie readiness predicate is missing`);
  }
  articulation = articulation.replace(oldWait, patchedWait);
}

if (!articulation.includes("bogieGroundAuthority: JETWAY_BOGIE_GROUND_AUTHORITY")) {
  const oldArgs = `  }, {
    closureAuthority: STATIC_CAB_CLOSURE_AUTHORITY,
    evidenceAuthority: STATIC_CAB_CLOSURE_EVIDENCE_AUTHORITY,
  }, { timeout: 90_000, polling: 100 });`;
  const patchedArgs = `  }, {
    closureAuthority: STATIC_CAB_CLOSURE_AUTHORITY,
    evidenceAuthority: STATIC_CAB_CLOSURE_EVIDENCE_AUTHORITY,
    bogieGroundAuthority: JETWAY_BOGIE_GROUND_AUTHORITY,
  }, { timeout: 90_000, polling: 100 });`;
  if (!articulation.includes(oldArgs)) {
    throw new Error(`${articulationPath}: bogie readiness arguments are missing`);
  }
  articulation = articulation.replace(oldArgs, patchedArgs);
}

const hasRuntimeAssertion = articulation.includes("terminal4UploadedJetwayBogieGroundContactAuthority).toBe(")
  && articulation.includes("JETWAY_BOGIE_GROUND_AUTHORITY");
if (!hasRuntimeAssertion) {
  const oldRuntimeAnchor = `  expect(runtime.terminal4UploadedJetwayArticulationAuthority).toBe(
    "user-supplied-airport-jetway-per-gate-telescoping-v10",
  );`;
  if (!articulation.includes(oldRuntimeAnchor)) {
    throw new Error(`${articulationPath}: articulation runtime assertion anchor is missing`);
  }
  articulation = articulation.replace(
    oldRuntimeAnchor,
    `${oldRuntimeAnchor}\n  expect(runtime.terminal4UploadedJetwayBogieGroundContactAuthority).toBe(\n    JETWAY_BOGIE_GROUND_AUTHORITY,\n  );`,
  );
}

const hasRetainedEvidence = /bogieGroundAuthority:\s*(?:runtime|returnedRuntime)\.terminal4UploadedJetwayBogieGroundContactAuthority/.test(articulation);
if (!hasRetainedEvidence) {
  const oldEvidenceAnchor = `    authority: runtime.terminal4UploadedJetwayArticulationAuthority,`;
  if (!articulation.includes(oldEvidenceAnchor)) {
    throw new Error(`${articulationPath}: articulation JSON evidence anchor is missing`);
  }
  articulation = articulation.replace(
    oldEvidenceAnchor,
    `${oldEvidenceAnchor}\n    bogieGroundAuthority: runtime.terminal4UploadedJetwayBogieGroundContactAuthority,`,
  );
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
  "data?.terminal4UploadedJetwayBogieGroundContactAuthority === bogieGroundAuthority",
  "bogieGroundAuthority: JETWAY_BOGIE_GROUND_AUTHORITY",
]) {
  if (!articulation.includes(token)) {
    throw new Error(`${articulationPath}: exact v2 bogie authority gate is missing ${token}`);
  }
}
if (!/terminal4UploadedJetwayBogieGroundContactAuthority\)\.toBe\(/.test(articulation)) {
  throw new Error(`${articulationPath}: runtime bogie authority assertion is missing`);
}
if (!/bogieGroundAuthority:\s*(?:runtime|returnedRuntime)\.terminal4UploadedJetwayBogieGroundContactAuthority/.test(articulation)) {
  throw new Error(`${articulationPath}: retained bogie authority evidence is missing`);
}
if (authorityConsumerCount < 4) {
  throw new Error(`Expected at least four bogie-ground browser consumers including articulation, found ${authorityConsumerCount}`);
}

console.log(`Migrated ${changed} browser suite(s) to ${centroidAuthority}; articulation retains the v2 grounded-bogie gate${hasCurrentSourceIntegritySuite ? " inside the stricter source-integrity/mode-consistency suite" : ""}; verified ${authorityConsumerCount} consumers.`);
await import(`./prepare-fixed-a1-browser-regressions-v1.mjs?fixed-a1-browser=${Date.now()}`);
