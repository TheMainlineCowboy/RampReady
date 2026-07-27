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
const rootNode = document.nodes.find((node) => node.name === "RampReady_Standup_Tug");
assert.ok(rootNode, "normalized stand-up root missing");
for (const name of ["RR_CAPTURE_ANCHOR", "RR_OPERATOR_EYE", "RR_OPERATOR_LOOK", "RR_CRADLE_LIFT", "RR_STEER_LEFT", "RR_STEER_RIGHT"]) {
  assert.ok(document.nodes.some((node) => node.name === name), `${name} missing from stand-up runtime`);
}
assert.equal(document.meshes.length, 4, "stand-up runtime must retain the four authored Tug meshes");
assert.equal(document.images.length, 2, "stand-up web runtime should retain its two painted base-color textures");
assert.equal(document.extras?.rampReadyStandupTug?.sourceSha256, manifest.source.sha256, "runtime must retain exact uploaded-source identity");
assert.equal(rootNode.extras?.normalizedBoundsMeters?.max?.[2], manifest.profile.capturePlaneZ, "capture plane changed");
assert.equal(rootNode.extras?.normalizedBoundsMeters?.min?.[1], 0, "ground plane changed");

console.log(`Verified authored stand-up runtime: ${document.meshes.length} meshes, ${document.images.length} painted textures, ${glb.length} bytes, source ${manifest.source.sha256}.`);
