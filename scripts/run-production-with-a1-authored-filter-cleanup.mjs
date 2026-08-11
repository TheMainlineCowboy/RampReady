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
  // All of the simulator-quality A1 relocation/aircraft/closure preparers have
  // finished before this wrapper. Re-apply the physical A1 articulation HERE so
  // none of those late compatibility passes can rotate the Rotunda portal away
  // from the real terminal again. This operation leaves Tunnel A/B/C/Cab and
  // their Y/ground pose untouched; it restores only the Rotunda world
  // orientation/center that existed at the measured wall before the complete
  // anchor received its decoded KPHX heading.
  await import(`./prepare-a1-fixed-rotunda-aircraft-side-pivot-v1.mjs?final-production-rotunda=${Date.now()}`);

  // The fixed Rotunda correction never changes Tunnel-C Y, but re-run the actual
  // aircraft-side ground contract after it so the artifact can only bundle if
  // the visible support/wheel geometry remains on the ramp.
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

console.log("RampReady production artifact keeps the A1 Rotunda fixed to the measured terminal-wall orientation as the final geometry authority, preserves the decoded aircraft-side Tunnel A/B/C/Cab heading and Tunnel-C ramp contact, applies the exact three-box authored cleanup and Terminal 4 jetway polish, then restores authoredTerminal4Visual.js byte-for-byte.");
