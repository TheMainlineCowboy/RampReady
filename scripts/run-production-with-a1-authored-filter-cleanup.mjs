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
  // Browser evidence proved the previous decoded-heading wall selector could
  // choose the long elevated-corridor facade even though the candidate point
  // itself was outside the T4_WALK roof footprint. Apply the final A1-only
  // main-terminal selector immediately before the artifact is bundled: the wall
  // must be a broad facade and its route to the AIR_Jetway01 source pivot must
  // cross zero T4_WALK footprint. This does not change the supplied GLB or its
  // decoded KPHX parent yaw.
  await import(`./prepare-a1-main-terminal-facade-route-v1.mjs?final-main-facade=${Date.now()}`);
  // Static exact jetways must use the structural terminal wall directly behind
  // each gate's own KPHX parking centerline. The decoded AIR_Jetway01 heading
  // remains fallback/provenance only; preferring it at concourse corners can
  // collapse neighboring Rotunda anchors onto the same wall region.
  await import(`./prepare-static-own-parking-wall-anchor-v1.mjs?final-static-wall=${Date.now()}`);
  // This wrapper runs after the final airport-ownership readiness pass. Re-run
  // the Tunnel-C migration here so no later compatibility layer can restore the
  // retired whole-model/pedestal ground rule in the artifact that Vite bundles.
  await import(`./prepare-a1-tunnel-c-bogie-readiness-v1.mjs?post-airport-ownership=${Date.now()}`);
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

console.log("RampReady production artifact preserved the exact three-box, 36-triangle A1 authored cleanup and Terminal 4 jetway simulator polish, then restored authoredTerminal4Visual.js byte-for-byte.");
