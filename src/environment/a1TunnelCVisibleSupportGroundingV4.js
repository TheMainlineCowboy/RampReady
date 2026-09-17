import { groundA1TunnelCVisibleSupportHardwareV3 as groundV3 } from "./a1TunnelCVisibleSupportGroundingV3.js";

const AUTHORITY = "exact-supplied-tunnel-c-visible-support-components-grounded-v16-rendered-pavement-triangle-rod-clusters";
const SECONDARY_AUTHORITY = "a1-visible-support-all-rendered-mesh-secondary-scan-v1";
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
      const index = triangle * 3 + corner;
      const key = vertexKey(position, index);
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
  throw new Error("A1 V4 support scan cannot resolve rendered KPHX pavement");
}

function sampleGroundY(THREE, ground, x, z, highY) {
  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, highY, z), new THREE.Vector3(0, -1, 0));
  raycaster.near = 0;
  raycaster.far = 200;
  const hit = raycaster.intersectObject(ground, true)[0];
  if (!hit?.point || !Number.isFinite(hit.point.y)) {
    throw new Error(`A1 V4 support scan found no rendered pavement under x=${x.toFixed(3)} z=${z.toFixed(3)}`);
  }
  return hit.point.y;
}

function objectCenter(THREE, object) {
  return object ? new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()) : null;
}

function bridgeLocation(center, rotundaWorld, cabWorld) {
  if (!rotundaWorld || !cabWorld) return { alongRatio: NaN, lateralDistance: NaN };
  const bridge = cabWorld.clone().sub(rotundaWorld).setY(0);
  const lengthSq = bridge.lengthSq();
  if (!(lengthSq > 1)) return { alongRatio: NaN, lateralDistance: NaN };
  const fromRotunda = center.clone().sub(rotundaWorld).setY(0);
  const alongRatio = fromRotunda.dot(bridge) / lengthSq;
  const projected = rotundaWorld.clone().addScaledVector(bridge, alongRatio);
  return {
    alongRatio,
    lateralDistance: Math.hypot(center.x - projected.x, center.z - projected.z),
  };
}

function measureTriangles(THREE, mesh, position, triangles, rotundaWorld, cabWorld) {
  const box = new THREE.Box3();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const triangle of triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      local.fromBufferAttribute(position, triangle * 3 + corner);
      world.copy(local).applyMatrix4(mesh.matrixWorld);
      box.expandByPoint(world);
    }
  }
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const horizontalSpan = Math.max(size.x, size.z);
  return {
    mesh,
    triangles,
    box,
    center,
    size,
    horizontalSpan,
    verticalAspect: size.y / Math.max(horizontalSpan, 0.01),
    ...bridgeLocation(center, rotundaWorld, cabWorld),
  };
}

function isRemainingVisibleRod(entry) {
  return Number.isFinite(entry.alongRatio)
    && entry.alongRatio >= 0.35
    && entry.alongRatio <= 1.10
    && Number.isFinite(entry.lateralDistance)
    && entry.lateralDistance <= 6.0
    && entry.triangles.length >= 2
    && entry.triangles.length <= 2200
    && entry.size.y >= 0.18
    && entry.size.y <= 4.5
    && entry.horizontalSpan >= 0.015
    && entry.horizontalSpan <= 1.60
    && entry.verticalAspect >= 1.05;
}

function uniqueVertexIndices(triangles) {
  const out = new Set();
  for (const triangle of triangles) {
    out.add(triangle * 3);
    out.add(triangle * 3 + 1);
    out.add(triangle * 3 + 2);
  }
  return [...out];
}

function telescopeToGround(THREE, mesh, position, entry, rampY) {
  const beforeMinY = entry.box.min.y;
  const beforeMaxY = entry.box.max.y;
  const height = beforeMaxY - beforeMinY;
  const extension = beforeMinY - rampY;
  if (!(height > 0.08) || !(extension > MAX_FINAL_CLEARANCE_METERS) || extension > MAX_EXTENSION_METERS) {
    throw new Error(`A1 V4 support cannot telescope: height=${height} extension=${extension}`);
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
  const base = groundV3(THREE, model);
  const sceneRoot = resolveSceneRoot(model);
  const ground = resolveGround(sceneRoot);
  sceneRoot.updateWorldMatrix?.(true, true);
  ground.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);
  const rotundaWorld = objectCenter(THREE, model.getObjectByName("Rotunda"));
  const cabWorld = objectCenter(THREE, model.getObjectByName("Cab"));
  const primary = model.getObjectByName("Tunnel_C_Jetway_0");
  const corrected = [];
  const meshes = [];
  model.traverse?.((object) => {
    if (object?.isMesh && object !== primary && object.geometry?.getAttribute?.("position")) meshes.push(object);
  });

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
    const position = geometry.getAttribute("position");
    if (!position || position.count % 3 !== 0) continue;
    const measurements = findTriangleComponents(position).map((triangles) =>
      measureTriangles(THREE, mesh, position, triangles, rotundaWorld, cabWorld));
    const suspended = measurements.filter((entry) => {
      if (!isRemainingVisibleRod(entry)) return false;
      const rampY = sampleGroundY(THREE, ground, entry.center.x, entry.center.z, entry.box.max.y + 40);
      entry.rampY = rampY;
      entry.clearance = entry.box.min.y - rampY;
      return entry.clearance > MAX_FINAL_CLEARANCE_METERS && entry.clearance <= MAX_EXTENSION_METERS;
    });
    if (!suspended.length) continue;
    mesh.geometry = geometry;
    for (const entry of suspended) {
      const result = telescopeToGround(THREE, mesh, position, entry, entry.rampY);
      corrected.push({ mesh, geometry, position, entry, ...result });
    }
    position.needsUpdate = true;
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    mesh.updateMatrixWorld(true);
    model.updateWorldMatrix(true, true);
  }

  let maximumFinalClearanceMeters = base.maximumFinalClearanceMeters;
  let maximumTopMountDriftMeters = base.maximumTopMountDriftMeters;
  let remainingSuspendedSupportCount = 0;
  for (const correction of corrected) {
    correction.mesh.updateWorldMatrix(true, false);
    const measured = measureTriangles(THREE, correction.mesh, correction.position, correction.entry.triangles, rotundaWorld, cabWorld);
    const rampY = sampleGroundY(THREE, ground, measured.center.x, measured.center.z, measured.box.max.y + 40);
    const clearance = measured.box.min.y - rampY;
    maximumFinalClearanceMeters = Math.max(maximumFinalClearanceMeters, Math.abs(clearance));
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, Math.abs(measured.box.max.y - correction.beforeTopY));
    if (Math.abs(clearance) > MAX_FINAL_CLEARANCE_METERS) remainingSuspendedSupportCount += 1;
  }

  // Fail closed by repeating the same broad post-V3 rod detector after correction.
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    const position = mesh.geometry?.getAttribute?.("position");
    if (!position || position.count % 3 !== 0) continue;
    const measurements = findTriangleComponents(position).map((triangles) =>
      measureTriangles(THREE, mesh, position, triangles, rotundaWorld, cabWorld));
    for (const entry of measurements) {
      if (!isRemainingVisibleRod(entry)) continue;
      const rampY = sampleGroundY(THREE, ground, entry.center.x, entry.center.z, entry.box.max.y + 40);
      const clearance = entry.box.min.y - rampY;
      if (clearance > MAX_FINAL_CLEARANCE_METERS && clearance <= MAX_EXTENSION_METERS) {
        remainingSuspendedSupportCount += 1;
      }
    }
  }

  if (!corrected.length) throw new Error("A1 V4 support correction found no remaining visible rod surfaces after V3");
  if (remainingSuspendedSupportCount) {
    throw new Error(`A1 V4 support correction still finds ${remainingSuspendedSupportCount} suspended visible rod surfaces`);
  }
  if (maximumFinalClearanceMeters > MAX_FINAL_CLEARANCE_METERS) {
    throw new Error(`A1 V4 support correction final clearance=${maximumFinalClearanceMeters}`);
  }
  if (maximumTopMountDriftMeters > MAX_TOP_MOUNT_DRIFT_METERS) {
    throw new Error(`A1 V4 support correction moved upper mount by ${maximumTopMountDriftMeters}`);
  }

  return Object.freeze({
    ...base,
    authority: AUTHORITY,
    secondaryMeshAuthority: SECONDARY_AUTHORITY,
    v4RemainingRodCorrectionCount: corrected.length,
    v4RemainingRodTriangleCount: corrected.reduce((sum, item) => sum + item.entry.triangles.length, 0),
    correctedSupportSetCount: base.correctedSupportSetCount + corrected.length,
    visibleLoadLegCount: base.visibleLoadLegCount + corrected.length,
    remainingSuspendedSupportCount: 0,
    maximumFinalClearanceMeters,
    maximumTopMountDriftMeters,
    maximumExtensionMeters: Math.max(base.maximumExtensionMeters, ...corrected.map((item) => item.extension)),
    rampReferenceComponentCount: base.rampReferenceComponentCount + corrected.length,
  });
}

export const A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY = AUTHORITY;
export const A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY = SECONDARY_AUTHORITY;
