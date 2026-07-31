import fs from "node:fs";

const authoredTerminalPath = "src/environment/authoredTerminal4Visual.js";
const filterImport = 'import { removeTerminal4A1LegacyBlock } from "./terminal4A1LegacyBlockFilter.js";';
const filterCall = "  const a1LegacyBlockRemoval = removeTerminal4A1LegacyBlock(THREE, authored);";
const removalEvidence = `  environment.userData.authoredTerminal4A1LegacyBlockRemovedTriangles = a1LegacyBlockRemoval.removedTriangleCount;
  environment.userData.authoredTerminal4A1LegacyBlockSourceTriangles = a1LegacyBlockRemoval.sourceTriangleCount;
  environment.userData.authoredTerminal4A1LegacyBlockRetainedTriangles = a1LegacyBlockRemoval.retainedTriangleCount;
  environment.userData.authoredTerminal4A1LegacyBlockAuthority = authored.userData.a1LegacyBlockAuthority;`;

function restoreCommittedAuthoredTerminalSource(source) {
  return source
    .replace(`${filterImport}\n`, "")
    .replace(`\n${filterImport}`, "")
    .replace(`${filterCall}\n`, "")
    .replace(`\n${filterCall}`, "")
    .replace(`${removalEvidence}\n`, "")
    .replace(`\n${removalEvidence}`, "");
}

const preparedSource = fs.readFileSync(authoredTerminalPath, "utf8");
for (const token of [filterImport, filterCall, removalEvidence]) {
  if (!preparedSource.includes(token)) {
    throw new Error(`RampReady authored Terminal 4 wrapper is missing prepared A1 filter token ${token}`);
  }
}
const committedSource = restoreCommittedAuthoredTerminalSource(preparedSource);
if (
  committedSource.includes(filterImport)
  || committedSource.includes(filterCall)
  || committedSource.includes("authoredTerminal4A1LegacyBlockRemovedTriangles")
) {
  throw new Error("RampReady could not derive the committed authored Terminal 4 baseline before building");
}

let buildError;
try {
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

console.log("RampReady production artifact preserved the exact three-box, 36-triangle A1 authored cleanup, then restored authoredTerminal4Visual.js byte-for-byte.");
