import { createHash } from "node:crypto";

const base = "https://media.sketchfab.com/models/6067e855917e498abee3d98076293cc6/6def2ba4d78f442f81bed929cbf594d1/files/f77989814e5e46b0aabecd6a86743a91";
const candidates = ["model_file.binz", "model_file_wireframe.binz"];
for (const name of candidates) {
  const url = `${base}/${name}`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 RampReady supplied-jetway geometry comparison" },
    redirect: "follow",
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  console.log(`JETWAY_PUBLIC_BUFFER_META ${JSON.stringify({ name, status: response.status, bytes: bytes.length, sha256, headerHex: bytes.subarray(0, 64).toString("hex") })}`);
  if (response.ok && name === "model_file.binz") {
    console.log("JETWAY_PUBLIC_MODEL_BASE64_BEGIN");
    console.log(bytes.toString("base64"));
    console.log("JETWAY_PUBLIC_MODEL_BASE64_END");
  }
}
throw new Error("JETWAY_PUBLIC_MODEL_CAPTURE_COMPLETE");
