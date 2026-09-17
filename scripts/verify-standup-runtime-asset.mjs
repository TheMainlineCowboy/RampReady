import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();
execFileSync(process.execPath, [path.join(root, "scripts/materialize-standup-tug-runtime.mjs")], { stdio: "inherit" });

const manifest = JSON.parse(fs.readFileSync(path.join(root, "public/models/standup-tug/manifest.json"), "utf8"));
const glbPath = path.join(root, "public/models/standup-tug.glb");
const glb = fs.readFileSync(glbPath);
const sha256 = crypto.createHash("sha256").update(glb).digest("hex");
assert.equal(glb.length, manifest.runtime.glbBytes);
assert.equal(sha256, manifest.runtime.glbSha256);
assert.equal(glb.subarray(0, 4).toString("ascii"), "glTF");
assert.equal(glb.readUInt32LE(4), 2, "stand-up runtime must be GLB v2");

const jsonLength = glb.readUInt32LE(12);
const jsonType = glb.readUInt32LE(16);
assert.equal(jsonType, 0x4e4f534a, "first GLB chunk must be JSON");
const document = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8").replace(/[\u0000 ]+$/g, ""));
const rootNode = document.nodes.find((node) => node.name === "RampReady_StandupRevisedV3");
assert.ok(rootNode, "exact stand-up Revised V3 root missing");
assert.ok(document.nodes.some((node) => node.name === "AuthoredSteerPivot_C"), "exact center rear steering pivot missing");
assert.equal(document.meshes.length, 29, "stand-up runtime must retain all 29 source mesh objects");
assert.equal(document.images.length, 2, "stand-up runtime must retain both full source texture atlases");
assert.equal(document.materials.length, 7, "stand-up runtime material count changed");

const imageBytes = new Map(document.images.map((image) => [image.name, document.bufferViews[image.bufferView]?.byteLength]));
assert.equal(imageBytes.get("tug01.png"), 6706099, "full-resolution tug01.png source atlas changed");
assert.equal(imageBytes.get("tug_tow.png"), 312783, "full-resolution tug_tow.png source atlas changed");
for (const materialName of ["New_Black", "New_MetalDark", "New_Red", "dash_handle_blinn2", "dash_handle_blinn3", "Standup_tug_tow.png", "Standup_tug01.png"]) {
  assert.ok(document.materials.some((material) => material.name === materialName), `source material missing: ${materialName}`);
}

console.log(`Verified exact supplied stand-up Revised V3 runtime: ${document.meshes.length} source meshes, two full 2048x2048 texture atlases, center rear authored steering pivot, ${glb.length} bytes, source ${manifest.source.sha256}.`);
