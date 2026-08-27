import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const outputPath = path.join(root, "public/models/standup-tug.glb");
const expected = Object.freeze({
  bytes: 9260016,
  sha256: "a14fbce34d5e72a814a75bdc9eb691054b6773453738b4f91fc5ce4e925310ff",
  source: "Aircraft_Standup_REVISED_V3.3mf",
});

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
if (!fs.existsSync(outputPath)) {
  throw new Error(`Exact stand-up V3 runtime is missing: ${path.relative(root, outputPath)}`);
}
const glb = fs.readFileSync(outputPath);
if (glb.length !== expected.bytes) {
  throw new Error(`Exact stand-up V3 runtime bytes ${glb.length} != ${expected.bytes}`);
}
if (sha256(glb) !== expected.sha256) throw new Error("Exact stand-up V3 runtime SHA-256 mismatch");
if (glb.subarray(0, 4).toString("ascii") !== "glTF") throw new Error("Exact stand-up V3 runtime is not GLB");
console.log(`Using exact supplied stand-up V3 runtime: ${path.relative(root, outputPath)} (${glb.length} bytes, ${expected.sha256})`);
