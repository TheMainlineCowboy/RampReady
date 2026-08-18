const AUTHORITY = "exact-supplied-tunnel-c-visible-support-components-grounded-v1";
const MAX_GROUNDING_SHIFT_METERS = 1.5;
const MAX_FINAL_CLEARANCE_METERS = 0.015;
const VERTEX_KEY_SCALE = 10000;

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

function translateComponentToRamp(THREE, mesh, position, measurement, shiftWorldY) {
  const worldToLocalOrigin = new THREE.Vector3(0, 0, 0).applyMatrix4(mesh.matrixWorld.clone().invert());
  const worldToLocalShifted = new THREE.Vector3(0, shiftWorldY, 0).applyMatrix4(mesh.matrixWorld.clone().invert());
  const localShift = worldToLocalShifted.sub(worldToLocalOrigin);
  const vertex = new THREE.Vector3();
  for (const triangle of measurement.triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      const index = triangle * 3 + corner;
      vertex.fromBufferAttribute(position, index).add(localShift);
      position.setXYZ(index, vertex.x, vertex.y, vertex.z);
    }
  }
}

export function groundA1TunnelCVisibleSupportHardware(THREE, model) {
  const mesh = model?.getObjectByName?.("Tunnel_C_Jetway_0");
  if (!mesh?.isMesh || !mesh.geometry?.getAttribute?.("position")) {
    throw new Error("A1 visible Tunnel-C support grounding cannot resolve Tunnel_C_Jetway_0");
  }
  model.updateWorldMatrix(true, true);
  mesh.updateWorldMatrix(true, false);

  if (!mesh.userData.a1VisibleSupportGroundingSourceGeometryV1) {
    mesh.userData.a1VisibleSupportGroundingSourceGeometryV1 = mesh.geometry.index
      ? mesh.geometry.toNonIndexed()
      : mesh.geometry.clone();
  }
  // Operate on the CURRENT final A1 geometry so the already-proved service-stair
  // swing is retained. The committed GLB, prototype, and 57 static instances are
  // never mutated; only this A1 clone's disconnected exact-source support islands move.
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.geometry = geometry;
  const position = geometry.getAttribute("position");
  const components = findTriangleComponents(position);

  const carrierBox = new THREE.Box3().setFromObject(mesh);
  const rampY = carrierBox.min.y;
  const rotundaWorld = centerOfObject(THREE, model.getObjectByName("Rotunda"));
  const cabWorld = centerOfObject(THREE, model.getObjectByName("Cab"));
  const measurements = components.map((triangles) =>
    componentMeasurement(THREE, mesh, position, triangles, rampY, rotundaWorld, cabWorld));

  // Select disconnected, substantial vertical mechanical islands under Tunnel-C.
  // Passenger shell pieces are too large; the exact 2352-triangle diagonal stair
  // is excluded explicitly. The aircraft-side ratio keeps unrelated terminal-side
  // underside pieces from being mistaken for the bogie/support legs.
  const candidates = measurements.filter((entry) => (
    entry.triangleCount >= 4
    && entry.stairTriangleCount / entry.triangleCount < 0.5
    && entry.size.y >= 0.45
    && Math.max(entry.size.x, entry.size.z) <= 4.5
    && entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS
    && entry.clearanceMeters <= MAX_GROUNDING_SHIFT_METERS
    && Number.isFinite(entry.alongRatio)
    && entry.alongRatio >= 0.30
    && entry.alongRatio <= 1.05
    && Number.isFinite(entry.lateralDistance)
    && entry.lateralDistance <= 5.0
  ));

  if (!candidates.length) {
    const diagnostic = measurements
      .filter((entry) => entry.triangleCount >= 4)
      .sort((a, b) => a.clearanceMeters - b.clearanceMeters)
      .slice(0, 24)
      .map((entry) => ({
        triangles: entry.triangleCount,
        stairTriangles: entry.stairTriangleCount,
        clearance: Number(entry.clearanceMeters.toFixed(3)),
        size: entry.size.toArray().map((value) => Number(value.toFixed(3))),
        along: Number.isFinite(entry.alongRatio) ? Number(entry.alongRatio.toFixed(3)) : null,
        lateral: Number.isFinite(entry.lateralDistance) ? Number(entry.lateralDistance.toFixed(3)) : null,
      }));
    throw new Error(`A1 visible Tunnel-C support grounding found no suspended exact-source support island: ${JSON.stringify(diagnostic)}`);
  }

  const selected = candidates
    .sort((a, b) => (b.size.y * Math.log2(b.triangleCount + 1)) - (a.size.y * Math.log2(a.triangleCount + 1)))
    .slice(0, Math.min(4, candidates.length));
  for (const entry of selected) {
    translateComponentToRamp(THREE, mesh, position, entry, -entry.clearanceMeters);
  }
  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);

  const finalMeasurements = selected.map((entry) =>
    componentMeasurement(THREE, mesh, position, entry.triangles, rampY, rotundaWorld, cabWorld));
  const maximumFinalClearanceMeters = Math.max(...finalMeasurements.map((entry) => Math.abs(entry.clearanceMeters)));
  if (!(maximumFinalClearanceMeters <= MAX_FINAL_CLEARANCE_METERS)) {
    throw new Error(`A1 visible Tunnel-C supports failed ramp grounding: clearance=${maximumFinalClearanceMeters}`);
  }

  return Object.freeze({
    authority: AUTHORITY,
    groundedComponentCount: selected.length,
    groundedTriangleCount: selected.reduce((sum, entry) => sum + entry.triangleCount, 0),
    maximumBeforeClearanceMeters: Math.max(...selected.map((entry) => entry.clearanceMeters)),
    maximumFinalClearanceMeters,
    rampWorldY: rampY,
    componentAlongRatios: selected.map((entry) => entry.alongRatio),
    componentLateralDistancesMeters: selected.map((entry) => entry.lateralDistance),
  });
}

export const A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_AUTHORITY = AUTHORITY;
