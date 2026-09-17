import { groundA1TunnelCVisibleSupportHardwareV3 as groundV11 } from "./a1TunnelCVisibleSupportGroundingV11.js";

const REGION = Object.freeze({ minX: -13.8, maxX: -10.8, minY: 0.45, maxY: 3.15, minZ: 8.8, maxZ: 10.9 });
const NAMES = Object.freeze(["Tunnel_B_Jetway_0", "Tunnel_C_Jetway_0"]);
const PHOTO_GROUND_NAMES = Object.freeze(["PHX_KPHX_SourceAuthoredPhotoGround_Tiled", "PHX_KPHX_SourceAuthoredPhotoGround"]);
const KEY_SCALE = 10000;
const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_EXTENSION_METERS = 2.2;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;

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
  throw new Error("A1 V13 cannot resolve rendered KPHX pavement");
}

function groundY(THREE, ground, x, z, highY) {
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(x, highY + 40, z),
    new THREE.Vector3(0, -1, 0),
  );
  raycaster.far = 200;
  return raycaster.intersectObject(ground, true)[0]?.point?.y;
}

function key(vector) {
  return `${Math.round(vector.x * KEY_SCALE)},${Math.round(vector.y * KEY_SCALE)},${Math.round(vector.z * KEY_SCALE)}`;
}

function intersectsRegion(box) {
  return box.max.x >= REGION.minX && box.min.x <= REGION.maxX
    && box.max.y >= REGION.minY && box.min.y <= REGION.maxY
    && box.max.z >= REGION.minZ && box.min.z <= REGION.maxZ;
}

function selectRegionTriangles(THREE, mesh, position) {
  const selected = [];
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (let triangle = 0; triangle < position.count / 3; triangle += 1) {
    const box = new THREE.Box3();
    const keys = [];
    for (let corner = 0; corner < 3; corner += 1) {
      local.fromBufferAttribute(position, triangle * 3 + corner);
      world.copy(local).applyMatrix4(mesh.matrixWorld);
      box.expandByPoint(world);
      keys.push(key(world));
    }
    if (intersectsRegion(box)) selected.push({ triangle, keys, box });
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
    for (const vertexKey of selected[i].keys) {
      const prior = seen.get(vertexKey);
      if (prior === undefined) seen.set(vertexKey, i);
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

function isSupportCandidate(group, box, clearance) {
  if (!(clearance > MAX_FINAL_CLEARANCE_METERS) || clearance > MAX_EXTENSION_METERS) return false;
  const sx = box.max.x - box.min.x;
  const sy = box.max.y - box.min.y;
  const sz = box.max.z - box.min.z;
  const narrowRod = sy >= 0.30 && sy <= 2.70
    && sx <= 0.65 && sz <= 0.90
    && group.length >= 8 && group.length <= 180;
  // The two exact Tunnel-C load frames visible in the bogie camera are taller
  // and slightly deeper than the narrow rods. Keep this class deliberately
  // bounded so tunnel shells and long under-bridge beams cannot qualify.
  const tallLoadFrame = sy >= 4.0 && sy <= 4.7
    && sx >= 0.30 && sx <= 0.50
    && sz >= 1.15 && sz <= 1.40
    && group.length >= 24 && group.length <= 40;
  return narrowRod || tallLoadFrame;
}

function stretchGroup(THREE, mesh, position, group, rampY) {
  const before = groupBounds(THREE, group);
  const minY = before.min.y;
  const maxY = before.max.y;
  const height = maxY - minY;
  const extension = minY - rampY;
  if (!(height > 0.03) || !(extension > MAX_FINAL_CLEARANCE_METERS) || extension > MAX_EXTENSION_METERS) {
    throw new Error(`A1 V13 invalid support extension ${extension}`);
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
  return { extension, beforeTopY: maxY };
}

function measureGroupAfter(THREE, mesh, position, group) {
  const box = new THREE.Box3();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const item of group) {
    for (let corner = 0; corner < 3; corner += 1) {
      local.fromBufferAttribute(position, item.triangle * 3 + corner);
      box.expandByPoint(world.copy(local).applyMatrix4(mesh.matrixWorld));
    }
  }
  return box;
}

export function groundA1TunnelCVisibleSupportHardwareV3(THREE, model) {
  const base = groundV11(THREE, model);
  const root = sceneRoot(model);
  const pavement = resolveGround(root);
  root.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);
  const corrections = [];

  for (const name of NAMES) {
    const mesh = model?.getObjectByName?.(name);
    if (!mesh?.isMesh) continue;
    mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    mesh.geometry = geometry;
    const position = geometry.getAttribute("position");
    if (!position || position.count % 3 !== 0) continue;

    for (const group of clusterSelected(selectRegionTriangles(THREE, mesh, position))) {
      const box = groupBounds(THREE, group);
      const center = box.getCenter(new THREE.Vector3());
      const rampY = groundY(THREE, pavement, center.x, center.z, box.max.y);
      const clearance = Number.isFinite(rampY) ? box.min.y - rampY : null;
      if (clearance !== null && isSupportCandidate(group, box, clearance)) {
        const result = stretchGroup(THREE, mesh, position, group, rampY);
        corrections.push({ mesh, name, group, rampY, ...result });
      }
    }

    position.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    mesh.updateMatrixWorld(true);
  }

  model.updateWorldMatrix(true, true);
  let maximumFinalClearanceMeters = base.maximumFinalClearanceMeters;
  let maximumTopMountDriftMeters = base.maximumTopMountDriftMeters;
  for (const correction of corrections) {
    const position = correction.mesh.geometry.getAttribute("position");
    const box = measureGroupAfter(THREE, correction.mesh, position, correction.group);
    const center = box.getCenter(new THREE.Vector3());
    const rampY = groundY(THREE, pavement, center.x, center.z, box.max.y);
    const clearance = box.min.y - rampY;
    const topDrift = Math.abs(box.max.y - correction.beforeTopY);
    maximumFinalClearanceMeters = Math.max(maximumFinalClearanceMeters, Math.abs(clearance));
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, topDrift);
    if (Math.abs(clearance) > MAX_FINAL_CLEARANCE_METERS) {
      throw new Error(`A1 V13 support final pavement clearance ${clearance}`);
    }
    if (topDrift > MAX_TOP_MOUNT_DRIFT_METERS) {
      throw new Error(`A1 V13 support upper mount drift ${topDrift}`);
    }
  }

  const remaining = [];
  for (const name of NAMES) {
    const mesh = model?.getObjectByName?.(name);
    if (!mesh?.isMesh) continue;
    mesh.updateWorldMatrix(true, false);
    const position = mesh.geometry.getAttribute("position");
    for (const group of clusterSelected(selectRegionTriangles(THREE, mesh, position))) {
      const box = groupBounds(THREE, group);
      const center = box.getCenter(new THREE.Vector3());
      const rampY = groundY(THREE, pavement, center.x, center.z, box.max.y);
      const clearance = Number.isFinite(rampY) ? box.min.y - rampY : null;
      if (clearance !== null && isSupportCandidate(group, box, clearance)) {
        remaining.push({ mesh: name, triangles: group.length, clearance: +clearance.toFixed(4) });
      }
    }
  }
  if (remaining.length) throw new Error(`A1 V13 remaining suspended visible supports ${JSON.stringify(remaining)}`);

  const extraTriangles = corrections.reduce((sum, correction) => sum + correction.group.length, 0);
  const extraCount = corrections.length;
  const correctedSupportSetCount = base.correctedSupportSetCount + extraCount;
  model.userData.a1V13ConnectedSupportCorrection = Object.freeze({
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
    v13ConnectedRodGroundedCount: extraCount,
    v13ConnectedRodTriangleCount: extraTriangles,
  });
}

export {
  A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY,
  A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY,
} from "./a1TunnelCVisibleSupportGroundingV5.js";
