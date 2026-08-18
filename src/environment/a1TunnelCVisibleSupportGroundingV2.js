const AUTHORITY = "exact-supplied-tunnel-c-visible-support-components-grounded-v5-carrier-floor-reference-visible-proof";
const MAX_GROUNDING_EXTENSION_METERS = 3.0;
const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
const VERTEX_KEY_SCALE = 10000;
const LOWER_RIGID_FRACTION = 0.30;
const UPPER_RIGID_FRACTION = 0.76;

function vertexKey(position, index) {
  return `${Math.round(position.getX(index) * VERTEX_KEY_SCALE)},${Math.round(position.getY(index) * VERTEX_KEY_SCALE)},${Math.round(position.getZ(index) * VERTEX_KEY_SCALE)}`;
}

function findTriangleComponents(position) {
  if (!position || position.count % 3 !== 0) {
    throw new Error(`A1 Tunnel-C visible support proof requires triangle-addressable geometry: vertices=${position?.count}`);
  }
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

function objectCenter(THREE, object) {
  return object ? new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3()) : null;
}

function measureComponent(THREE, mesh, position, triangles, rampY, rotundaWorld, cabWorld) {
  const box = new THREE.Box3();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  let stairTriangleCount = 0;
  for (const triangle of triangles) {
    const base = triangle * 3;
    const a = new THREE.Vector3().fromBufferAttribute(position, base);
    const b = new THREE.Vector3().fromBufferAttribute(position, base + 1);
    const c = new THREE.Vector3().fromBufferAttribute(position, base + 2);
    const centerX = (a.x + b.x + c.x) / 3;
    const centerY = (a.y + b.y + c.y) / 3;
    const centerZ = (a.z + b.z + c.z) / 3;
    if (centerX > 16.4 && centerY < -1.55 && centerZ < 4.8) stairTriangleCount += 1;
    for (let corner = 0; corner < 3; corner += 1) {
      local.fromBufferAttribute(position, base + corner);
      world.copy(local).applyMatrix4(mesh.matrixWorld);
      box.expandByPoint(world);
    }
  }
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const horizontalSpan = Math.max(size.x, size.z);
  let alongRatio = NaN;
  let lateralDistance = NaN;
  if (rotundaWorld && cabWorld) {
    const bridge = cabWorld.clone().sub(rotundaWorld).setY(0);
    const lengthSq = bridge.lengthSq();
    if (lengthSq > 1) {
      const fromRotunda = center.clone().sub(rotundaWorld).setY(0);
      alongRatio = fromRotunda.dot(bridge) / lengthSq;
      const projected = rotundaWorld.clone().addScaledVector(bridge, alongRatio);
      lateralDistance = Math.hypot(center.x - projected.x, center.z - projected.z);
    }
  }
  return {
    triangles,
    triangleCount: triangles.length,
    stairTriangleCount,
    box,
    size,
    horizontalSpan,
    verticalAspect: size.y / Math.max(horizontalSpan, 0.01),
    clearanceMeters: box.min.y - rampY,
    alongRatio,
    lateralDistance,
  };
}

function telescopeToRamp(THREE, mesh, position, measurement, rampY) {
  const beforeMinY = measurement.box.min.y;
  const beforeMaxY = measurement.box.max.y;
  const height = beforeMaxY - beforeMinY;
  const extension = beforeMinY - rampY;
  if (!(height > 0.18) || !(extension > 0) || extension > MAX_GROUNDING_EXTENSION_METERS) {
    throw new Error(`A1 visible support cannot telescope to ramp: height=${height}, extension=${extension}`);
  }
  const inverseWorld = mesh.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const triangle of measurement.triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      const index = triangle * 3 + corner;
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
  }
  return { extensionMeters: extension, beforeTopY: beforeMaxY };
}

export function groundA1TunnelCVisibleSupportHardwareV2(THREE, model) {
  const mesh = model?.getObjectByName?.("Tunnel_C_Jetway_0");
  if (!mesh?.isMesh || !mesh.geometry?.getAttribute?.("position")) {
    throw new Error("A1 visible support proof cannot resolve Tunnel_C_Jetway_0");
  }
  model.updateWorldMatrix(true, true);
  mesh.updateWorldMatrix(true, false);

  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.geometry = geometry;
  const position = geometry.getAttribute("position");
  const components = findTriangleComponents(position);
  const rotundaWorld = objectCenter(THREE, model.getObjectByName("Rotunda"));
  const cabWorld = objectCenter(THREE, model.getObjectByName("Cab"));

  // The integrated opaque carrier's validated lowest exact-source contact is used
  // only as the transformed ramp-coordinate reference. It is NOT accepted as proof
  // that visible supports are grounded. Every visible load-bearing component below
  // is independently extended to this plane and re-measured after deformation.
  const rampY = new THREE.Box3().setFromObject(mesh).min.y;
  if (!Number.isFinite(rampY)) throw new Error("A1 visible support proof has no finite transformed ramp reference");

  const isAircraftSide = (entry) => Number.isFinite(entry.alongRatio)
    && entry.alongRatio >= 0.35
    && entry.alongRatio <= 1.05
    && Number.isFinite(entry.lateralDistance)
    && entry.lateralDistance <= 5.5;
  const measurements = components.map((triangles) =>
    measureComponent(THREE, mesh, position, triangles, rampY, rotundaWorld, cabWorld));
  const visibleSupport = (entry) => isAircraftSide(entry)
    && entry.stairTriangleCount === 0
    && entry.triangleCount >= 4
    && entry.triangleCount <= 2200
    && entry.size.y >= 0.25
    && entry.size.y <= 3.20
    && entry.horizontalSpan >= 0.04
    && entry.horizontalSpan <= 1.80
    && entry.verticalAspect >= 1.05;

  const selected = measurements.filter((entry) => visibleSupport(entry)
    && entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS
    && entry.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS);
  if (selected.length < 2 || selected.length > 20) {
    throw new Error(`A1 visible support proof expected 2-20 suspended support components, found ${selected.length}`);
  }

  const extensions = selected.map((entry) => telescopeToRamp(THREE, mesh, position, entry, rampY));
  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);

  const finalSelected = selected.map((entry) =>
    measureComponent(THREE, mesh, position, entry.triangles, rampY, rotundaWorld, cabWorld));
  const maximumFinalClearanceMeters = Math.max(...finalSelected.map((entry) => Math.abs(entry.clearanceMeters)));
  const maximumTopMountDriftMeters = Math.max(...finalSelected.map((entry, index) =>
    Math.abs(entry.box.max.y - extensions[index].beforeTopY)));
  if (maximumFinalClearanceMeters > MAX_FINAL_CLEARANCE_METERS) {
    throw new Error(`A1 visible support proof still floats: clearance=${maximumFinalClearanceMeters}`);
  }
  if (maximumTopMountDriftMeters > MAX_TOP_MOUNT_DRIFT_METERS) {
    throw new Error(`A1 visible support proof moved an upper mount: drift=${maximumTopMountDriftMeters}`);
  }

  const finalAll = components.map((triangles) =>
    measureComponent(THREE, mesh, position, triangles, rampY, rotundaWorld, cabWorld));
  const remaining = finalAll.filter((entry) => visibleSupport(entry)
    && entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS
    && entry.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS);
  if (remaining.length) {
    throw new Error(`A1 visible support proof found ${remaining.length} support component(s) still suspended`);
  }

  return Object.freeze({
    authority: AUTHORITY,
    groundedComponentCount: selected.length,
    groundedTriangleCount: selected.reduce((sum, entry) => sum + entry.triangleCount, 0),
    detailedPodCount: selected.filter((entry) => entry.triangleCount >= 600).length,
    visibleLoadLegCount: selected.length,
    remainingSuspendedSupportCount: 0,
    maximumBeforeClearanceMeters: Math.max(...selected.map((entry) => entry.clearanceMeters)),
    maximumExtensionMeters: Math.max(...extensions.map((entry) => entry.extensionMeters)),
    maximumFinalClearanceMeters,
    maximumTopMountDriftMeters,
    rampWorldY: rampY,
    rampReferenceComponentCount: 1,
    rampReferenceSpreadMeters: 0,
    componentAlongRatios: selected.map((entry) => entry.alongRatio),
    componentLateralDistancesMeters: selected.map((entry) => entry.lateralDistance),
  });
}

export const A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V2_AUTHORITY = AUTHORITY;
