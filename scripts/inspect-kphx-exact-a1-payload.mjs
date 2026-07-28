import { constants, gunzipSync } from "node:zlib";
import part00 from "../src/environment/kphxExactA1/part00.js";
import part01 from "../src/environment/kphxExactA1/part01.js";
import part02 from "../src/environment/kphxExactA1/part02.js";
import part03 from "../src/environment/kphxExactA1/part03.js";
import part04 from "../src/environment/kphxExactA1/part04.js";
import part05 from "../src/environment/kphxExactA1/part05.js";

const parts = [part00, part01, part02, part03, part04, part05];
const encoded = parts.join("");
const compressed = Buffer.from(encoded, "base64");

console.log("KPHX_EXACT_A1_PART_LENGTHS", parts.map((part) => part.length).join(","));
console.log("KPHX_EXACT_A1_BASE64_CHARS", encoded.length);
console.log("KPHX_EXACT_A1_COMPRESSED_BYTES", compressed.length);
console.log("KPHX_EXACT_A1_GZIP_HEADER", compressed.subarray(0, 10).toString("hex"));
console.log("KPHX_EXACT_A1_GZIP_TRAILER", compressed.subarray(-8).toString("hex"));

function describe(value, depth = 0) {
  if (depth > 3) return typeof value;
  if (Array.isArray(value)) {
    const sample = value.length ? describe(value[0], depth + 1) : "empty";
    return { type: "array", length: value.length, sample };
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([key, child]) => [key, describe(child, depth + 1)]));
  }
  return { type: typeof value, value };
}

try {
  const decoded = gunzipSync(compressed);
  const payload = JSON.parse(decoded.toString("utf8"));
  console.log("KPHX_EXACT_A1_PAYLOAD_STATUS complete");
  console.log("KPHX_EXACT_A1_PAYLOAD_BYTES", decoded.length);
  console.log("KPHX_EXACT_A1_TOP_LEVEL_KEYS", Object.keys(payload).join(","));
  console.log("KPHX_EXACT_A1_SCHEMA", JSON.stringify(describe(payload), null, 2));
  for (const [key, value] of Object.entries(payload)) {
    if (Array.isArray(value)) console.log(`KPHX_EXACT_A1_ARRAY ${key} ${value.length}`);
  }
} catch (error) {
  console.log("KPHX_EXACT_A1_PAYLOAD_STATUS incomplete");
  console.log("KPHX_EXACT_A1_PAYLOAD_ERROR", error.message);
  console.log("KPHX_EXACT_A1_REPAIR_REQUIRED true");
  try {
    const partial = gunzipSync(compressed, { finishFlush: constants.Z_SYNC_FLUSH }).toString("utf8");
    console.log("KPHX_EXACT_A1_PARTIAL_BYTES", Buffer.byteLength(partial));
    console.log("KPHX_EXACT_A1_PARTIAL_PREFIX", JSON.stringify(partial.slice(0, 1200)));
    console.log("KPHX_EXACT_A1_PARTIAL_SUFFIX", JSON.stringify(partial.slice(-2400)));
    for (const key of ["meshes", "materials", "lines", "paintedLines", "projectedMeshes", "textures", "manifest", "counts"]) {
      const match = partial.match(new RegExp(`\\"${key}\\"\\s*:`));
      if (match) console.log("KPHX_EXACT_A1_PARTIAL_KEY", key, match.index);
    }
  } catch (partialError) {
    console.log("KPHX_EXACT_A1_PARTIAL_ERROR", partialError.message);
  }
}
