import { groundA1TunnelCVisibleSupportHardwareV3 as groundV5 } from "./a1TunnelCVisibleSupportGroundingV5.js";

const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_EXTENSION_METERS = 2.2;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
const LOWER_RIGID_FRACTION = 0.22;
const UPPER_RIGID_FRACTION = 0.80;
const VERTEX_KEY_SCALE = 10000;
const PHOTO_GROUND_NAMES = Object.freeze([
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);

function vertexKey(position, index) {
  return `${Math.round(position.getX(index) * VERTEX_KEY_SCALE)},${Math.round(position.getY(index) * VERTEX_KEY_SCALE)},${Math.round(position.getZ(index) * VERTEX_KEY_SCALE)}`;
}

function findComponents(position) {
  if (!position || position.count % 3 !== 0) return [];
  const count = position.count / 3;
  const parent = new Int32Array(count);
  for (let i = 0; i < count; i += 1) parent[i] = i;
  const find = (v) => {
    let root = v;
    while (parent[root] !== root) root = parent[root];
    while (parent[v] !== v) {
      const next = parent[v];
      parent[v] = root;
      v = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[rb] = ra;
  };
  const first = new Map();
  for (let triangle = 0; triangle < count; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const key = vertexKey(position, triangle * 3 + corner);
      const existing = first.get(key);
      if (existing === undefined) first.set(key, triangle);
      else union(triangle, existing);
    }
  }
  const groups = new Map();
  for (let triangle = 0; triangle < count; triangle += 1) {
    const root = find(triangle);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root).push(triangle);
  }
  return [...groups.values()];
}

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
  throw new Error("A1 V9 cannot resolve rendered KPHX pavement");
}

function sampleGroundY(THREE, ground, x, z, highY) {
  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, highY + 40, z), new THREE.Vector3(0, -1, 0));
  raycaster.far = 200;
  const hit = raycaster.intersectObject(ground, true)[0];
  if (!hit?.point || !Number.isFinite(hit.point.y)) {
    throw new Error(`A1 V9 no pavement hit under x=${x.toFixed(3)} z=${z.toFixed(3)}`);
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
  const bridge = cab.clone().sub(rotunda).setY(0);
  const along = center.clone().sub(rotunda).setY(0).dot(bridge) / bridge.lengthSq();
  const projected = rotunda.clone().addScaledVector(bridge, along);
  const lateral = Math.hypot(center.x - projected.x, center.z - projected.z);
  return {
    triangles,
    box,
    size,
    center,
    horizontalSpan,
    aspect: size.y / Math.max(horizontalSpan, 0.01),
    along,
    lateral,
  };
}

function isTarget(entry) {
  if (!(entry.along >= 0.75 && entry.along <= 0.86 && entry.lateral >= 1.5 && entry.lateral <= 4.2)) return false;
  const large = entry.triangles.length >= 50
    && entry.triangles.length <= 90
    && entry.size.y >= 0.60
    && entry.size.y <= 0.85
    && entry.horizontalSpan >= 0.70
    && entry.horizontalSpan <= 0.90;
  const narrow = entry.triangles.length >= 4
    && entry.triangles.length <= 8
    && entry.size.y >= 0.085
    && entry.size.y <= 0.125
    && entry.horizontalSpan >= 0.025
    && entry.horizontalSpan <= 0.13
    && entry.aspect >= 0.8;
  return large || narrow;
}

function uniqueIndices(triangles) {
  const indices = new Set();
  for (const triangle of triangles) {
    indices.add(triangle * 3);
    indices.add(triangle * 3 + 1);
    indices.add(triangle * 3 + 2);
  }
  return [...indices];
}

function telescope(THREE, mesh, position, entry, rampY) {
  const minY = entry.box.min.y;
  const maxY = entry.box.max.y;
  const height = maxY - minY;
  const extension = minY - rampY;
  if (!(extension > MAX_FINAL_CLEARANCE_METERS) || extension > MAX_EXTENSION_METERS) {
    throw new Error(`A1 V9 target extension out of range: ${extension}`);
  }
  const inverseWorld = mesh.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const index of uniqueIndices(entry.triangles)) {
    local.fromBufferAttribute(position, index);
    world.copy(local).applyMatrix4(mesh.matrixWorld);
    const fraction = Math.max(0, Math.min(1, (world.y - minY) / height));
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
  return { beforeTopY: maxY, extension };
}

export function groundA1TunnelCVisibleSupportHardwareV3(THREE, model) {
  const base = groundV5(THREE, model);
  const mesh = model?.getObjectByName?.("Tunnel_B_Jetway_0");
  if (!mesh?.isMesh || !mesh.geometry?.getAttribute?.("position")) {
    throw new Error("A1 V9 cannot resolve Tunnel_B_Jetway_0");
  }
  const root = sceneRoot(model);
  const ground = resolveGround(root);
  root.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);
  mesh.updateWorldMatrix(true, false);
  const rotunda = objectCenter(THREE, model.getObjectByName("Rotunda"));
  const cab = objectCenter(THREE, model.getObjectByName("Cab"));

  // Deliberately preserve the indexed/source position representation used by the
  // ownership diagnostic. Converting to non-indexed geometry changes the exact
  // six diagnosed component signatures before selection.
  const geometry = mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  const targets = [];
  for (const triangles of findComponents(position)) {
    const entry = measure(THREE, mesh, position, triangles, rotunda, cab);
    if (!isTarget(entry)) continue;
    entry.rampY = sampleGroundY(THREE, ground, entry.center.x, entry.center.z, entry.box.max.y);
    entry.clearance = entry.box.min.y - entry.rampY;
    if (entry.clearance > MAX_FINAL_CLEARANCE_METERS && entry.clearance <= MAX_EXTENSION_METERS) targets.push(entry);
  }
  if (targets.length !== 6) {
    throw new Error(`A1 V9 expected exact six diagnosed Tunnel-B support islands, found ${targets.length}: ${JSON.stringify(targets.map((entry) => ({ triangles: entry.triangles.length, clearance: entry.clearance, along: entry.along, lateral: entry.lateral, size: entry.size.toArray() })))}`);
  }

  mesh.geometry = geometry;
  const corrections = targets.map((entry) => ({ entry, ...telescope(THREE, mesh, position, entry, entry.rampY) }));
  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);

  let maximumFinalClearanceMeters = base.maximumFinalClearanceMeters;
  let maximumTopMountDriftMeters = base.maximumTopMountDriftMeters;
  for (const correction of corrections) {
    const after = measure(THREE, mesh, position, correction.entry.triangles, rotunda, cab);
    const rampY = sampleGroundY(THREE, ground, after.center.x, after.center.z, after.box.max.y);
    const clearance = after.box.min.y - rampY;
    const drift = Math.abs(after.box.max.y - correction.beforeTopY);
    maximumFinalClearanceMeters = Math.max(maximumFinalClearanceMeters, Math.abs(clearance));
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, drift);
    if (clearance > MAX_FINAL_CLEARANCE_METERS) throw new Error(`A1 V9 Tunnel-B support still suspended: ${clearance}`);
  }
  if (maximumFinalClearanceMeters > MAX_FINAL_CLEARANCE_METERS) {
    throw new Error(`A1 V9 maximum final clearance ${maximumFinalClearanceMeters}`);
  }
  if (maximumTopMountDriftMeters > MAX_TOP_MOUNT_DRIFT_METERS) {
    throw new Error(`A1 V9 maximum upper-mount drift ${maximumTopMountDriftMeters}`);
  }

  const extraCount = corrections.length;
  const extraTriangles = corrections.reduce((sum, correction) => sum + correction.entry.triangles.length, 0);
  const secondaryMeshGroundedCount = base.secondaryMeshGroundedCount + extraCount;
  const correctedSupportSetCount = base.groundedComponentCount + secondaryMeshGroundedCount;
  return Object.freeze({
    ...base,
    secondaryMeshGroundedCount,
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
    v9TunnelBVisibleSupportCount: extraCount,
    v9TunnelBVisibleSupportTriangleCount: extraTriangles,
  });
}

export {
  A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY,
  A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY,
} from "./a1TunnelCVisibleSupportGroundingV5.js";
