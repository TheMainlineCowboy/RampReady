#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const manifestUrl = new URL("../assets/kphx-source/exact-line-definitions.json", import.meta.url);
const manifest = JSON.parse(await readFile(manifestUrl, "utf8"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

if (manifest.schemaVersion !== 1 || manifest.authority !== "user-drive-kphx-1.75.1-exact-line-definitions-v1") {
  throw new Error("Exact KPHX line-definition manifest has wrong schema/source authority");
}
if (!Array.isArray(manifest.definitions) || manifest.definitions.length !== 4) {
  throw new Error(`Expected 4 exact KPHX line definitions, got ${manifest.definitions?.length ?? 0}`);
}

const expectedResources = new Set(["Lines/Taxiline.lin", "Lines/edge.lin", "Lines/edge_gray.lin", "Lines/Road.lin"]);
const verified = [];
for (const entry of manifest.definitions) {
  if (!expectedResources.delete(entry.resource)) throw new Error(`Unexpected/duplicate line resource ${entry.resource}`);
  const bytes = await readFile(new URL(`../${entry.path}`, import.meta.url));
  const actualHash = sha256(bytes);
  if (bytes.length !== entry.bytes || actualHash !== entry.sha256) {
    throw new Error(`${entry.resource}: exact byte identity mismatch ${bytes.length}/${actualHash}; expected ${entry.bytes}/${entry.sha256}`);
  }
  const text = bytes.toString("utf8");
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (lines[0] !== "A" || lines[1] !== "850" || lines[2] !== "LINE_PAINT") throw new Error(`${entry.resource}: not the pinned X-Plane 850 LINE_PAINT definition`);
  const directive = (name) => lines.find((line) => line.startsWith(`${name} `));
  const texture = directive("TEXTURE")?.slice("TEXTURE ".length);
  const layerGroup = directive("LAYER_GROUP")?.slice("LAYER_GROUP ".length);
  const lod = Number(directive("LOD")?.slice(4));
  const texWidth = Number(directive("TEX_WIDTH")?.slice(10));
  const scale = directive("SCALE")?.slice(6).trim().split(/\s+/).map(Number);
  const sOffset = directive("S_OFFSET")?.slice(9).trim().split(/\s+/).map(Number);
  const mirror = lines.includes("MIRROR");
  if (texture !== entry.textureDirective) throw new Error(`${entry.resource}: texture directive drifted to ${texture}`);
  if (layerGroup !== entry.layerGroup) throw new Error(`${entry.resource}: layer group drifted to ${layerGroup}`);
  if (lod !== entry.lod || texWidth !== entry.texWidth) throw new Error(`${entry.resource}: LOD/TEX_WIDTH drifted`);
  if (JSON.stringify(scale) !== JSON.stringify(entry.scale) || JSON.stringify(sOffset) !== JSON.stringify(entry.sOffset)) throw new Error(`${entry.resource}: SCALE/S_OFFSET drifted`);
  if (mirror !== entry.mirror) throw new Error(`${entry.resource}: MIRROR directive drifted`);
  if (entry.textureSource) {
    const source = entry.textureSource;
    if (!source.driveFileId || !Number.isInteger(source.bytes) || !/^[0-9a-f]{64}$/.test(source.sha256)) throw new Error(`${entry.resource}: texture source is not fully pinned`);
    if (source.ddsFormat !== "DXT1" || !(source.width > 0) || !(source.height > 0)) throw new Error(`${entry.resource}: texture source decode contract is incomplete`);
    if (source.materializationStatus !== "pinned-drive-binary-pending-repository-transfer") throw new Error(`${entry.resource}: texture materialization status drifted`);
  } else if (entry.resource === "Lines/Taxiline.lin") {
    if (entry.textureStatus !== "unresolved-source-dependency" || !entry.textureBlocker?.includes("no substitute")) throw new Error("Taxiline unresolved texture dependency must remain fail-closed");
  } else {
    throw new Error(`${entry.resource}: missing exact texture source identity`);
  }
  verified.push({ resource: entry.resource, bytes: bytes.length, sha256: actualHash, texture, layerGroup, lod, texWidth, scale, sOffset, mirror, textureSource: entry.textureSource ?? null, textureStatus: entry.textureStatus ?? "pinned" });
}
if (expectedResources.size) throw new Error(`Missing exact line resources: ${[...expectedResources].join(", ")}`);
if (manifest.policy?.visibleMaterialRule !== "fail-closed until the exact referenced texture source is materialized; do not substitute or procedurally redraw") {
  throw new Error("Exact KPHX line material policy was weakened");
}

console.log(JSON.stringify({ authority: manifest.authority, exactLineDefinitionCount: verified.length, verified }, null, 2));
