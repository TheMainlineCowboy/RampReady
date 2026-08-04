import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { pathToFileURL } from "node:url";

await import("./materialize-exact-airport-jetway.mjs");

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
async function materializeTextPayload(sourcePath, targetPath, expectedSha256) {
  const encoded = (await readFile(path.resolve(sourcePath), "utf8")).trim();
  const compressed = Buffer.from(encoded, "base64");
  if (compressed.subarray(0, 6).toString("hex") !== "fd377a585a00") {
    throw new Error(`${sourcePath}: expected an XZ source payload`);
  }
  const result = spawnSync("xz", ["-dc"], { input: compressed, encoding: null, maxBuffer: 8 * 1024 * 1024 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${sourcePath}: XZ decode failed: ${String(result.stderr || "").trim()}`);
  const content = Buffer.from(result.stdout);
  const digest = sha256(content);
  if (digest !== expectedSha256) throw new Error(`${sourcePath}: decoded source identity mismatch ${digest}`);
  const absoluteTarget = path.resolve(targetPath);
  await mkdir(path.dirname(absoluteTarget), { recursive: true });
  await writeFile(absoluteTarget, content);
  return absoluteTarget;
}

await materializeTextPayload(
  ".jetway-runtime-staging/fleet.js.xz.b64",
  "src/environment/uploadedAirportJetwayFleet.js",
  "08e227c9962ffe1b4a12e5381345a4da916830cc99bd095988c12d58a354ae59",
);
const integrationPath = await materializeTextPayload(
  ".jetway-runtime-staging/integration.mjs.xz.b64",
  ".cache/exact-airport-jetway/integration.mjs",
  "64ec65a28fd542a92972f7d8618375cc6eab606a69de62c311251c2baa9b5e13",
);
await import(`${pathToFileURL(integrationPath).href}?sha=64ec65a28fd542a92972f7d8618375cc6eab606a69de62c311251c2baa9b5e13`);

const fleet = await readFile("src/environment/uploadedAirportJetwayFleet.js", "utf8");
for (const token of [
  'MODEL_URL = "models/airport-jetway/Airport_Jetway.glb"',
  "562e3144bd114cc41fad740c69e498d518797e198f301a9c1ea762657c33fed0",
  'MATERIAL_AUTHORITY = "original-embedded-glb-materials-uvs-and-seven-textures-unaltered-v2"',
  "new GLTFLoader().loadAsync(objectUrl)",
  "computeUploadedJetwayArticulation",
  "createModelSpaceA1Controller",
]) {
  if (!fleet.includes(token)) throw new Error(`Exact Airport_Jetway.glb runtime is missing ${token}`);
}
for (const forbidden of ["geometry.part", "DecompressionStream", "addProjectedUvs", "M1DGJETWAY", "splitTunnelCSourceDetail"]) {
  if (fleet.includes(forbidden)) throw new Error(`Exact Airport_Jetway.glb runtime still contains ${forbidden}`);
}
console.log("Prepared the exact user-supplied Airport_Jetway.glb runtime without replacing its meshes, UVs, materials, or textures.");
