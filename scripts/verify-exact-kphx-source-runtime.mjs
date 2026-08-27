#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../assets/kphx-source/exact-kphx-manifest.json", import.meta.url), "utf8"));
const garageManifest = JSON.parse(await readFile(new URL("../assets/kphx-source/exact-parking-garages.json", import.meta.url), "utf8"));
const landmarkManifest = JSON.parse(await readFile(new URL("../assets/kphx-source/exact-landmarks.json", import.meta.url), "utf8"));
const wrapper = await readFile(new URL("../src/environment/authoredTerminal4Visual.js", import.meta.url), "utf8");
const loader = await readFile(new URL("../src/environment/sourceKphxTerminal4.js", import.meta.url), "utf8");
const landmarkLoader = await readFile(new URL("../src/environment/sourceKphxLandmarks.js", import.meta.url), "utf8");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function parseGlb(bytes, label) {
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error(`${label}: missing glTF magic`);
  if (bytes.readUInt32LE(4) !== 2) throw new Error(`${label}: unsupported GLB version`);
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error(`${label}: header length mismatch`);
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${label}: JSON chunk missing`);
  return JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").trim());
}

async function verifyRuntimeEntry(label, entry) {
  const expected = entry.runtimeGlb ?? {
    path: `public/models/kphx/${entry.runtime}`,
    bytes: entry.runtimeBytes,
    sha256: entry.runtimeSha256,
  };
  const obj = entry.obj ?? {
    vertices: entry.vertices,
    indices: entry.indices,
    sha256: entry.sourceSha256,
  };
  const bytes = await readFile(new URL(`../${expected.path}`, import.meta.url));
  const actualHash = sha256(bytes);
  if (bytes.length !== expected.bytes || actualHash !== expected.sha256) {
    throw new Error(`${label}: runtime identity mismatch ${bytes.length}/${actualHash}; expected ${expected.bytes}/${expected.sha256}`);
  }
  const gltf = parseGlb(bytes, label);
  const primitive = gltf.meshes?.[0]?.primitives?.[0];
  const positionAccessor = gltf.accessors?.[primitive?.attributes?.POSITION];
  const indexAccessor = gltf.accessors?.[primitive?.indices];
  if (positionAccessor?.count !== obj.vertices) throw new Error(`${label}: vertex count ${positionAccessor?.count} != ${obj.vertices}`);
  if (indexAccessor?.count !== obj.indices) throw new Error(`${label}: index count ${indexAccessor?.count} != ${obj.indices}`);

  const expectsLit = Boolean(entry.litTexture);
  const expectedImageCount = expectsLit ? 2 : 1;
  if (gltf.images?.length !== expectedImageCount || gltf.textures?.length !== expectedImageCount) {
    throw new Error(`${label}: expected ${expectedImageCount} exact authored texture(s)`);
  }
  const source = gltf.extras?.source;
  if (source?.obj?.sha256 !== obj.sha256 || source?.dayTexture?.sha256 !== entry.dayTexture.sha256) {
    throw new Error(`${label}: embedded OBJ/day texture identities do not match Drive authority`);
  }
  if (expectsLit && source?.litTexture?.sha256 !== entry.litTexture.sha256) {
    throw new Error(`${label}: embedded LIT texture identity does not match Drive authority`);
  }
  if (!expectsLit && source?.litTexture) throw new Error(`${label}: unexpected generated LIT texture`);
  return { label, bytes: bytes.length, sha256: actualHash, vertices: positionAccessor.count, indices: indexAccessor.count, textures: expectedImageCount };
}

async function verifyWedJetwayPlacements() {
  const expected = manifest.wed?.jetwayFacades;
  if (!expected) throw new Error("exact KPHX manifest is missing WED jetway facade artifact identity");
  const bytes = await readFile(new URL(`../${expected.path}`, import.meta.url));
  const actualHash = sha256(bytes);
  if (bytes.length !== expected.bytes || actualHash !== expected.sha256) throw new Error("WED jetway placement identity mismatch");
  const payload = JSON.parse(bytes.toString("utf8"));
  if (payload.schemaVersion !== 1 || payload.authority !== "KPHX-1.75.1-earth.wed.xml") throw new Error("WED jetway placement artifact has wrong schema/source authority");
  if (payload.source?.bytes !== manifest.wed.bytes || payload.source?.sha256 !== manifest.wed.sha256) throw new Error("WED jetway artifact does not identify pinned earth.wed.xml");
  if (payload.jetwayFacadeCount !== expected.count || payload.placements?.length !== expected.count) throw new Error("WED jetway facade count drifted");
  const ids = new Set();
  let nodeCount = 0;
  for (const placement of payload.placements) {
    if (!Number.isInteger(placement.wedObjectId) || ids.has(placement.wedObjectId)) throw new Error(`WED jetway duplicate/invalid id ${placement.wedObjectId}`);
    ids.add(placement.wedObjectId);
    if (placement.resource !== "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac") throw new Error(`WED jetway ${placement.wedObjectId}: unexpected resource ${placement.resource}`);
    if (!Array.isArray(placement.rings) || placement.rings.length !== 1 || !placement.rings[0].nodes?.length) throw new Error(`WED jetway ${placement.wedObjectId}: exact ring missing`);
    for (const node of placement.rings[0].nodes) {
      if (!/^[-+]?\d+\.\d+$/.test(node.latitude) || !/^[-+]?\d+\.\d+$/.test(node.longitude) || !node.wallType) throw new Error(`WED jetway ${placement.wedObjectId}: source node data not preserved`);
      nodeCount += 1;
    }
  }
  return { count: payload.placements.length, nodeCount, bytes: bytes.length, sha256: actualHash };
}

async function verifyWedGroundGeometry() {
  const expected = manifest.wed?.groundGeometry;
  if (!expected) throw new Error("exact KPHX manifest is missing WED ground artifact identity");
  const bytes = await readFile(new URL(`../${expected.path}`, import.meta.url));
  const actualHash = sha256(bytes);
  if (bytes.length !== expected.bytes || actualHash !== expected.sha256) throw new Error("WED ground identity mismatch");
  const payload = JSON.parse(bytes.toString("utf8"));
  if (payload.schemaVersion !== 1 || payload.authority !== "KPHX-1.75.1-earth.wed.xml-ground") throw new Error("WED ground artifact has wrong source authority");
  if (payload.source?.bytes !== manifest.wed.bytes || payload.source?.sha256 !== manifest.wed.sha256) throw new Error("WED ground artifact does not identify pinned earth.wed.xml");
  if (JSON.stringify(payload.counts) !== JSON.stringify(expected.counts)) throw new Error("WED ground counts drifted");
  return { counts: payload.counts, bytes: bytes.length, sha256: actualHash };
}

async function verifyWedObjectPlacements() {
  const expected = manifest.wed?.objectPlacements;
  if (!expected) throw new Error("exact KPHX manifest is missing WED object placement authority");
  const bytes = await readFile(new URL(`../${expected.path}`, import.meta.url));
  const actualHash = sha256(bytes);
  if (bytes.length !== expected.bytes || actualHash !== expected.sha256) throw new Error("WED object placement identity mismatch");
  const payload = JSON.parse(bytes.toString("utf8"));
  if (payload.schemaVersion !== 1 || payload.authority !== "KPHX-1.75.1-earth.wed.xml") throw new Error("WED object placement artifact has wrong source authority");
  if (payload.source?.bytes !== manifest.wed.bytes || payload.source?.sha256 !== manifest.wed.sha256) throw new Error("WED object placement artifact does not identify pinned earth.wed.xml");
  if (payload.objectPlacementCount !== expected.count || payload.placements?.length !== expected.count || payload.uniqueResourceCount !== expected.uniqueResources) throw new Error("WED object placement counts drifted");
  const requiredResources = new Set([
    "Terminals/Terminal3a.obj", "Terminals/Terminal3Garage.obj", "Terminals/Terminal4b.obj", "Terminals/Terminal4.obj",
    ...garageManifest.models.map((entry) => entry.resource),
    ...landmarkManifest.models.map((entry) => entry.resource),
  ]);
  for (const placement of payload.placements) requiredResources.delete(placement.resource);
  if (requiredResources.size) throw new Error(`WED object artifact lost authored runtime resources: ${[...requiredResources].join(", ")}`);
  return { count: payload.objectPlacementCount, uniqueResources: payload.uniqueResourceCount, bytes: bytes.length, sha256: actualHash };
}

if (!wrapper.includes('from "./sourceKphxTerminal4.js"') || !wrapper.includes("installSourceKphxTerminal4Visual")) throw new Error("Compatibility entry point does not delegate to exact KPHX building loader");
if (!wrapper.includes('from "./sourceKphxLandmarks.js"') || !wrapper.includes("installSourceKphxLandmarks")) throw new Error("Compatibility entry point does not attach exact KPHX landmarks");
for (const forbidden of ["buildSourcePlacedTerminal4Jetways", "BoxGeometry", "CylinderGeometry", "source-atlas", "facadeInfill"]) {
  if (wrapper.includes(forbidden)) throw new Error(`Reconstructed Terminal 4 authority survived in compatibility wrapper: ${forbidden}`);
}
for (const required of [
  "KPHX 1.75.1 earth.wed.xml WED_RampPosition 27855", "33.436530675", "-111.998921221",
  "Terminal4b.exact.glb", "Terminal4.exact.glb", "Terminal3a.exact.glb", "Terminal3Garage.exact.glb",
  "Garage1.exact.glb", "Garage2.exact.glb", "Garage3.exact.glb", "Garage4.exact.glb", "Garage5.exact.glb", "Garage6.exact.glb",
  "KPHX_1_75_1_WED_Source_Frame", "KPHX_Terminal4_Source_Objects", "KPHX_Terminal3_Source_Objects", "KPHX_ParkingGarage_Source_Objects",
  "sourceKphxAuthoredBuildingCount", "exact-user-drive-kphx-1.75.1",
]) {
  if (!loader.includes(required)) throw new Error(`Exact KPHX building loader is missing source-authority token: ${required}`);
}
for (const required of [
  "SkyTrain.exact.glb", "Tower.exact.glb", "FireStation.exact.glb", "FireStation2.exact.glb", "BaggageStand.exact.glb", "SkyTrainDepot.exact.glb",
  "KPHX_Landmark_Source_Objects", "sourceKphxLandmarkObjectCount", "exact-user-drive-kphx-1.75.1",
]) {
  if (!landmarkLoader.includes(required)) throw new Error(`Exact KPHX landmark loader is missing source-authority token: ${required}`);
}

const authoredBuildings = await Promise.all([
  verifyRuntimeEntry("terminal4North", manifest.terminal4North),
  verifyRuntimeEntry("terminal4South", manifest.terminal4South),
  verifyRuntimeEntry("terminal3Main", manifest.terminal3Main),
  verifyRuntimeEntry("terminal3Garage", manifest.terminal3Garage),
  ...garageManifest.models.map((entry) => verifyRuntimeEntry(entry.name, {
    ...entry,
    obj: { vertices: entry.vertices, indices: entry.indices, sha256: entry.sourceSha256 },
    dayTexture: garageManifest.sharedTextures[entry.texture],
  })),
]);
const landmarks = await Promise.all(landmarkManifest.models.map((entry) => verifyRuntimeEntry(entry.name, {
  ...entry,
  obj: { vertices: entry.vertices, indices: entry.indices, sha256: entry.sourceSha256 },
})));
if (authoredBuildings.length !== 10) throw new Error(`Expected 10 exact authored KPHX building models, received ${authoredBuildings.length}`);
if (landmarks.length !== 6) throw new Error(`Expected 6 exact authored KPHX landmark models, received ${landmarks.length}`);

const [wedJetways, wedGround, wedObjects] = await Promise.all([
  verifyWedJetwayPlacements(),
  verifyWedGroundGeometry(),
  verifyWedObjectPlacements(),
]);
console.log(JSON.stringify({ authority: manifest.authority, authoredBuildings, landmarks, totalExactRuntimeModels: authoredBuildings.length + landmarks.length, wedJetways, wedGround, wedObjects }, null, 2));
