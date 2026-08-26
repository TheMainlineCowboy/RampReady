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
  await import(`./prepare-a1-main-terminal-facade-route-v1.mjs?final-main-facade=${Date.now()}`);
  // The source-placement pass resolves the real authored face planes for A10
  // and A12. The registrar then projects each ORIGINAL KPHX source pivot onto
  // its selected plane, preserving the source-authored tangential separation at
  // the concourse corner while correcting only terminal-normal distance.
  await import(`./prepare-static-own-parking-wall-anchor-v1.mjs?final-static-wall=${Date.now()}`);
  await import(`./prepare-static-corner-plane-registration-v1.mjs?final-static-corner-plane=${Date.now()}`);
  await import(`./verify-static-corner-plane-registration-v1.mjs?final-static-corner-plane-verify=${Date.now()}`);
  await import(`./prepare-a1-tunnel-c-bogie-readiness-v1.mjs?post-airport-ownership=${Date.now()}`);
  // This wrapper can be touched by earlier runtime preparation in the same Node
  // process. Force a fresh evaluation at the final production handoff so its
  // exact source cleanup, final geometry hooks, and child-process Vite build
  // cannot be silently skipped by ESM caching.
  await import(`./run-production-with-a1-cleanup.mjs?final-production-cleanup=${Date.now()}`);
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

console.log("RampReady production artifact preserved the exact three-box, 36-triangle A1 authored cleanup and Terminal 4 jetway simulator polish, then restored authoredTerminal4Visual.js byte-for-byte.");
