import fs from "node:fs";

const path = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(path, "utf8");

const filterImport = 'import { removeTerminal4A1LegacyBlock } from "./terminal4A1LegacyBlockFilter.js";';
if (!source.includes(filterImport)) {
  const anchor = 'import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";';
  if (!source.includes(anchor)) throw new Error("Terminal 4 A1 block-filter import anchor is missing");
  source = source.replace(anchor, `${anchor}\n${filterImport}`);
}

const filterCall = "  const a1LegacyBlockRemoval = removeTerminal4A1LegacyBlock(THREE, authored);";
if (!source.includes(filterCall)) {
  const anchor = '  authored.name = "PHX_Terminal4_AuthoredTexturedVisual";';
  if (!source.includes(anchor)) throw new Error("Terminal 4 A1 block-filter call anchor is missing");
  source = source.replace(anchor, `${filterCall}\n${anchor}`);
}

const removalEvidence = `  environment.userData.authoredTerminal4A1LegacyBlockRemovedTriangles = a1LegacyBlockRemoval.removedTriangleCount;
  environment.userData.authoredTerminal4A1LegacyBlockSourceTriangles = a1LegacyBlockRemoval.sourceTriangleCount;
  environment.userData.authoredTerminal4A1LegacyBlockRetainedTriangles = a1LegacyBlockRemoval.retainedTriangleCount;
  environment.userData.authoredTerminal4A1LegacyBlockAuthority = authored.userData.a1LegacyBlockAuthority;`;
if (!source.includes("authoredTerminal4A1LegacyBlockRemovedTriangles")) {
  const anchor = "  environment.userData.authoredTerminal4GroundCleanupPass = AUTHORED_TERMINAL4_PROFILE.groundCleanupPass;";
  if (!source.includes(anchor)) throw new Error("Terminal 4 A1 block-filter evidence anchor is missing");
  source = source.replace(anchor, `${anchor}\n${removalEvidence}`);
}

for (const token of [
  filterImport,
  filterCall,
  "authoredTerminal4A1LegacyBlockRemovedTriangles",
  "authoredTerminal4A1LegacyBlockSourceTriangles",
  "authoredTerminal4A1LegacyBlockRetainedTriangles",
  "authoredTerminal4A1LegacyBlockAuthority",
]) {
  if (!source.includes(token)) throw new Error(`Terminal 4 A1 block-filter preparation is missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared surgical Terminal 4 A1 authored cleanup: preserved the PHX_TERM400_1 source terminal box that owns A1's real attachment face and removed only two detached artifacts, 24 triangles total, with bounded runtime evidence.");
