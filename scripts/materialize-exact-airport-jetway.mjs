import { createHash } from "node:crypto";

const url = "https://media.sketchfab.com/models/6067e855917e498abee3d98076293cc6/6def2ba4d78f442f81bed929cbf594d1/files/f77989814e5e46b0aabecd6a86743a91/file.binz";
const response = await fetch(url, {
  headers: { "User-Agent": "Mozilla/5.0 RampReady supplied-jetway geometry comparison" },
  redirect: "follow",
});
if (!response.ok) throw new Error(`Official geometry returned HTTP ${response.status}`);
const bytes = Buffer.from(await response.arrayBuffer());
const sha256 = createHash("sha256").update(bytes).digest("hex");
console.log(`JETWAY_PUBLIC_GEOMETRY_META ${JSON.stringify({ url, bytes: bytes.length, sha256, headerHex: bytes.subarray(0, 64).toString("hex") })}`);
console.log("JETWAY_PUBLIC_GEOMETRY_BASE64_BEGIN");
console.log(bytes.toString("base64"));
console.log("JETWAY_PUBLIC_GEOMETRY_BASE64_END");
throw new Error("JETWAY_PUBLIC_GEOMETRY_CAPTURE_COMPLETE");
