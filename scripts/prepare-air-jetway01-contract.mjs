import fs from "node:fs";

const path = "scripts/verify-kphx-v181-source-contract.mjs";
let source = fs.readFileSync(path, "utf8");

const oldBlock = `for (const token of [
  'sourceArchive: "unmlobo-kphx1-8-1_Mu9aq.zip"',
  'placementSource: "scenery/world/scenery/kphx-airport.bgl"',
  "terminal4JetwayCount: 58",
  "concourseA.jetways",
  "concourseB.jetways",
  "KPHX_SourcePlaced_JetwayRotundas",
  "KPHX_SourcePlaced_JetwayOuterTunnels",
  "KPHX_SourcePlaced_JetwayInnerTunnels",
  "KPHX_SourcePlaced_JetwayCabins",
  "KPHX_SourcePlaced_JetwayBellowsHorizontal",
  "KPHX_SourcePlaced_JetwayWheels",
  "KPHX_SourcePlaced_JetwayServiceSteps",
  "group.position.fromArray(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset)",
  "highDetailRadiusMeters: 180",
]) {
  if (!files.jetways.includes(token)) throw new Error(\`Terminal 4 jetway visual contract missing \${token}\`);
}
if (files.jetways.includes("CanvasTexture")) throw new Error("Terminal 4 jetways must reuse supplied source textures instead of generated canvas textures");`;

const newBlock = `for (const token of [
  'sourceArchive: "unmlobo-kphx1-8-1_Mu9aq.zip"',
  'placementSource: "scenery/world/scenery/kphx-airport.bgl"',
  'sourceLibraryModel: "AIR_Jetway01"',
  'sourceLibraryGuid: "{bfcdf52b-9142-415c-8318-03c1b92ca9d9}"',
  "sourceAirportJetwayRecordCount: 101",
  "terminal4JetwayCount: 58",
  "sourceDimensionsMeters: Object.freeze([37.92, 8.77, 26.51])",
  "concourseA.jetways",
  "concourseB.jetways",
  "createArchedTunnelGeometry",
  "AIR_Jetway01_OuterTelescopingTunnels",
  "AIR_Jetway01_InnerTelescopingTunnels",
  "AIR_Jetway01_AircraftCabins",
  "AIR_Jetway01_RotundaWindowBands",
  "AIR_Jetway01_BellowsHorizontal",
  "AIR_Jetway01_LiftColumns",
  "AIR_Jetway01_WheelBogies",
  "AIR_Jetway01_ServiceSteps",
  "AIR_Jetway01_UnderbridgeServiceCable",
  "group.position.fromArray(SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sceneOffset)",
  "highDetailRadiusMeters: 240",
  'detailLevel: "fsx-air-jetway01-faithful-articulated-v2"',
  'visualAuthority = "faithful-reconstruction-of-referenced-fsx-air-jetway01-library-object"',
  "usesTerminalBuildingTextures = false",
  "proceduralBuildingBoxReuse = false",
  "const targetX = jetway.px - forwardX * 5.6",
  "const targetZ = jetway.pz - forwardZ * 5.6",
]) {
  if (!files.jetways.includes(token)) throw new Error(\`AIR_Jetway01 visual contract missing \${token}\`);
}
for (const forbidden of [
  "KPHX_SourcePlaced_JetwayOuterTunnels",
  "KPHX_SourcePlaced_JetwayInnerTunnels",
  "KPHX_SourcePlaced_JetwayCabins",
  "PHX source jetway outer shell",
  "PHX source jetway cabin",
  "function sourceTexture",
  "textures.get(reference.toUpperCase())",
]) {
  if (files.jetways.includes(forbidden)) throw new Error(\`Obsolete box-built or terminal-textured jetway returned: \${forbidden}\`);
}
if (files.jetways.includes("CanvasTexture")) throw new Error("AIR_Jetway01 must not depend on generated canvas textures");`;

if (!source.includes('sourceLibraryGuid: "{bfcdf52b-9142-415c-8318-03c1b92ca9d9}"')) {
  if (!source.includes(oldBlock)) throw new Error("AIR_Jetway01 contract migration cannot find the obsolete jetway verifier block");
  source = source.replace(oldBlock, newBlock);
}

for (const token of [
  'sourceLibraryModel: "AIR_Jetway01"',
  'sourceLibraryGuid: "{bfcdf52b-9142-415c-8318-03c1b92ca9d9}"',
  "AIR_Jetway01_OuterTelescopingTunnels",
  "usesTerminalBuildingTextures = false",
  "proceduralBuildingBoxReuse = false",
  "Obsolete box-built or terminal-textured jetway returned",
]) {
  if (!source.includes(token)) throw new Error(`Prepared AIR_Jetway01 contract is missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared AIR_Jetway01 source contract: exact GUID, articulated geometry, source placements, and no terminal-texture reuse.");
