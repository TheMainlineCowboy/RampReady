import fs from "node:fs";

const glbPath = "public/models/lektro-88/LEKTRO_AP88_TVO914.glb";
const outPath = "reports/lektro-r187a-node-inspection.json";
const buffer = fs.readFileSync(glbPath);
if (buffer.toString("utf8", 0, 4) !== "glTF") throw new Error("Not a GLB");
const version = buffer.readUInt32LE(4);
const declaredLength = buffer.readUInt32LE(8);
let offset = 12;
let json = null;
while (offset + 8 <= buffer.length) {
  const chunkLength = buffer.readUInt32LE(offset);
  const chunkType = buffer.readUInt32LE(offset + 4);
  const start = offset + 8;
  const end = start + chunkLength;
  if (chunkType === 0x4E4F534A) {
    json = JSON.parse(buffer.toString("utf8", start, end).replace(/\u0000+$/g, "").trim());
    break;
  }
  offset = end;
}
if (!json) throw new Error("GLB JSON chunk missing");

const parents = new Map();
(json.nodes || []).forEach((node, index) => {
  for (const child of node.children || []) parents.set(child, index);
});

const nodes = (json.nodes || []).map((node, index) => ({
  index,
  name: node.name || "",
  mesh: Number.isInteger(node.mesh) ? node.mesh : null,
  parent: parents.has(index) ? parents.get(index) : null,
  children: node.children || [],
  translation: node.translation || [0,0,0],
  rotation: node.rotation || [0,0,0,1],
  scale: node.scale || [1,1,1],
}));

const candidateRx = /(wheel|tire|tyre|rim|hub|axle|steer|caster)/i;
const candidates = nodes.filter((node) => candidateRx.test(node.name));

const meshInfo = (json.meshes || []).map((mesh, meshIndex) => ({
  meshIndex,
  name: mesh.name || "",
  primitiveCount: (mesh.primitives || []).length,
  positionAccessorBounds: (mesh.primitives || []).map((primitive) => {
    const accessorIndex = primitive.attributes?.POSITION;
    const accessor = Number.isInteger(accessorIndex) ? json.accessors?.[accessorIndex] : null;
    return accessor ? { accessorIndex, min: accessor.min || null, max: accessor.max || null, count: accessor.count || null } : null;
  }),
}));

for (const node of candidates) {
  node.meshInfo = Number.isInteger(node.mesh) ? meshInfo[node.mesh] : null;
  const chain = [];
  let current = node.parent;
  while (current !== null && current !== undefined) {
    chain.push({ index: current, name: nodes[current]?.name || "" });
    current = parents.has(current) ? parents.get(current) : null;
  }
  node.parentChain = chain;
}

const report = {
  schemaVersion: 1,
  glbPath,
  bytes: buffer.length,
  version,
  declaredLength,
  nodeCount: nodes.length,
  meshCount: (json.meshes || []).length,
  animationNames: (json.animations || []).map((a) => a.name || ""),
  candidates,
  nodes,
};
fs.mkdirSync("reports", { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({
  nodeCount: report.nodeCount,
  meshCount: report.meshCount,
  animationNames: report.animationNames,
  candidates: candidates.map((n)=>({index:n.index,name:n.name,mesh:n.mesh,parent:n.parent,parentChain:n.parentChain}))
}, null, 2));
