import fs from "node:fs";

const authoredTerminalPath = "src/environment/authoredTerminal4Visual.js";
const filterImport = 'import { removeTerminal4A1LegacyBlock } from "./terminal4A1LegacyBlockFilter.js";';
const filterCall = "  const a1LegacyBlockRemoval = removeTerminal4A1LegacyBlock(THREE, authored);";
const removalEvidence = `  environment.userData.authoredTerminal4A1LegacyBlockRemovedTriangles = a1LegacyBlockRemoval.removedTriangleCount;
  environment.userData.authoredTerminal4A1LegacyBlockSourceTriangles = a1LegacyBlockRemoval.sourceTriangleCount;
  environment.userData.authoredTerminal4A1LegacyBlockRetainedTriangles = a1LegacyBlockRemoval.retainedTriangleCount;
  environment.userData.authoredTerminal4A1LegacyBlockAuthority = authored.userData.a1LegacyBlockAuthority;`;
const polishImport = 'import { applyTerminal4JetwaySimulatorPolish } from "./terminal4JetwaySimulatorPolishV13.js";';
const polishCall = "  applyTerminal4JetwaySimulatorPolish(sourcePlacedJetways);";

function restoreCommittedAuthoredTerminalSource(source) {
  return source
    .replace(`${filterImport}\n`, "")
    .replace(`\n${filterImport}`, "")
    .replace(`${filterCall}\n`, "")
    .replace(`\n${filterCall}`, "")
    .replace(`${removalEvidence}\n`, "")
    .replace(`\n${removalEvidence}`, "")
    .replace(`${polishImport}\n`, "")
    .replace(`\n${polishImport}`, "")
    .replace(`${polishCall}\n`, "")
    .replace(`\n${polishCall}`, "");
}

const preparedSource = fs.readFileSync(authoredTerminalPath, "utf8");
for (const token of [filterImport, filterCall, removalEvidence, polishImport, polishCall]) {
  if (!preparedSource.includes(token)) {
    throw new Error(`RampReady authored Terminal 4 wrapper is missing prepared token ${token}`);
  }
}
const committedSource = restoreCommittedAuthoredTerminalSource(preparedSource);
if (
  committedSource.includes(filterImport)
  || committedSource.includes(filterCall)
  || committedSource.includes("authoredTerminal4A1LegacyBlockRemovedTriangles")
  || committedSource.includes(polishImport)
  || committedSource.includes(polishCall)
) {
  throw new Error("RampReady could not derive the committed authored Terminal 4 baseline before building");
}

let buildError;
try {
  // All relocation/aircraft/closure compatibility preparers have finished before
  // this wrapper. Correct the REAL authored A1 portal here, at the final geometry
  // stage: the Rotunda terminal opening (opposite Tunnel A in Airport_Jetway.glb)
  // must physically face the measured Terminal 4 structural wall. Tunnel A/B/C/
  // Cab are not moved by this articulation and the Rotunda mesh centroid remains
  // fixed to the already measured real-wall position.
  await import(`./prepare-a1-authored-rotunda-opening-alignment-v1.mjs?final-production-opening=${Date.now()}`);

  // The later source-heading preparation historically rotated the whole A1
  // anchor, including the terminal portal. Re-apply the fixed-wall Rotunda guard
  // after installing the physical opening authority so that decoded KPHX heading
  // continues to own Tunnel A/B/C/Cab but cannot turn the terminal portal back
  // toward the apron.
  await import(`./prepare-a1-fixed-rotunda-aircraft-side-pivot-v1.mjs?final-production-rotunda=${Date.now()}`);

  // Neither Rotunda operation is allowed to change Tunnel-C Y. Re-run the actual
  // aircraft-side ground contract immediately before the final bundle anyway, so
  // any regression to airborne support/wheels fails closed.
  await import(`./prepare-a1-tunnel-c-bogie-readiness-v1.mjs?post-fixed-rotunda=${Date.now()}`);
  await import("./run-production-with-a1-cleanup.mjs");
} catch (error) {
  buildError = error;
}

let restorationError;
try {
  fs.writeFileSync(authoredTerminalPath, committedSource, "utf8");
  const restoredSource = fs.readFileSync(authoredTerminalPath, "utf8");
  if (restoredSource !== committedSource) {
    throw new Error("RampReady failed to restore the authored Terminal 4 source byte-for-byte");
  }
  for (const forbidden of [
    filterImport,
    filterCall,
    "authoredTerminal4A1LegacyBlockRemovedTriangles",
    "authoredTerminal4A1LegacyBlockSourceTriangles",
    "authoredTerminal4A1LegacyBlockRetainedTriangles",
    "authoredTerminal4A1LegacyBlockAuthority",
    polishImport,
    polishCall,
  ]) {
    if (restoredSource.includes(forbidden)) {
      throw new Error(`RampReady authored Terminal 4 cleanup left generated token ${forbidden}`);
    }
  }
} catch (error) {
  restorationError = error;
}

if (buildError && restorationError) {
  throw new AggregateError(
    [buildError, restorationError],
    "RampReady production build and authored Terminal 4 restoration both failed",
  );
}
if (restorationError) throw restorationError;
if (buildError) throw buildError;

console.log("RampReady production artifact physically aligns the supplied A1 Rotunda terminal opening to the measured Terminal 4 wall as the final geometry authority, preserves the decoded aircraft-side Tunnel A/B/C/Cab heading and Tunnel-C ramp contact, applies the authored cleanup and Terminal 4 jetway polish, then restores authoredTerminal4Visual.js byte-for-byte.");
