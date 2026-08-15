import fs from "node:fs";
import * as THREE from "three";

const MODEL_PATH = "public/models/airport-jetway/Airport_Jetway.glb";
const PARTS = ["Rotunda", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"];
const LEGACY_TERMINAL_CENTER_Y_METERS = 4.35;
const CURRENT_FLEET_GROUND_CORRECTION_METERS = -0.06;

function parseGlb(bytes) {
  if (bytes.toString("ascii", 0, 4) !== "glTF") throw new Error("Airport_Jetway.glb is missing GLB magic");
  if (bytes.readUInt32LE(4) !== 2) throw new Error(`Unsupported GLB version ${bytes.readUInt32LE(4)}`);
  if (bytes.readUInt32LE(8) !== bytes.length) throw new Error("GLB byte length does not match its header");
  let cursor = 12;
  let json = null;
  while (cursor + 8 <= bytes.length) {
    const length = bytes.readUInt32LE(cursor);
    const type = bytes.readUInt32LE(cursor + 4);
    const payload = bytes.subarray(cursor + 8, cursor + 8 + length);
    if (type === 0x4e4f534a) json = JSON.parse(payload.toString("utf8").replace(/\u0000+$/g, "").trimEnd());
    cursor += 8 + length;
  }
  if (!json) throw new Error("Airport_Jetway.glb is missing its JSON chunk");
  return json;
}

function nodeLocalMatrix(node) {
  const matrix = new THREE.Matrix4();
  if (Array.isArray(node.matrix) && node.matrix.length === 16) return matrix.fromArray(node.matrix);
  const position = new THREE.Vector3(...(node.translation || [0, 0, 0]));
  const rotation = new THREE.Quaternion(...(node.rotation || [0, 0, 0, 1]));
  const scale = new THREE.Vector3(...(node.scale || [1, 1, 1]));
  return matrix.compose(position, rotation, scale);
}

function accessorBounds(json, accessorIndex) {
  const accessor = json.accessors?.[accessorIndex];
  if (!accessor || accessor.type !== "VEC3" || !Array.isArray(accessor.min) || !Array.isArray(accessor.max)) {
    throw new Error(`POSITION accessor ${accessorIndex} is missing exact VEC3 min/max bounds`);
  }
  return new THREE.Box3(
    new THREE.Vector3(accessor.min[0], accessor.min[1], accessor.min[2]),
    new THREE.Vector3(accessor.max[0], accessor.max[1], accessor.max[2]),
  );
}

const bytes = fs.readFileSync(MODEL_PATH);
const json = parseGlb(bytes);
const sceneIndex = Number.isInteger(json.scene) ? json.scene : 0;
const scene = json.scenes?.[sceneIndex];
if (!scene || !Array.isArray(scene.nodes)) throw new Error("Exact GLB has no active scene root nodes");

const overallRaw = new THREE.Box3();
const partRaw = new Map(PARTS.map((name) => [name, new THREE.Box3()]));
const meshRecords = [];

function traverse(nodeIndex, parentWorld, inheritedPart = null) {
  const node = json.nodes?.[nodeIndex];
  if (!node) throw new Error(`GLB node ${nodeIndex} is missing`);
  const local = nodeLocalMatrix(node);
  const world = new THREE.Matrix4().multiplyMatrices(parentWorld, local);
  const part = PARTS.includes(node.name) ? node.name : inheritedPart;

  if (Number.isInteger(node.mesh)) {
    const mesh = json.meshes?.[node.mesh];
    if (!mesh) throw new Error(`GLB node ${nodeIndex} references missing mesh ${node.mesh}`);
    for (const primitive of mesh.primitives || []) {
      const positionAccessor = primitive.attributes?.POSITION;
      if (!Number.isInteger(positionAccessor)) continue;
      const worldBounds = accessorBounds(json, positionAccessor).applyMatrix4(world);
      overallRaw.union(worldBounds);
      if (part) partRaw.get(part)?.union(worldBounds);
      meshRecords.push({ node: node.name || `node-${nodeIndex}`, mesh: mesh.name || `mesh-${node.mesh}`, part, positionAccessor });
    }
  }

  for (const child of node.children || []) traverse(child, world, part);
}

for (const root of scene.nodes) traverse(root, new THREE.Matrix4().identity());
if (overallRaw.isEmpty()) throw new Error("Exact GLB produced empty source geometry bounds");
for (const name of PARTS) {
  if (partRaw.get(name)?.isEmpty()) throw new Error(`Exact GLB produced no geometry bounds for authored part ${name}`);
}

const rawRotundaCenter = partRaw.get("Rotunda").getCenter(new THREE.Vector3());
const rawCabCenter = partRaw.get("Cab").getCenter(new THREE.Vector3());
const longitudinal = rawCabCenter.clone().sub(rawRotundaCenter).setY(0);
if (longitudinal.lengthSq() < 1) throw new Error("Exact jetway source longitudinal axis is invalid");
longitudinal.normalize();
const axisCorrectionRadians = -Math.atan2(longitudinal.x, longitudinal.z);

// Runtime rotates the scene around Y and then translates the complete exact
// source so its overall lowest authored point becomes Y=0. A Y-axis rotation
// cannot change any Y bound, so exact runtime-normalized vertical geometry is
// raw Y minus the complete source minimum Y. The later fleet correction then
// moves the whole installation down another 0.06 m.
const sourceMinY = overallRaw.min.y;
const normalizeY = (value) => value - sourceMinY;
const liveY = (value) => normalizeY(value) + CURRENT_FLEET_GROUND_CORRECTION_METERS;

const partReport = Object.fromEntries(PARTS.map((name) => {
  const box = partRaw.get(name);
  const center = box.getCenter(new THREE.Vector3());
  return [name, {
    minYRaw: box.min.y,
    maxYRaw: box.max.y,
    centerYRaw: center.y,
    minYNormalized: normalizeY(box.min.y),
    maxYNormalized: normalizeY(box.max.y),
    centerYNormalized: normalizeY(center.y),
    minYLiveAfterGroundCorrection: liveY(box.min.y),
    maxYLiveAfterGroundCorrection: liveY(box.max.y),
    centerYLiveAfterGroundCorrection: liveY(center.y),
    heightMeters: box.max.y - box.min.y,
  }];
}));

const report = {
  authority: "exact-airport-jetway-vertical-geometry-inspection-v2-binary-glb",
  modelPath: MODEL_PATH,
  meshPrimitiveCount: meshRecords.length,
  axisCorrectionRadians,
  overall: {
    minYRaw: overallRaw.min.y,
    maxYRaw: overallRaw.max.y,
    minYNormalized: 0,
    maxYNormalized: normalizeY(overallRaw.max.y),
    minYLiveAfterGroundCorrection: CURRENT_FLEET_GROUND_CORRECTION_METERS,
    maxYLiveAfterGroundCorrection: liveY(overallRaw.max.y),
  },
  legacyTerminalCenterYMeters: LEGACY_TERMINAL_CENTER_Y_METERS,
  currentFleetGroundCorrectionMeters: CURRENT_FLEET_GROUND_CORRECTION_METERS,
  exactRotundaCenterVsLegacyTerminalCenterMeters:
    partReport.Rotunda.centerYLiveAfterGroundCorrection - LEGACY_TERMINAL_CENTER_Y_METERS,
  exactRotundaFootAboveOverallGroundMeters:
    partReport.Rotunda.minYLiveAfterGroundCorrection - CURRENT_FLEET_GROUND_CORRECTION_METERS,
  parts: partReport,
};

console.log(`[RampReady] Exact jetway vertical geometry ${JSON.stringify(report)}`);
