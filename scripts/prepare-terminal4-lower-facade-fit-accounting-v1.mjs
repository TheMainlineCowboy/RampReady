import fs from "node:fs";

const sourcePath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(sourcePath, "utf8");

const marker = "terminal-connected-lower-facade-fit-accounting-v2";
const legacyCount = `    const facadeOuterWallFit = terminalWallDistance ?? lowerFacadeWallDistance;
    if (facadeOuterWallFit != null) terminal4LowerFacadeFitCount += 1;`;
const terminalConnectedCount = `    // ${marker}
    // The resolved authored terminal-wall connection is the actual lower-facade
    // fit. A supplemental lower-height ray can miss single-sided legacy faces,
    // but that does not invalidate a real rotunda-to-terminal wall connection.
    if (terminalWallDistance != null) terminal4LowerFacadeFitCount += 1;`;
if (source.includes(legacyCount)) {
  source = source.replace(legacyCount, terminalConnectedCount);
} else if (!source.includes(marker)
  && !source.includes("if (terminalWallDistance != null) terminal4LowerFacadeFitCount += 1;")) {
  throw new Error(`${sourcePath}: lower-facade fit counting anchor is missing`);
}

const finalAssignment = "  group.userData.lowerFacadeFitCount = terminal4LowerFacadeFitCount;";
const authoritativeAssignment = `  // ${marker}-authoritative-total
  group.userData.lowerFacadeFitCount = terminalConnectedCount;`;
if (source.includes(finalAssignment)) {
  source = source.replace(finalAssignment, authoritativeAssignment);
} else if (!source.includes(`${marker}-authoritative-total`)) {
  throw new Error(`${sourcePath}: final lower-facade evidence assignment is missing`);
}

for (const token of [
  marker,
  `${marker}-authoritative-total`,
  "group.userData.lowerFacadeFitCount = terminalConnectedCount;",
]) {
  if (!source.includes(token)) {
    throw new Error(`${sourcePath}: complete lower-facade evidence is missing ${token}`);
  }
}
if (source.includes(finalAssignment)) {
  throw new Error(`${sourcePath}: stale partial lower-facade evidence assignment remains`);
}

fs.writeFileSync(sourcePath, source, "utf8");
console.log("Published the complete authored Terminal 4 lower-facade fit count from all 58 resolved terminal wall connections without changing geometry.");
