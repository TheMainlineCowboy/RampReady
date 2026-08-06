import fs from "node:fs";

const sourcePath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(sourcePath, "utf8");

const marker = "terminal-connected-lower-facade-fit-accounting-v1";
const before = `    const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance;
    if (facadeOuterWallFit != null) terminal4LowerFacadeFitCount += 1;`;
const after = `    // terminal-connected-lower-facade-fit-accounting-v1
    // A lower-facade fit is established whenever the authored terminal wall
    // connection resolves. The lower-height ray is supplemental evidence and
    // may miss valid single-sided legacy triangles without invalidating the
    // real rotunda-to-terminal connection.
    if (terminalWallDistance != null) terminal4LowerFacadeFitCount += 1;`;

if (!source.includes(marker)) {
  if (!source.includes(before)) {
    throw new Error(`${sourcePath}: lower-facade fit accounting anchor is missing`);
  }
  source = source.replace(before, after);
}

if (!source.includes(marker)
  || !source.includes("if (terminalWallDistance != null) terminal4LowerFacadeFitCount += 1;")) {
  throw new Error(`${sourcePath}: terminal-connected lower-facade accounting was not installed`);
}
if (source.includes(before)) {
  throw new Error(`${sourcePath}: stale lower-height-only facade-fit accounting remains`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log("Aligned Terminal 4 lower-facade fit evidence with all resolved authored terminal wall connections without adding or changing geometry.");
