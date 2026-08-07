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

console.log(`Restored ${browserSpecs.length} browser acceptance specs to exact HEAD after production artifact generation; trusted visual workflows must explicitly reapply strict migrations before Chromium.`);
