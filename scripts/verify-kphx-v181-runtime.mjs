import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

const manifest = JSON.parse(await readFile("public/models/kphx-v181/manifest.json", "utf8"));
const glb = await readFile(manifest.runtime.outputPath);
const digest = createHash("sha256").update(glb).digest("hex");
if (glb.length !== manifest.runtime.glbBytes || digest !== manifest.runtime.glbSha256) throw new Error("KPHX GLB identity mismatch");
if (glb.subarray(0, 4).toString("ascii") !== "glTF" || glb.readUInt32LE(4) !== 2) throw new Error("KPHX GLB v2 header missing");
const jsonLength = glb.readUInt32LE(12);
const json = JSON.parse(glb.subarray(20, 20 + jsonLength).toString("utf8").trim());
const root = json.nodes?.find((node) => node.name === "PHX_KPHX_v181_AuthoredAirport");
if (!root || root.extras?.anchorGate !== "A1") throw new Error("KPHX A1 root metadata missing");
if (root.extras?.jetwayCount !== 112 || root.extras?.parkingCount !== 186) throw new Error("KPHX gate metadata mismatch");
if (!json.extensionsUsed?.includes("KHR_mesh_quantization")) throw new Error("KPHX mesh quantization missing");
if (json.meshes?.[0]?.primitives?.length !== 14) throw new Error("KPHX primitive count mismatch");
if (!json.images?.some((image) => image.mimeType === "image/png")) throw new Error("KPHX texture atlas missing");
if (manifest.counts.aprons !== 927 || manifest.counts.paintedLines !== 1184 || manifest.counts.jetways !== 112) throw new Error("KPHX source counts drifted");
if (!manifest.b15?.some((gate) => gate.gate === "B15L") || !manifest.b15?.some((gate) => gate.gate === "B15M")) throw new Error("KPHX B15 anchors missing");
console.log(`Verified KPHX v1.8.1: ${manifest.counts.triangles} triangles and ${manifest.counts.jetways} jetways.`);
