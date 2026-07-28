import fs from "node:fs";

const files = {
  a: fs.readFileSync("src/environment/kphxV181/concourseA.js", "utf8"),
  b: fs.readFileSync("src/environment/kphxV181/concourseB.js", "utf8"),
  builder: fs.readFileSync("src/environment/kphxV181Terminal4.js", "utf8"),
  ground: fs.readFileSync("src/environment/authoredKphxGround.js", "utf8"),
  prepare: fs.readFileSync("scripts/prepare-terminal4-runtime.mjs", "utf8"),
};
for (const token of ['"g":"A1"', '"g":"B15L"', '"g":"B15M"']) {
  if (!(files.a + files.b).includes(token)) throw new Error(`KPHX gate source missing ${token}`);
}
const parkingCount = (files.a.match(/"i":/g) || []).length + (files.b.match(/"i":/g) || []).length;
const jetwayCount = (files.a.match(/"px":/g) || []).length + (files.b.match(/"px":/g) || []).length;
if (parkingCount !== 58 || jetwayCount !== 58) throw new Error(`KPHX Terminal 4 counts ${parkingCount}/${jetwayCount}`);
for (const token of [
  "CanvasTexture",
  "InstancedMesh",
  "KPHX_Terminal4_JetwayOuterSections",
  "KPHX_Terminal4_JetwayInnerSections",
  "KPHX_Terminal4_JetwayRotundas",
  "KPHX_Terminal4_GateLeadIns",
  "terminal4-refined-v2",
]) {
  if (!files.builder.includes(token)) throw new Error(`KPHX builder contract missing ${token}`);
}
for (const token of ['groundSource = "authored-kphx-v181"', "sourceJetwayCount", "b15Anchors", "trainingCorridor", "kphxDetailLevel"]) {
  if (!files.ground.includes(token)) throw new Error(`KPHX runtime contract missing ${token}`);
}
for (const token of ['dataset.kphxVersion', 'dataset.kphxDetailLevel', 'dataset.sourceJetwayCount', 'dataset.b15Anchors', 'dataset.b15CorridorMeters']) {
  if (!files.prepare.includes(token)) throw new Error(`KPHX browser evidence missing ${token}`);
}
console.log(`Verified refined KPHX v1.8.1 source contract: ${parkingCount} Terminal 4 stands and ${jetwayCount} telescoping jetways.`);
