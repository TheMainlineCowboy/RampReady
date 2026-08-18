const AUTHORITY = "exact-supplied-tunnel-c-visible-support-components-grounded-v1";
const MAX_GROUNDING_EXTENSION_METERS = 3.0;
const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
const VERTEX_KEY_SCALE = 10000;
const LOWER_RIGID_FRACTION = 0.28;
const UPPER_RIGID_FRACTION = 0.72;

function vertexKey(position, index) {
  return `${Math.round(position.getX(index) * VERTEX_KEY_SCALE)},${Math.round(position.getY(index) * VERTEX_KEY_SCALE)},${Math.round(position.getZ(index) * VERTEX_KEY_SCALE)}`;
}

function findTriangleComponents(position) {
  if (!position || position.count % 3 !== 0) {
    throw new Error(`A1 Tunnel-C support grounding requires triangle-addressable geometry: vertices=${position?.count}`);
  }
  const triangleCount = position.count / 3;
  const parent = new Int32Array(triangleCount);
  for (let index = 0; index < triangleCount; index += 1) parent[index] = index;
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
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
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
    let values = byRoot.get(root);
    if (!values) {
      values = [];
      byRoot.set(root, values);
    }
    values.push(triangle);
  }
  return [...byRoot.values()];
}

function centerOfObject(THREE, object) {
  if (!object) return null;
  return new THREE.Box3().setFromObject(object).getCenter(new THREE.Vector3());
}

function componentMeasurement(THREE, mesh, position, triangles, rampY, rotundaWorld, cabWorld) {
  const worldBox = new THREE.Box3();
  const localA = new THREE.Vector3();
  const localB = new THREE.Vector3();
  const localC = new THREE.Vector3();
  const world = new THREE.Vector3();
  let stairTriangleCount = 0;
  for (const triangle of triangles) {
    const base = triangle * 3;
    localA.fromBufferAttribute(position, base);
    localB.fromBufferAttribute(position, base + 1);
    localC.fromBufferAttribute(position, base + 2);
    const centerX = (localA.x + localB.x + localC.x) / 3;
    const centerY = (localA.y + localB.y + localC.y) / 3;
    const centerZ = (localA.z + localB.z + localC.z) / 3;
    if (centerX > 16.4 && centerY < -1.55 && centerZ < 4.8) stairTriangleCount += 1;
    for (const local of [localA, localB, localC]) {
      world.copy(local).applyMatrix4(mesh.matrixWorld);
      worldBox.expandByPoint(world);
    }
  }
  const size = worldBox.getSize(new THREE.Vector3());
  const center = worldBox.getCenter(new THREE.Vector3());
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
    worldBox,
    size,
    center,
    clearanceMeters: worldBox.min.y - rampY,
    alongRatio,
    lateralDistance,
  };
}

function telescopeComponentToRamp(THREE, mesh, position, measurement, rampY) {
  const beforeMinY = measurement.worldBox.min.y;
  const beforeMaxY = measurement.worldBox.max.y;
  const height = beforeMaxY - beforeMinY;
  const extension = beforeMinY - rampY;
  if (!(height > 0.2) || !(extension > 0)) {
    throw new Error(`A1 Tunnel-C support component cannot telescope: height=${height}, extension=${extension}`);
  }

  const inverseWorld = mesh.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  const seen = new Set();
  for (const triangle of measurement.triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      const index = triangle * 3 + corner;
      if (seen.has(index)) continue;
      seen.add(index);
      local.fromBufferAttribute(position, index);
      world.copy(local).applyMatrix4(mesh.matrixWorld);
      const fraction = Math.max(0, Math.min(1, (world.y - beforeMinY) / height));
      let downwardOffset;
      if (fraction <= LOWER_RIGID_FRACTION) {
        // Preserve the wheel/base geometry as one rigid lower assembly.
        downwardOffset = extension;
      } else if (fraction >= UPPER_RIGID_FRACTION) {
        // Preserve the exact upper attachment to Tunnel-C.
        downwardOffset = 0;
      } else {
        // Telescope only the middle support shaft between fixed upper and lower ends.
        const blend = (fraction - LOWER_RIGID_FRACTION)
          / (UPPER_RIGID_FRACTION - LOWER_RIGID_FRACTION);
        downwardOffset = extension * (1 - blend);
      }
      world.y -= downwardOffset;
      local.copy(world).applyMatrix4(inverseWorld);
      position.setXYZ(index, local.x, local.y, local.z);
    }
  }
  return { extensionMeters: extension, beforeTopY: beforeMaxY };
}

export function groundA1TunnelCVisibleSupportHardware(THREE, model) {
  const mesh = model?.getObjectByName?.("Tunnel_C_Jetway_0");
  if (!mesh?.isMesh || !mesh.geometry?.getAttribute?.("position")) {
    throw new Error("A1 visible Tunnel-C support grounding cannot resolve Tunnel_C_Jetway_0");
  }
  model.updateWorldMatrix(true, true);
  mesh.updateWorldMatrix(true, false);

  // Operate on the CURRENT final A1 clone so the already-proved exact service-stair
  // swing is retained. The committed GLB, prototype, and all 57 static instances
  // remain untouched. Only the two disconnected source bogie/support pods telescope.
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.geometry = geometry;
  const position = geometry.getAttribute("position");
  const components = findTriangleComponents(position);

  // The integrated carrier's known source-grounded low triangle is used only as
  // the pavement plane reference. It is no longer accepted as visible bogie proof.
  const carrierBox = new THREE.Box3().setFromObject(mesh);
  const rampY = carrierBox.min.y;
  const rotundaWorld = centerOfObject(THREE, model.getObjectByName("Rotunda"));
  const cabWorld = centerOfObject(THREE, model.getObjectByName("Cab"));
  const measurements = components.map((triangles) =>
    componentMeasurement(THREE, mesh, position, triangles, rampY, rotundaWorld, cabWorld));

  // Current exact source topology exposes the visible bogie/support pair as two
  // high-detail ~1 m pods (1174 triangles each) below the aircraft-side Tunnel-C.
  // Select by topology + physical envelope rather than mesh name or lowest vertex.
  // This intentionally rejects tiny bolts, the broad underframe, passenger shell,
  // and the separately articulated 2352-triangle service stair.
  const candidates = measurements.filter((entry) => (
    entry.triangleCount >= 900
    && entry.triangleCount <= 1400
    && entry.stairTriangleCount === 0
    && entry.size.y >= 0.75
    && entry.size.y <= 1.40
    && Math.max(entry.size.x, entry.size.z) >= 0.45
    && Math.max(entry.size.x, entry.size.z) <= 1.50
    && entry.clearanceMeters > 1.50
    && entry.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS
    && Number.isFinite(entry.alongRatio)
    && entry.alongRatio >= 0.55
    && entry.alongRatio <= 0.90
    && Number.isFinite(entry.lateralDistance)
    && entry.lateralDistance <= 4.0
  ));

  if (candidates.length !== 2) {
    const diagnostic = measurements
      .filter((entry) => entry.triangleCount >= 4)
      .sort((a, b) => a.clearanceMeters - b.clearanceMeters)
      .slice(0, 30)
      .map((entry) => ({
        triangles: entry.triangleCount,
        stairTriangles: entry.stairTriangleCount,
        clearance: Number(entry.clearanceMeters.toFixed(3)),
        size: entry.size.toArray().map((value) => Number(value.toFixed(3))),
        along: Number.isFinite(entry.alongRatio) ? Number(entry.alongRatio.toFixed(3)) : null,
        lateral: Number.isFinite(entry.lateralDistance) ? Number(entry.lateralDistance.toFixed(3)) : null,
      }));
    throw new Error(`A1 visible Tunnel-C support grounding expected exactly two source bogie/support pods, found ${candidates.length}: ${JSON.stringify(diagnostic)}`);
  }

  const selected = candidates.sort((a, b) => a.lateralDistance - b.lateralDistance);
  const extensions = selected.map((entry) => telescopeComponentToRamp(THREE, mesh, position, entry, rampY));
  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);

  const finalMeasurements = selected.map((entry) =>
    componentMeasurement(THREE, mesh, position, entry.triangles, rampY, rotundaWorld, cabWorld));
  const maximumFinalClearanceMeters = Math.max(...finalMeasurements.map((entry) => Math.abs(entry.clearanceMeters)));
  const maximumTopMountDriftMeters = Math.max(...finalMeasurements.map((entry, index) => (
    Math.abs(entry.worldBox.max.y - extensions[index].beforeTopY)
  )));
  if (!(maximumFinalClearanceMeters <= MAX_FINAL_CLEARANCE_METERS)) {
    throw new Error(`A1 visible Tunnel-C supports failed ramp grounding: clearance=${maximumFinalClearanceMeters}`);
  }
  if (!(maximumTopMountDriftMeters <= MAX_TOP_MOUNT_DRIFT_METERS)) {
    throw new Error(`A1 visible Tunnel-C support top mounts drifted: ${maximumTopMountDriftMeters}`);
  }

  return Object.freeze({
    authority: AUTHORITY,
    groundedComponentCount: selected.length,
    groundedTriangleCount: selected.reduce((sum, entry) => sum + entry.triangleCount, 0),
    maximumBeforeClearanceMeters: Math.max(...selected.map((entry) => entry.clearanceMeters)),
    maximumExtensionMeters: Math.max(...extensions.map((entry) => entry.extensionMeters)),
    maximumFinalClearanceMeters,
    maximumTopMountDriftMeters,
    rampWorldY: rampY,
    componentAlongRatios: selected.map((entry) => entry.alongRatio),
    componentLateralDistancesMeters: selected.map((entry) => entry.lateralDistance),
  });
}

export const A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_AUTHORITY = AUTHORITY;
