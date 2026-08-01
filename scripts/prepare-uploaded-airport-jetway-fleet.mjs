import fs from "node:fs";

const path = "src/environment/sourcePlacedTerminal4Jetways.js";
let source = fs.readFileSync(path, "utf8");

const importLine = 'import { installUploadedAirportJetwayFleet } from "./uploadedAirportJetwayFleet.js";';
if (!source.includes(importLine)) {
  const anchor = 'import { buildAnimatedA1Jetway } from "./animatedA1Jetway.js";';
  if (!source.includes(anchor)) throw new Error(`${path}: uploaded jetway import anchor missing`);
  source = source.replace(anchor, `${anchor}\n${importLine}`);
}

const placementDeclaration = "  const uploadedJetwayPlacements = [];";
if (!source.includes(placementDeclaration)) {
  const anchor = "  let a1AnimatedLayout = null;";
  if (!source.includes(anchor)) throw new Error(`${path}: placement declaration anchor missing`);
  source = source.replace(anchor, `${anchor}\n${placementDeclaration}`);
}

const placementPush = `    uploadedJetwayPlacements.push({
      gate: jetway.g,
      x: jetway.x,
      z: jetway.z,
      yaw,
      rotundaY,
      bridgeEnd,
      cabinY,
    });`;
if (!source.includes(placementPush)) {
  const anchor = "    const highDetail = Math.hypot(jetway.x, jetway.z) <= SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.highDetailRadiusMeters;";
  if (!source.includes(anchor)) throw new Error(`${path}: per-gate placement anchor missing`);
  source = source.replace(anchor, `${placementPush}\n${anchor}`);
}

const installLine = "  const uploadedJetwayController = installUploadedAirportJetwayFleet(THREE, group, uploadedJetwayPlacements);";
if (!source.includes(installLine)) {
  const anchor = "  group.userData.sourceArchive = SOURCE_PLACED_TERMINAL4_JETWAY_PROFILE.sourceArchive;";
  if (!source.includes(anchor)) throw new Error(`${path}: uploaded fleet installation anchor missing`);
  source = source.replace(anchor, `${installLine}\n${anchor}`);
}

source = source
  .replace(
    '  group.userData.sourceGeometryMode = "procedural-articulated-fallback-pending-original-AIR_Jetway01-mesh-recovery";',
    '  group.userData.sourceGeometryMode = "user-supplied-airport-jetway-loading";',
  )
  .replace(
    "  group.userData.requiresOriginalSourceMesh = true;",
    "  group.userData.requiresOriginalSourceMesh = false;",
  )
  .replace(
    "  group.userData.a1JetwayController = animatedA1Jetway.userData.controller;",
    "  group.userData.a1JetwayController = uploadedJetwayController;",
  )
  .replace(
    /  group\.userData\.visualAuthority = "source-scale articulated fallback[^\n]*";/,
    '  group.userData.visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v1";',
  );

const supersededDisclosure = '  group.userData.supersededFallbackDisclosure = \'visualAuthority = "source-scale articulated fallback while original AIR_Jetway01 mesh is recovered"\';';
if (!source.includes(supersededDisclosure)) {
  const authority = '  group.userData.visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v1";';
  if (!source.includes(authority)) throw new Error(`${path}: uploaded visual authority anchor missing`);
  source = source.replace(authority, `${authority}\n${supersededDisclosure}`);
}

for (const token of [
  importLine,
  placementDeclaration,
  placementPush,
  installLine,
  'sourceGeometryMode = "user-supplied-airport-jetway-loading"',
  "requiresOriginalSourceMesh = false",
  "a1JetwayController = uploadedJetwayController",
  'visualAuthority = "user-supplied-airport-jetway-tunnel-a-b-c-rotunda-cab-v1"',
  "supersededFallbackDisclosure",
]) {
  if (!source.includes(token)) throw new Error(`${path}: uploaded airport jetway integration missing ${token}`);
}

fs.writeFileSync(path, source, "utf8");
console.log("Prepared all 58 Terminal 4 gate transforms for the uploaded Tunnel_A/Tunnel_B/Tunnel_C/Rotunda/Cab jetway replacement. Airport placement remains unchanged; the former fallback authority is retained only as superseded audit text.");
