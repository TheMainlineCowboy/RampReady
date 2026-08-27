#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile(new URL("../assets/kphx-source/exact-kphx-manifest.json", import.meta.url), "utf8"));
const wrapper = await readFile(new URL("../src/environment/authoredTerminal4Visual.js", import.meta.url), "utf8");
const loader = await readFile(new URL("../src/environment/sourceKphxTerminal4.js", import.meta.url), "utf8");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

function parseGlb(bytes, label) {
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error(`${label}: missing glTF magic`);
  if (bytes.readUInt32LE(4) !== 2) throw new Error(`${label}: unsupported GLB version`);
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error(`${label}: header length mismatch`);
  const jsonLength = bytes.readUInt32LE(12);
  if (bytes.readUInt32LE(16) !== 0x4e4f534a) throw new Error(`${label}: JSON chunk missing`);
  const json = JSON.parse(bytes.subarray(20, 20 + jsonLength).toString("utf8").trim());
  return json;
}

async function verifyRuntime(key) {
  const entry = manifest[key];
  const expected = entry.runtimeGlb;
  const path = new URL(`../${expected.path}`, import.meta.url);
  const bytes = await readFile(path);
  const actualHash = sha256(bytes);
  if (bytes.length !== expected.bytes || actualHash !== expected.sha256) {
    throw new Error(`${key}: runtime identity mismatch ${bytes.length}/${actualHash}; expected ${expected.bytes}/${expected.sha256}`);
  }
  const gltf = parseGlb(bytes, key);
  const primitive = gltf.meshes?.[0]?.primitives?.[0];
  const positionAccessor = gltf.accessors?.[primitive?.attributes?.POSITION];
  const indexAccessor = gltf.accessors?.[primitive?.indices];
  if (positionAccessor?.count !== entry.obj.vertices) {
    throw new Error(`${key}: vertex count ${positionAccessor?.count} != ${entry.obj.vertices}`);
  }
  if (indexAccessor?.count !== entry.obj.indices) {
    throw new Error(`${key}: index count ${indexAccessor?.count} != ${entry.obj.indices}`);
  }
  if (gltf.images?.length !== 2 || gltf.textures?.length !== 2) throw new Error(`${key}: expected exact day + LIT texture pair`);
  const source = gltf.extras?.source;
  if (source?.obj?.sha256 !== entry.obj.sha256
      || source?.dayTexture?.sha256 !== entry.dayTexture.sha256
      || source?.litTexture?.sha256 !== entry.litTexture.sha256) {
    throw new Error(`${key}: embedded source identities do not match Drive authority`);
  }
  return { key, bytes: bytes.length, sha256: actualHash, vertices: positionAccessor.count, indices: indexAccessor.count };
}

async function verifyWedJetwayPlacements() {
  const expected = manifest.wed?.jetwayFacades;
  if (!expected) throw new Error("exact KPHX manifest is missing WED jetway facade artifact identity");
  const bytes = await readFile(new URL(`../${expected.path}`, import.meta.url));
  const actualHash = sha256(bytes);
  if (bytes.length !== expected.bytes || actualHash !== expected.sha256) {
    throw new Error(`WED jetway placement identity mismatch ${bytes.length}/${actualHash}; expected ${expected.bytes}/${expected.sha256}`);
  }
  const payload = JSON.parse(bytes.toString("utf8"));
  if (payload.schemaVersion !== 1 || payload.authority !== "KPHX-1.75.1-earth.wed.xml") {
    throw new Error("WED jetway placement artifact has wrong schema/source authority");
  }
  if (payload.source?.bytes !== manifest.wed.bytes || payload.source?.sha256 !== manifest.wed.sha256) {
    throw new Error("WED jetway placement artifact does not identify the pinned earth.wed.xml source");
  }
  if (payload.jetwayFacadeCount !== expected.count || payload.placements?.length !== expected.count) {
    throw new Error(`WED jetway facade count ${payload.placements?.length}/${payload.jetwayFacadeCount} != ${expected.count}`);
  }
  const ids = new Set();
  let nodeCount = 0;
  for (const placement of payload.placements) {
    if (!Number.isInteger(placement.wedObjectId) || ids.has(placement.wedObjectId)) {
      throw new Error(`WED jetway placement has duplicate/invalid id ${placement.wedObjectId}`);
    }
    ids.add(placement.wedObjectId);
    if (placement.resource !== "lib/airport/Ramp_Equipment/Jetways/Jetway_1_solid.fac") {
      throw new Error(`WED jetway ${placement.wedObjectId}: unexpected facade resource ${placement.resource}`);
    }
    if (!Array.isArray(placement.rings) || placement.rings.length !== 1 || !placement.rings[0].nodes?.length) {
      throw new Error(`WED jetway ${placement.wedObjectId}: exact ordered facade ring is missing`);
    }
    for (const node of placement.rings[0].nodes) {
      if (!/^[-+]?\d+\.\d+$/.test(node.latitude) || !/^[-+]?\d+\.\d+$/.test(node.longitude) || !node.wallType) {
        throw new Error(`WED jetway ${placement.wedObjectId}: source coordinate/wall-type text was not preserved`);
      }
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
  if (bytes.length !== expected.bytes || actualHash !== expected.sha256) {
    throw new Error(`WED ground identity mismatch ${bytes.length}/${actualHash}; expected ${expected.bytes}/${expected.sha256}`);
  }
  const payload = JSON.parse(bytes.toString("utf8"));
  if (payload.schemaVersion !== 1 || payload.authority !== "KPHX-1.75.1-earth.wed.xml-ground") {
    throw new Error("WED ground artifact has wrong schema/source authority");
  }
  if (payload.source?.bytes !== manifest.wed.bytes || payload.source?.sha256 !== manifest.wed.sha256) {
    throw new Error("WED ground artifact does not identify the pinned earth.wed.xml source");
  }
  const expectedCounts = expected.counts;
  if (JSON.stringify(payload.counts) !== JSON.stringify(expectedCounts)) {
    throw new Error(`WED ground counts drifted: ${JSON.stringify(payload.counts)} != ${JSON.stringify(expectedCounts)}`);
  }
  const collections = payload.placements ?? payload.features ?? payload.objects;
  if (!collections || typeof collections !== "object") {
    throw new Error("WED ground artifact is missing its preserved source objects");
  }
  return { counts: payload.counts, bytes: bytes.length, sha256: actualHash };
}

if (!wrapper.includes('from "./sourceKphxTerminal4.js"') || !wrapper.includes("installSourceKphxTerminal4Visual")) {
  throw new Error("Terminal 4 compatibility entry point does not delegate to exact KPHX source loader");
}
for (const forbidden of ["buildSourcePlacedTerminal4Jetways", "BoxGeometry", "CylinderGeometry", "source-atlas", "facadeInfill"] ) {
  if (wrapper.includes(forbidden)) throw new Error(`Reconstructed Terminal 4 authority survived in compatibility wrapper: ${forbidden}`);
}
for (const required of [
  "KPHX 1.75.1 earth.wed.xml WED_RampPosition 27855",
  "33.436530675",
  "-111.998921221",
  "Terminal4b.exact.glb",
  "Terminal4.exact.glb",
  "KPHX_1_75_1_WED_Source_Frame",
  "exact-user-drive-kphx-1.75.1",
]) {
  if (!loader.includes(required)) throw new Error(`Exact KPHX loader is missing source-authority token: ${required}`);
}

const [terminal4North, terminal4South, wedJetways, wedGround] = await Promise.all([
  verifyRuntime("terminal4North"),
  verifyRuntime("terminal4South"),
  verifyWedJetwayPlacements(),
  verifyWedGroundGeometry(),
]);
console.log(JSON.stringify({ authority: manifest.authority, results: [terminal4North, terminal4South], wedJetways, wedGround }, null, 2));
