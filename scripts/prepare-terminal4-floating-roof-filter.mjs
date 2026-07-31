import fs from "node:fs";

const path = "src/environment/authoredTerminal4Visual.js";
let source = fs.readFileSync(path, "utf8");

const filterImport = 'import { removeTerminal4FloatingRoofSlabs } from "./terminal4FloatingRoofFilter.js";';
if (!source.includes(filterImport)) {
  const anchor = 'import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";';
  if (!source.includes(anchor)) throw new Error("Terminal 4 floating-roof import anchor is missing");
  source = source.replace(anchor, `${anchor}\n${filterImport}`);
}

const filterCall = "  const floatingRoofRemoval = removeTerminal4FloatingRoofSlabs(THREE, authored);";
if (!source.includes(filterCall)) {
  const a1Call = "  const a1LegacyBlockRemoval = removeTerminal4A1LegacyBlock(THREE, authored);";
  const fallbackAnchor = '  authored.name = "PHX_Terminal4_AuthoredTexturedVisual";';
  const anchor = source.includes(a1Call) ? a1Call : fallbackAnchor;
  if (!source.includes(anchor)) throw new Error("Terminal 4 floating-roof call anchor is missing");
  source = source.replace(anchor, `${anchor}\n${filterCall}`);
}

const evidence = `  environment.userData.authoredTerminal4FloatingRoofRemovedTriangles = floatingRoofRemoval.removedTriangleCount;
  environment.userData.authoredTerminal4FloatingRoofSourceTriangles = floatingRoofRemoval.sourceTriangleCount;
  environment.userData.authoredTerminal4FloatingRoofRetainedTriangles = floatingRoofRemoval.retainedTriangleCount;
  environment.userData.authoredTerminal4FloatingRoofAuthority = authored.userData.floatingRoofAuthority;`;
if (!source.includes("authoredTerminal4FloatingRoofRemovedTriangles")) {
  const anchor = "  environment.userData.authoredTerminal4GroundCleanupPass = AUTHORED_TERMINAL4_PROFILE.groundCleanupPass;";
  if (!source.includes(anchor)) throw new Error("Terminal 4 floating-roof evidence anchor is missing");
  source = source.replace(anchor, `${anchor}\n${evidence}`);
}

for (const token of [
  filterImport,
  filterCall,
  "authoredTerminal4FloatingRoofRemovedTriangles",
  "authoredTerminal4FloatingRoofSourceTriangles",
  "authoredTerminal4FloatingRoofRetainedTriangles",
  "authoredTerminal4FloatingRoofAuthority",
]) {
  if (!source.includes(token)) throw new Error(`Terminal 4 floating-roof preparation is missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared exact Terminal 4 floating-roof cleanup: two detached PHX_TERM400_1 black slabs, four triangles total, are removed before rendering.");
