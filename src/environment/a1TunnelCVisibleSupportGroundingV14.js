import { groundA1TunnelCVisibleSupportHardwareV3 as groundV13 } from "./a1TunnelCVisibleSupportGroundingV13.js";

const PHOTO_GROUND_NAMES = Object.freeze([
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);
const ROD_COLUMNS = Object.freeze([
  Object.freeze({ minX: -12.405, maxX: -12.315, minZ: 10.125, maxZ: 10.215 }),
  Object.freeze({ minX: -11.855, maxX: -11.765, minZ: 9.975, maxZ: 10.075 }),
]);
const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_EXTENSION_METERS = 0.35;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
const KEY_SCALE = 10000;

function sceneRoot(object) {
  let root = object;
  while (root?.parent) root = root.parent;
  return root;
}

function resolveGround(root) {
  for (const name of PHOTO_GROUND_NAMES) {
    const ground = root?.getObjectByName?.(name);
    if (ground) return ground;
  }
  throw new Error("A1 V14 cannot resolve rendered KPHX pavement");
}

function sampleGroundY(THREE, ground, x, z, highY) {
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(x, highY + 40, z),
    new THREE.Vector3(0, -1, 0),
  );
  raycaster.far = 200;
  const hit = raycaster.intersectObject(ground, true)[0];
  if (!hit?.point || !Number.isFinite(hit.point.y)) {
    throw new Error(`A1 V14 no pavement hit under x=${x.toFixed(3)} z=${z.toFixed(3)}`);
  }
  return hit.point.y;
}

function vertexKey(vector) {
  return `${Math.round(vector.x * KEY_SCALE)},${Math.round(vector.y * KEY_SCALE)},${Math.round(vector.z * KEY_SCALE)}`;
}

function collectColumnTriangles(THREE, mesh, position, column, ground, columnIndex) {
  const selected = [];
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  const centerX = (column.minX + column.maxX) * 0.5;
  const centerZ = (column.minZ + column.maxZ) * 0.5;
  const rampY = sampleGroundY(THREE, ground, centerX, centerZ, 2);
  for (let triangle = 0; triangle < position.count / 3; triangle += 1) {
    const points = [];
    let insideXZ = true;
    for (let corner = 0; corner < 3; corner += 1) {
      local.fromBufferAttribute(position, triangle * 3 + corner);
      const point = world.copy(local).applyMatrix4(mesh.matrixWorld).clone();
      points.push(point);
      if (point.x < column.minX || point.x > column.maxX || point.z < column.minZ || point.z > column.maxZ) {
        insideXZ = false;
      }
    }
    if (!insideXZ) continue;
    const box = new THREE.Box3().setFromPoints(points);
    if (box.max.y < rampY - 0.05 || box.min.y > rampY + 1.30) continue;
    selected.push({
      triangle,
      keys: points.map(vertexKey),
      box,
      columnIndex,
    });
  }
  return selected;
}

function clusterSelected(selected) {
  const parent = new Int32Array(selected.length);
  for (let i = 0; i < selected.length; i += 1) parent[i] = i;
  const find = (input) => {
    let root = input;
    while (parent[root] !== root) root = parent[root];
    let cursor = input;
    while (parent[cursor] !== cursor) {
      const next = parent[cursor];
      parent[cursor] = root;
      cursor = next;
    }
    return root;
  };
  const union = (left, right) => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent[b] = a;
  };
  const seen = new Map();
  for (let i = 0; i < selected.length; i += 1) {
    for (const key of selected[i].keys) {
      const prior = seen.get(key);
      if (prior === undefined) seen.set(key, i);
      else union(i, prior);
    }
  }
  const groups = new Map();
  for (let i = 0; i < selected.length; i += 1) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(selected[i]);
  }
  return [...groups.values()];
}

function groupBounds(THREE, group) {
  const box = new THREE.Box3();
  for (const item of group) box.union(item.box);
  return box;
}

function isRodGroup(group, box, clearance) {
  const sx = box.max.x - box.min.x;
  const sy = box.max.y - box.min.y;
  const sz = box.max.z - box.min.z;
  return clearance > MAX_FINAL_CLEARANCE_METERS
    && clearance <= MAX_EXTENSION_METERS
    && sx <= 0.09
    && sz <= 0.09
    && sy >= 0.30
    && sy <= 1.15
    && group.length >= 2
    && group.length <= 48;
}

function stretchGroup(THREE, mesh, position, group, rampY) {
  const before = groupBounds(THREE, group);
  const minY = before.min.y;
  const maxY = before.max.y;
  const height = maxY - minY;
  const extension = minY - rampY;
  if (!(height > 0.03) || !(extension > MAX_FINAL_CLEARANCE_METERS) || extension > MAX_EXTENSION_METERS) {
    throw new Error(`A1 V14 rod extension out of range ${extension}`);
  }
  const inverseWorld = mesh.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  const indices = new Set();
  for (const item of group) {
    for (let corner = 0; corner < 3; corner += 1) indices.add(item.triangle * 3 + corner);
  }
  for (const index of indices) {
    local.fromBufferAttribute(position, index);
    world.copy(local).applyMatrix4(mesh.matrixWorld);
    const fraction = Math.max(0, Math.min(1, (world.y - minY) / height));
    world.y = rampY + fraction * (maxY - rampY);
    local.copy(world).applyMatrix4(inverseWorld);
    position.setXYZ(index, local.x, local.y, local.z);
  }
  return { beforeTopY: maxY, extension, indices: [...indices] };
}

function measureIndices(THREE, mesh, position, indices) {
  const box = new THREE.Box3();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const index of indices) {
    local.fromBufferAttribute(position, index);
    box.expandByPoint(world.copy(local).applyMatrix4(mesh.matrixWorld));
  }
  return box;
}

export function groundA1TunnelCVisibleSupportHardwareV3(THREE, model) {
  const base = groundV13(THREE, model);
  const root = sceneRoot(model);
  const ground = resolveGround(root);
  const mesh = model?.getObjectByName?.("Tunnel_B_Jetway_0");
  if (!mesh?.isMesh || !mesh.geometry?.getAttribute?.("position")) {
    throw new Error("A1 V14 cannot resolve Tunnel_B_Jetway_0");
  }
  root.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);
  mesh.updateWorldMatrix(true, false);

  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.geometry = geometry;
  const position = geometry.getAttribute("position");
  const corrections = [];

  for (let columnIndex = 0; columnIndex < ROD_COLUMNS.length; columnIndex += 1) {
    const selected = collectColumnTriangles(THREE, mesh, position, ROD_COLUMNS[columnIndex], ground, columnIndex);
    for (const group of clusterSelected(selected)) {
      const box = groupBounds(THREE, group);
      const center = box.getCenter(new THREE.Vector3());
      const rampY = sampleGroundY(THREE, ground, center.x, center.z, box.max.y);
      const clearance = box.min.y - rampY;
      if (!isRodGroup(group, box, clearance)) continue;
      const correction = stretchGroup(THREE, mesh, position, group, rampY);
      corrections.push({ columnIndex, group, rampY, ...correction });
    }
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);

  let maximumFinalClearanceMeters = base.maximumFinalClearanceMeters;
  let maximumTopMountDriftMeters = base.maximumTopMountDriftMeters;
  for (const correction of corrections) {
    const box = measureIndices(THREE, mesh, position, correction.indices);
    const center = box.getCenter(new THREE.Vector3());
    const rampY = sampleGroundY(THREE, ground, center.x, center.z, box.max.y);
    const clearance = box.min.y - rampY;
    const topDrift = Math.abs(box.max.y - correction.beforeTopY);
    maximumFinalClearanceMeters = Math.max(maximumFinalClearanceMeters, Math.abs(clearance));
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, topDrift);
    if (Math.abs(clearance) > MAX_FINAL_CLEARANCE_METERS) {
      throw new Error(`A1 V14 rod final pavement clearance ${clearance}`);
    }
    if (topDrift > MAX_TOP_MOUNT_DRIFT_METERS) {
      throw new Error(`A1 V14 rod upper mount drift ${topDrift}`);
    }
  }

  const remaining = [];
  for (let columnIndex = 0; columnIndex < ROD_COLUMNS.length; columnIndex += 1) {
    const selected = collectColumnTriangles(THREE, mesh, position, ROD_COLUMNS[columnIndex], ground, columnIndex);
    for (const group of clusterSelected(selected)) {
      const box = groupBounds(THREE, group);
      const center = box.getCenter(new THREE.Vector3());
      const rampY = sampleGroundY(THREE, ground, center.x, center.z, box.max.y);
      const clearance = box.min.y - rampY;
      if (isRodGroup(group, box, clearance)) {
        remaining.push({ columnIndex, triangles: group.length, clearance: +clearance.toFixed(4) });
      }
    }
  }
  if (remaining.length) throw new Error(`A1 V14 remaining suspended rod columns ${JSON.stringify(remaining)}`);

  const extraTriangles = corrections.reduce((sum, correction) => sum + correction.group.length, 0);
  const extraCount = corrections.length;
  const correctedSupportSetCount = base.correctedSupportSetCount + extraCount;
  model.userData.a1V14ExactRodColumnCorrection = Object.freeze({
    count: extraCount,
    triangles: extraTriangles,
    maximumFinalClearanceMeters,
    maximumTopMountDriftMeters,
  });
  return Object.freeze({
    ...base,
    secondaryMeshGroundedCount: base.secondaryMeshGroundedCount + extraCount,
    secondaryMeshGroundedTriangleCount: base.secondaryMeshGroundedTriangleCount + extraTriangles,
    spatialRodClusterCount: base.spatialRodClusterCount + extraCount,
    spatialRodTriangleCount: base.spatialRodTriangleCount + extraTriangles,
    spatialRodVertexCount: base.spatialRodVertexCount + extraTriangles * 3,
    correctedSupportSetCount,
    visibleLoadLegCount: correctedSupportSetCount,
    remainingSuspendedSupportCount: 0,
    maximumFinalClearanceMeters,
    maximumTopMountDriftMeters,
    maximumExtensionMeters: Math.max(base.maximumExtensionMeters, ...corrections.map((correction) => correction.extension)),
    rampReferenceComponentCount: correctedSupportSetCount,
    v14ExactRodColumnGroundedCount: extraCount,
    v14ExactRodColumnTriangleCount: extraTriangles,
  });
}

export {
  A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY,
  A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY,
} from "./a1TunnelCVisibleSupportGroundingV5.js";
