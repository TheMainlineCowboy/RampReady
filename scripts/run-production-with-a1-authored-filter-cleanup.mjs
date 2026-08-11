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
  // The physical A1 elbow now has one geometry owner: the rigid-parent-orientation
  // preparation stage articulates ONLY the Rotunda aperture to the measured wall,
  // then recaptures the accepted five-part baseline. Do not add a second portal
  // rotation here. Instead, re-run only the fixed-wall preservation guard after
  // every late compatibility preparer so the source-heading pass cannot rotate
  // that accepted Rotunda aperture back toward the apron.
  await import(`./prepare-a1-fixed-rotunda-aircraft-side-pivot-v1.mjs?final-production-rotunda=${Date.now()}`);

  // The Rotunda preservation guard never changes Tunnel-C Y. Re-run the actual
  // aircraft-side ground contract immediately before final bundling anyway so
  // airborne support/wheels remain a hard production failure.
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

console.log("RampReady production artifact preserves the physically articulated A1 Rotunda aperture at the measured Terminal 4 wall as the final geometry authority, keeps Tunnel A/B/C/Cab on the decoded aircraft-side heading with Tunnel-C on the ramp, applies the authored cleanup and Terminal 4 jetway polish, then restores authoredTerminal4Visual.js byte-for-byte.");
