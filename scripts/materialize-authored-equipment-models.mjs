import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const expected = Object.freeze({
  "lektro-88": Object.freeze({
    runtimePath: "public/models/lektro-88.glb",
    bytes: 4822692,
    sha256: "34ba7384dfae8610ac51c1a54d4959bea9626b4a970bf8cbd21c340f460cb4a8",
    source: "user-supplied KIRI Engine 3DModel.obj + 3DModel.mtl + 3DModel.jpg",
  }),
  "manager-kubota": Object.freeze({
    runtimePath: "public/models/manager-kubota.glb",
    bytes: 23988388,
    sha256: "726fdcb3511e6d52990da11118be4ca8a8b73c5d5c8f5bde4f934131e3c31b7d",
    source: "RTVManagersKubota.3mf",
  }),
});

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");
for (const [id, spec] of Object.entries(expected)) {
  const outputPath = path.join(root, spec.runtimePath);
  if (!fs.existsSync(outputPath)) throw new Error(`${id}: exact authored runtime is missing: ${spec.runtimePath}`);
  const glb = fs.readFileSync(outputPath);
  if (glb.length !== spec.bytes) throw new Error(`${id}: exact runtime bytes ${glb.length} != ${spec.bytes}`);
  if (sha256(glb) !== spec.sha256) throw new Error(`${id}: exact runtime SHA-256 mismatch`);
  if (glb.subarray(0, 4).toString("ascii") !== "glTF") throw new Error(`${id}: exact runtime is not GLB`);
  console.log(`Using exact supplied ${id}: ${spec.runtimePath} (${glb.length} bytes, ${spec.sha256}) from ${spec.source}`);
}
