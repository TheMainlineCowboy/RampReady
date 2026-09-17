import { groundA1TunnelCVisibleSupportHardwareV3 as groundV5 } from "./a1TunnelCVisibleSupportGroundingV5.js";

const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_EXTENSION_METERS = 4.0;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
const LOWER_RIGID_FRACTION = 0.30;
const UPPER_RIGID_FRACTION = 0.76;
const VERTEX_KEY_SCALE = 10000;
const PHOTO_GROUND_NAMES = Object.freeze([
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);

function vertexKey(position, index) {
  return `${Math.round(position.getX(index) * VERTEX_KEY_SCALE)},${Math.round(position.getY(index) * VERTEX_KEY_SCALE)},${Math.round(position.getZ(index) * VERTEX_KEY_SCALE)}`;
}

function findTriangleComponents(position) {
  if (!position || position.count % 3 !== 0) return [];
  const triangleCount = position.count / 3;
  const parent = new Int32Array(triangleCount);
  for (let i = 0; i < triangleCount; i += 1) parent[i] = i;
  const find = (value) => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value];
      parent[value] = root;
      value = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const firstTriangleByVertex = new Map();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const key = vertexKey(position, triangle * 3 + corner);
      const first = firstTriangleByVertex.get(key);
      if (first === undefined) firstTriangleByVertex.set(key, triangle);
      else union(triangle, first);
    }
  }
  const byRoot = new Map();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const root = find(triangle);
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(triangle);
  }
  return [...byRoot.values()];
}

function resolveSceneRoot(object) {
  let root = object;
  while (root?.parent) root = root.parent;
  return root;
}

function resolveGround(root) {
  for (const name of PHOTO_GROUND_NAMES) {
    const found = root?.getObjectByName?.(name);
    if (found) return found;
  }
  throw new Error("A1 V6 primary residual scan cannot resolve rendered KPHX pavement");
}

function sampleGroundY(THREE, ground, x, z, highY) {
  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, highY, z), new THREE.Vector3(0, -1, 0));
  raycaster.near = 0;
  raycaster.far = 200;
  const hit = raycaster.intersectObject(ground, true)[0];
  if (!hit?.point || !Number.isFinite(hit.point.y)) {
    throw new Error(`A1 V6 primary residual scan found no pavement at x=${x.toFixed(3)} z=${z.toFixed(3)}`);
  }
  return hit.point.y;
}

function objectCenter(THREE, object) {
  return object ? new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()) : null;
}

function measure(THREE, mesh, position, triangles, rotunda, cab) {
  const box = new THREE.Box3();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const triangle of triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      local.fromBufferAttribute(position, triangle * 3 + corner);
      box.expandByPoint(world.copy(local).applyMatrix4(mesh.matrixWorld));
    }
  }
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const horizontalSpan = Math.max(size.x, size.z);
  const bridge = cab && rotunda ? cab.clone().sub(rotunda).setY(0) : null;
  let alongRatio = NaN;
  let lateralDistance = NaN;
  if (bridge && bridge.lengthSq() > 1) {
    const fromRotunda = center.clone().sub(rotunda).setY(0);
    alongRatio = fromRotunda.dot(bridge) / bridge.lengthSq();
    const projected = rotunda.clone().addScaledVector(bridge, alongRatio);
    lateralDistance = Math.hypot(center.x - projected.x, center.z - projected.z);
  }
  return { triangles, box, center, size, horizontalSpan, verticalAspect: size.y / Math.max(horizontalSpan, 0.01), alongRatio, lateralDistance };
}

function looksLikeVisiblePrimaryRod(entry) {
  return Number.isFinite(entry.alongRatio)
    && entry.alongRatio >= 0.35
    && entry.alongRatio <= 1.12
    && Number.isFinite(entry.lateralDistance)
    && entry.lateralDistance <= 6.0
    && entry.triangles.length >= 2
    && entry.triangles.length <= 2200
    && entry.size.y >= 0.18
    && entry.size.y <= 4.8
    && entry.horizontalSpan >= 0.015
    && entry.horizontalSpan <= 1.65
    && entry.verticalAspect >= 1.0;
}

function uniqueVertexIndices(triangles) {
  const indices = new Set();
  for (const triangle of triangles) {
    indices.add(triangle * 3);
    indices.add(triangle * 3 + 1);
    indices.add(triangle * 3 + 2);
  }
  return [...indices];
}

function telescope(THREE, mesh, position, entry, rampY) {
  const beforeMinY = entry.box.min.y;
  const beforeMaxY = entry.box.max.y;
  const height = beforeMaxY - beforeMinY;
  const extension = beforeMinY - rampY;
  if (!(height > 0.08) || !(extension > MAX_FINAL_CLEARANCE_METERS) || extension > MAX_EXTENSION_METERS) {
    throw new Error(`A1 V6 residual primary rod cannot telescope: height=${height} extension=${extension}`);
  }
  const inverseWorld = mesh.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const index of uniqueVertexIndices(entry.triangles)) {
    local.fromBufferAttribute(position, index);
    world.copy(local).applyMatrix4(mesh.matrixWorld);
    const fraction = Math.max(0, Math.min(1, (world.y - beforeMinY) / height));
    let downward = 0;
    if (fraction <= LOWER_RIGID_FRACTION) downward = extension;
    else if (fraction < UPPER_RIGID_FRACTION) {
      const blend = (fraction - LOWER_RIGID_FRACTION) / (UPPER_RIGID_FRACTION - LOWER_RIGID_FRACTION);
      downward = extension * (1 - blend);
    }
    world.y -= downward;
    local.copy(world).applyMatrix4(inverseWorld);
    position.setXYZ(index, local.x, local.y, local.z);
  }
  return { beforeTopY: beforeMaxY, extension };
}

export function groundA1TunnelCVisibleSupportHardwareV3(THREE, model) {
  const base = groundV5(THREE, model);
  const mesh = model?.getObjectByName?.("Tunnel_C_Jetway_0");
  if (!mesh?.isMesh || !mesh.geometry?.getAttribute?.("position")) throw new Error("A1 V6 cannot resolve Tunnel_C_Jetway_0 after V5");
  const sceneRoot = resolveSceneRoot(model);
  const ground = resolveGround(sceneRoot);
  sceneRoot.updateWorldMatrix?.(true, true);
  ground.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);
  mesh.updateWorldMatrix(true, false);
  const rotunda = objectCenter(THREE, model.getObjectByName("Rotunda"));
  const cab = objectCenter(THREE, model.getObjectByName("Cab"));
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const measurements = findTriangleComponents(position).map((triangles) => measure(THREE, mesh, position, triangles, rotunda, cab));
  const suspended = [];
  for (const entry of measurements) {
    if (!looksLikeVisiblePrimaryRod(entry)) continue;
    entry.rampY = sampleGroundY(THREE, ground, entry.center.x, entry.center.z, entry.box.max.y + 40);
    entry.clearance = entry.box.min.y - entry.rampY;
    if (entry.clearance > MAX_FINAL_CLEARANCE_METERS && entry.clearance <= MAX_EXTENSION_METERS) suspended.push(entry);
  }
  if (!suspended.length) throw new Error("A1 V6 found no residual suspended primary Tunnel-C rod surfaces after V5");
  mesh.geometry = geometry;
  const corrected = [];
  for (const entry of suspended) corrected.push({ entry, ...telescope(THREE, mesh, position, entry, entry.rampY) });
  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);

  let maximumFinalClearanceMeters = base.maximumFinalClearanceMeters;
  let maximumTopMountDriftMeters = base.maximumTopMountDriftMeters;
  for (const correction of corrected) {
    const measured = measure(THREE, mesh, position, correction.entry.triangles, rotunda, cab);
    const rampY = sampleGroundY(THREE, ground, measured.center.x, measured.center.z, measured.box.max.y + 40);
    const clearance = measured.box.min.y - rampY;
    maximumFinalClearanceMeters = Math.max(maximumFinalClearanceMeters, Math.abs(clearance));
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, Math.abs(measured.box.max.y - correction.beforeTopY));
  }
  let remaining = 0;
  for (const entry of findTriangleComponents(position).map((triangles) => measure(THREE, mesh, position, triangles, rotunda, cab))) {
    if (!looksLikeVisiblePrimaryRod(entry)) continue;
    const rampY = sampleGroundY(THREE, ground, entry.center.x, entry.center.z, entry.box.max.y + 40);
    const clearance = entry.box.min.y - rampY;
    if (clearance > MAX_FINAL_CLEARANCE_METERS && clearance <= MAX_EXTENSION_METERS) remaining += 1;
  }
  if (remaining) throw new Error(`A1 V6 still finds ${remaining} suspended residual primary rod surfaces`);
  if (maximumFinalClearanceMeters > MAX_FINAL_CLEARANCE_METERS) throw new Error(`A1 V6 final clearance=${maximumFinalClearanceMeters}`);
  if (maximumTopMountDriftMeters > MAX_TOP_MOUNT_DRIFT_METERS) throw new Error(`A1 V6 top mount drift=${maximumTopMountDriftMeters}`);

  const extraCount = corrected.length;
  const extraTriangles = corrected.reduce((sum, item) => sum + item.entry.triangles.length, 0);
  const secondaryMeshGroundedCount = base.secondaryMeshGroundedCount + extraCount;
  const secondaryMeshGroundedTriangleCount = base.secondaryMeshGroundedTriangleCount + extraTriangles;
  const correctedSupportSetCount = base.groundedComponentCount + secondaryMeshGroundedCount;
  return Object.freeze({
    ...base,
    secondaryMeshGroundedCount,
    secondaryMeshGroundedTriangleCount,
    spatialRodClusterCount: base.spatialRodClusterCount + extraCount,
    spatialRodTriangleCount: base.spatialRodTriangleCount + extraTriangles,
    spatialRodVertexCount: base.spatialRodVertexCount + extraTriangles * 3,
    correctedSupportSetCount,
    visibleLoadLegCount: correctedSupportSetCount,
    remainingSuspendedSupportCount: 0,
    maximumFinalClearanceMeters,
    maximumTopMountDriftMeters,
    maximumExtensionMeters: Math.max(base.maximumExtensionMeters, ...corrected.map((item) => item.extension)),
    rampReferenceComponentCount: correctedSupportSetCount,
    v6PrimaryResidualRodCorrectionCount: extraCount,
    v6PrimaryResidualRodTriangleCount: extraTriangles,
  });
}

export { A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY, A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY } from "./a1TunnelCVisibleSupportGroundingV5.js";
