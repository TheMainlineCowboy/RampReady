import { gunzipSync } from "node:zlib";
import part00 from "../src/environment/kphxExactA1/part00.js";
import part01 from "../src/environment/kphxExactA1/part01.js";
import part02 from "../src/environment/kphxExactA1/part02.js";
import part03 from "../src/environment/kphxExactA1/part03.js";
import part04 from "../src/environment/kphxExactA1/part04.js";
import part05 from "../src/environment/kphxExactA1/part05.js";
import part06 from "../src/environment/kphxExactA1/part06.js";

const parts = [part00, part01, part02, part03, part04, part05, part06];
const encoded = parts.join("");
if (encoded.length !== 61_652) throw new Error(`Exact A1 Base64 length ${encoded.length} != 61652`);
if (encoded.length % 4 !== 0) throw new Error("Exact A1 Base64 payload is not four-byte aligned");

const compressed = Buffer.from(encoded, "base64");
if (compressed.length !== 46_239) throw new Error(`Exact A1 gzip bytes ${compressed.length} != 46239`);
const decoded = gunzipSync(compressed);
if (decoded.length !== 154_290) throw new Error(`Exact A1 JSON bytes ${decoded.length} != 154290`);
const payload = JSON.parse(decoded.toString("utf8"));

if (payload.schemaVersion !== 2) throw new Error(`Exact A1 schema ${payload.schemaVersion} != 2`);
if (payload.archiveSha256 !== "d118f396081b5faabc81daf3786a0c56e3c0f7b4c9b7d6cbe7ce13c10efe05bc") {
  throw new Error("Exact A1 archive SHA-256 mismatch");
}
if (payload.bglSha256 !== "1ea4978b5a89ecf5efebe522c9837e9d89de6f7a45dc4e99bfe161a8343ed2a2") {
  throw new Error("Exact A1 airport BGL SHA-256 mismatch");
}
if (payload.projectedMeshes?.length !== 73) throw new Error(`Exact A1 projected meshes ${payload.projectedMeshes?.length} != 73`);
if (payload.paintedLines?.length !== 214) throw new Error(`Exact A1 painted lines ${payload.paintedLines?.length} != 214`);
if (payload.materials?.length !== 7) throw new Error(`Exact A1 source materials ${payload.materials?.length} != 7`);

console.log(JSON.stringify({
  status: "verified-exact-supplied-source",
  parts: parts.map((part) => part.length),
  base64Chars: encoded.length,
  gzipBytes: compressed.length,
  jsonBytes: decoded.length,
  archiveSha256: payload.archiveSha256,
  bglSha256: payload.bglSha256,
  projectedMeshes: payload.projectedMeshes.length,
  paintedLines: payload.paintedLines.length,
  sourceMaterials: payload.materials.length,
}, null, 2));
