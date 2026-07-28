import { gunzipSync } from "node:zlib";
import part00 from "../src/environment/kphxExactA1/part00.js";
import part01 from "../src/environment/kphxExactA1/part01.js";
import part02 from "../src/environment/kphxExactA1/part02.js";
import part03 from "../src/environment/kphxExactA1/part03.js";
import part04 from "../src/environment/kphxExactA1/part04.js";
import part05 from "../src/environment/kphxExactA1/part05.js";

const encoded = [part00, part01, part02, part03, part04, part05].join("");
const compressed = Buffer.from(encoded, "base64");
const decoded = gunzipSync(compressed);
const payload = JSON.parse(decoded.toString("utf8"));

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

console.log("KPHX_EXACT_A1_PAYLOAD_BYTES", decoded.length);
console.log("KPHX_EXACT_A1_TOP_LEVEL_KEYS", Object.keys(payload).join(","));
console.log("KPHX_EXACT_A1_SCHEMA", JSON.stringify(describe(payload), null, 2));

for (const [key, value] of Object.entries(payload)) {
  if (Array.isArray(value)) console.log(`KPHX_EXACT_A1_ARRAY ${key} ${value.length}`);
}
