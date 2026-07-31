import fs from "node:fs";

const jetwayPath = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(jetwayPath, "utf8");
const authority = "exact-BGATE3-B15-regional-wall-plane-v16";

if (!source.includes(authority)) {
  const a1Block = `    if (jetway.g === "A1") {
      const exactWallX = -3.55299146;
      const exactWallZ = -40.60699866;
      const exactDx = exactWallX - jetway.x;
      const exactDz = exactWallZ - jetway.z;
      const exactDistance = Math.hypot(exactDx, exactDz);
      Object.assign(terminalConnection, {
        distance: exactDistance,
        towardX: exactDx / exactDistance,
        towardZ: exactDz / exactDistance,
        authority: "exact-BGATE1-A1-terminal-wall-plane-v14",
      });
    }`;
  const exactRegionalBlock = `${a1Block}
    // B15L and B15M are the two regional positions at the far end of the B
    // concourse. Their source rotundas are 88-112 m from the exact BGATE3 wall,
    // beyond the generic 48 m search radius. Use the supplied wall plane rather
    // than leaving both bridges as isolated apron objects.
    if (jetway.g === "B15L" || jetway.g === "B15M") {
      const exactWallX = jetway.x;
      const exactWallZ = 438.76899316;
      const exactDx = exactWallX - jetway.x;
      const exactDz = exactWallZ - jetway.z;
      const exactDistance = Math.hypot(exactDx, exactDz);
      Object.assign(terminalConnection, {
        distance: exactDistance,
        towardX: exactDx / exactDistance,
        towardZ: exactDz / exactDistance,
        authority: "${authority}",
      });
    }`;
  if (!source.includes(a1Block)) throw new Error(`${jetwayPath}: missing exact A1 connection anchor for B15`);
  source = source.replace(a1Block, exactRegionalBlock);

  const lengthAnchor = "    const wallConnectorLength = clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 44);";
  const lengthReplacement = `    const exactLongRegionalConnector = jetway.g === "B15L" || jetway.g === "B15M";
    const wallConnectorLength = exactLongRegionalConnector
      ? (terminalWallDistance ?? 1.25) + 0.35
      : clamp((terminalWallDistance ?? 1.25) + 0.35, 1.25, 44);`;
  if (!source.includes(lengthAnchor)) throw new Error(`${jetwayPath}: missing connector-length anchor for B15`);
  source = source.replace(lengthAnchor, lengthReplacement);

  const declarationsAnchor = "  let a1AnimatedLayout = null;";
  const declarationsReplacement = `  let a1AnimatedLayout = null;
  const b15TerminalConnections = {};`;
  if (!source.includes(declarationsAnchor)) throw new Error(`${jetwayPath}: missing B15 evidence declaration anchor`);
  source = source.replace(declarationsAnchor, declarationsReplacement);

  const evidenceAnchor = `    if (jetway.g === "A1") {
      a1TerminalWallDistance = terminalWallDistance;
      a1TerminalConnectionAuthority = terminalConnection?.authority ?? null;
      a1TerminalConnectionDirection = terminalConnection
        ? [terminalConnection.towardX, terminalConnection.towardZ]
        : null;
    }`;
  const evidenceReplacement = `${evidenceAnchor}
    if (jetway.g === "B15L" || jetway.g === "B15M") {
      b15TerminalConnections[jetway.g] = Object.freeze({
        distanceMeters: terminalWallDistance,
        direction: terminalConnection ? [terminalConnection.towardX, terminalConnection.towardZ] : null,
        authority: terminalConnection?.authority ?? null,
      });
    }`;
  if (!source.includes(evidenceAnchor)) throw new Error(`${jetwayPath}: missing A1 evidence anchor for B15`);
  source = source.replace(evidenceAnchor, evidenceReplacement);

  const userDataAnchor = "  group.userData.a1TerminalConnectionDirection = a1TerminalConnectionDirection;";
  const userDataReplacement = `${userDataAnchor}
  group.userData.b15TerminalConnections = Object.freeze({ ...b15TerminalConnections });
  group.userData.b15TerminalConnectionAuthority = "${authority}";
  group.userData.b15TerminalConnectedCount = Object.keys(b15TerminalConnections).length;`;
  if (!source.includes(userDataAnchor)) throw new Error(`${jetwayPath}: missing B15 userData anchor`);
  source = source.replace(userDataAnchor, userDataReplacement);
}

for (const token of [
  authority,
  "const exactWallZ = 438.76899316",
  "const exactLongRegionalConnector",
  "b15TerminalConnections[jetway.g]",
  "group.userData.b15TerminalConnectedCount",
]) {
  if (!source.includes(token)) throw new Error(`${jetwayPath}: B15 terminal connector v16 is missing ${token}`);
}

fs.writeFileSync(jetwayPath, source, "utf8");
console.log("Prepared exact B15L/B15M Terminal 4 connections: both regional rotundas now reach the supplied BGATE3 wall with fully supported fixed walkways.");
