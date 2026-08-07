import fs from "node:fs";
import { execFileSync } from "node:child_process";

const browserSpecs = Object.freeze([
  "tests/browser/a1-ground-contact-evidence.spec.js",
  "tests/browser/a1-jetway-contact-clusters.spec.js",
  "tests/browser/a1-terminal-joint-bogie-subviews.spec.js",
  "tests/browser/full-airport-inspection.spec.js",
  "tests/browser/kphx-ground-runtime.spec.js",
  "tests/browser/source-first-a1-repair.spec.js",
  "tests/browser/uploaded-jetway-articulation-v10.spec.js",
]);

for (const path of browserSpecs) {
  let committed;
  try {
    committed = execFileSync("git", ["show", `HEAD:${path}`], { encoding: "utf8" });
  } catch (error) {
    throw new Error(`Production build could not restore committed browser spec ${path}: ${error.message}`);
  }
  fs.writeFileSync(path, committed, "utf8");
}

// The articulation workflow runs Chromium immediately after the production
// build. Reapply the current fixed-aircraft A1 regression migration here so
// that the trusted exact-head browser gate cannot fall back to the retired
// pre-registration 30.3-30.8 m target-distance constants after restoration.
// This changes only the browser acceptance spec in the runner workspace; it
// does not touch Airport_Jetway.glb or any runtime geometry/textures.
execFileSync(process.execPath, ["scripts/prepare-fixed-a1-browser-regressions-v1.mjs"], {
  stdio: "inherit",
});

console.log(`Restored ${browserSpecs.length} browser acceptance specs to exact HEAD after production artifact generation, then reapplied the current fixed-aircraft A1 articulation regression migration before Chromium.`);
