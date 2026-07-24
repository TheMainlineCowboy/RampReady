import { createHash } from "node:crypto";
import { access, readFile } from "node:fs/promises";

const sourceUrl = new URL("../assets/aircraft/crj700-user.glb.br", import.meta.url);
const outputUrl = new URL("../public/models/crj700-user.glb", import.meta.url);
const metadataUrl = new URL("../public/models/crj700-user.asset.json", import.meta.url);
const materializerUrl = new URL("./materialize-authored-aircraft.mjs", import.meta.url);

await access(sourceUrl);
const source = await readFile(sourceUrl);
const sourceSha = createHash("sha256").update(source).digest("hex");
if (source.byteLength !== 939980) throw new Error(`Compressed authored aircraft size mismatch: ${source.byteLength}`);
if (sourceSha !== "f4124a1ca343b6aaeb961f6bfcd970d09de3945088b08b06052f333f3ac788ae") throw new Error("Compressed authored aircraft hash mismatch");

await import(materializerUrl.href + `?verify=${Date.now()}`);
const glb = await readFile(outputUrl);
const glbSha = createHash("sha256").update(glb).digest("hex");
if (glb.byteLength !== 1873128) throw new Error(`Authored aircraft GLB size mismatch: ${glb.byteLength}`);
if (glbSha !== "01383b502fa9a5e0aca3b5cc4a90b5ffe82d52160778bc309e2de73579b1056b") throw new Error("Authored aircraft GLB hash mismatch");
if (glb.toString("ascii", 0, 4) !== "glTF") throw new Error("Authored aircraft output is not GLB");

const metadata = JSON.parse(await readFile(metadataUrl, "utf8"));
if (metadata.materialCount !== 106 || metadata.textureCount !== 9 || metadata.preserveMaterials !== true) {
  throw new Error("Authored aircraft metadata does not preserve the verified materials and textures");
}

console.log("Authored aircraft materialization verification passed: exact compressed source, exact GLB, 106 materials and nine textures.");
