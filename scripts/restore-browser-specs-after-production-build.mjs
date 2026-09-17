import fs from "node:fs";
import { execFileSync } from "node:child_process";

const browserSpecs = Object.freeze([
  "tests/browser/a1-close-readiness-diagnostic.spec.js",
  "tests/browser/a1-ground-contact-evidence.spec.js",
  "tests/browser/a1-jetway-contact-clusters.spec.js",
  "tests/browser/a1-terminal-joint-bogie-subviews.spec.js",
  "tests/browser/crj700-runtime.spec.js",
  "tests/browser/full-airport-inspection.spec.js",
  "tests/browser/kphx-ground-runtime.spec.js",
  "tests/browser/source-first-a1-repair.spec.js",
  "tests/browser/uploaded-jetway-articulation-v10.spec.js",
]);

function restoreCommittedPath(path) {
  let committed;
  try {
    committed = execFileSync("git", ["show", `HEAD:${path}`], { encoding: "utf8" });
  } catch (error) {
    throw new Error(`Production build could not restore committed tracked path ${path}: ${error.message}`);
  }
  fs.writeFileSync(path, committed, "utf8");
}

// Production preparation intentionally rewrites a number of tracked source modules
// before Vite bundles dist/. Those rewrites are build-time transforms only. Once the
// bundle exists, restore every tracked text path changed by preparation so a generic
// Build/Verify finishes with the exact committed tree rather than leaking generated
// runtime source back into the checkout.
const changedTrackedPaths = execFileSync("git", ["diff", "--name-only", "--diff-filter=M", "HEAD", "--"], {
  encoding: "utf8",
})
  .split(/\r?\n/)
  .map((value) => value.trim())
  .filter(Boolean);

for (const path of changedTrackedPaths) restoreCommittedPath(path);

// Keep the explicit browser list as a fail-closed contract: these acceptance specs
// must always be exact HEAD before any workflow-specific post-build migration.
for (const path of browserSpecs) restoreCommittedPath(path);

// Browser-acceptance migrations are runner-only compatibility transforms. Reapply
// them only when the current workflow immediately executes the affected browser spec
// against the already-built dist artifact. Generic Build/Verify stays byte-clean.
const workflow = String(process.env.GITHUB_WORKFLOW || "");
const needsPostBuildBrowserMigration = new Set([
  "Verify exact supplied jetway articulation",
  "CRJ700 Runtime Verification",
]).has(workflow);

if (needsPostBuildBrowserMigration) {
  execFileSync(process.execPath, ["scripts/prepare-fixed-a1-browser-regressions-v1.mjs"], {
    stdio: "inherit",
  });
  execFileSync(process.execPath, ["scripts/prepare-compact-mobile-browser-regression-v1.mjs"], {
    stdio: "inherit",
  });
  console.log(`Restored ${changedTrackedPaths.length} tracked production-preparation path(s) and ${browserSpecs.length} browser acceptance specs to exact HEAD, then reapplied connected-A1 and compact-mobile browser expectations for ${workflow}.`);
} else {
  console.log(`Restored ${changedTrackedPaths.length} tracked production-preparation path(s) and ${browserSpecs.length} browser acceptance specs to exact HEAD; ${workflow || "local build"} leaves the tracked tree clean.`);
}
