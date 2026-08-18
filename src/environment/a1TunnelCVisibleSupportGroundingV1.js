const AUTHORITY = "exact-supplied-tunnel-c-visible-support-components-grounded-v3";
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
  const horizontalSpan = Math.max(size.x, size.z);
  return {
    triangles,
    triangleCount: triangles.length,
    stairTriangleCount,
    worldBox,
    size,
    center,
    horizontalSpan,
    verticalAspect: size.y / Math.max(horizontalSpan, 0.01),
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
  if (!(height > 0.18) || !(extension > 0)) {
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
      if (fraction <= LOWER_RIGID_FRACTION) downwardOffset = extension;
      else if (fraction >= UPPER_RIGID_FRACTION) downwardOffset = 0;
      else {
        const blend = (fraction - LOWER_RIGID_FRACTION) / (UPPER_RIGID_FRACTION - LOWER_RIGID_FRACTION);
        downwardOffset = extension * (1 - blend);
      }
      world.y -= downwardOffset;
      local.copy(world).applyMatrix4(inverseWorld);
      position.setXYZ(index, local.x, local.y, local.z);
    }
  }
  return { extensionMeters: extension, beforeTopY: beforeMaxY };
}

function diagnosticEntry(entry) {
  return {
    triangles: entry.triangleCount,
    stairTriangles: entry.stairTriangleCount,
    clearance: Number(entry.clearanceMeters.toFixed(3)),
    size: entry.size.toArray().map((value) => Number(value.toFixed(3))),
    aspect: Number(entry.verticalAspect.toFixed(2)),
    along: Number.isFinite(entry.alongRatio) ? Number(entry.alongRatio.toFixed(3)) : null,
    lateral: Number.isFinite(entry.lateralDistance) ? Number(entry.lateralDistance.toFixed(3)) : null,
  };
}

export function groundA1TunnelCVisibleSupportHardware(THREE, model) {
  const mesh = model?.getObjectByName?.("Tunnel_C_Jetway_0");
  if (!mesh?.isMesh || !mesh.geometry?.getAttribute?.("position")) {
    throw new Error("A1 visible Tunnel-C support grounding cannot resolve Tunnel_C_Jetway_0");
  }
  model.updateWorldMatrix(true, true);
  mesh.updateWorldMatrix(true, false);

  // Work only on the final animated A1 clone. The committed GLB, source prototype,
  // static fleet, passenger tunnel, Cab, aircraft and terminal remain untouched.
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.geometry = geometry;
  const position = geometry.getAttribute("position");
  const components = findTriangleComponents(position);

  // The KPHX ramp is the world-space Y=0 physical plane used by the aircraft,
  // tug and prior exact Tunnel-C grounding passes. Do not derive the ramp from
  // Tunnel_C_Jetway_0's hidden lowest carrier triangle: that was the loophole
  // which let visibly suspended legs validate against an unrelated mesh vertex.
  const rampY = 0;
  const rotundaWorld = centerOfObject(THREE, model.getObjectByName("Rotunda"));
  const cabWorld = centerOfObject(THREE, model.getObjectByName("Cab"));
  const measurements = components.map((triangles) =>
    componentMeasurement(THREE, mesh, position, triangles, rampY, rotundaWorld, cabWorld));

  const isAircraftSide = (entry) => (
    Number.isFinite(entry.alongRatio)
    && entry.alongRatio >= 0.35
    && entry.alongRatio <= 1.05
    && Number.isFinite(entry.lateralDistance)
    && entry.lateralDistance <= 5.5
  );

  // Include every compact, predominantly vertical, aircraft-side load-bearing
  // island. The prior v2 bounds were too narrow and selected only a subset of
  // the rods visible in the final aircraft-side/bogie screenshots.
  const detailedPods = measurements.filter((entry) => (
    isAircraftSide(entry)
    && entry.stairTriangleCount === 0
    && entry.triangleCount >= 600
    && entry.triangleCount <= 1800
    && entry.size.y >= 0.55
    && entry.size.y <= 2.20
    && entry.horizontalSpan >= 0.25
    && entry.horizontalSpan <= 1.80
    && entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS
    && entry.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS
  ));

  const visibleLoadLegs = measurements.filter((entry) => (
    isAircraftSide(entry)
    && entry.stairTriangleCount === 0
    && entry.triangleCount >= 4
    && entry.triangleCount <= 2200
    && entry.size.y >= 0.25
    && entry.size.y <= 3.20
    && entry.horizontalSpan >= 0.04
    && entry.horizontalSpan <= 1.80
    && entry.verticalAspect >= 1.05
    && entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS
    && entry.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS
  ));

  const unique = new Map();
  for (const entry of [...detailedPods, ...visibleLoadLegs]) {
    unique.set(entry.triangles[0], entry);
  }
  const selected = [...unique.values()].sort((a, b) => a.lateralDistance - b.lateralDistance);
  if (selected.length < 2 || selected.length > 20) {
    const diagnostic = measurements
      .filter((entry) => entry.triangleCount >= 4 && isAircraftSide(entry))
      .sort((a, b) => a.clearanceMeters - b.clearanceMeters)
      .slice(0, 60)
      .map(diagnosticEntry);
    throw new Error(`A1 visible Tunnel-C support grounding expected 2-20 load-bearing source components, found ${selected.length}: ${JSON.stringify(diagnostic)}`);
  }

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

  // Fail closed if any remaining compact vertical aircraft-side support island
  // is still visibly suspended. This prevents a selected subset from reporting
  // success while neighboring rods hang above the ramp in the rendered view.
  const remainingMeasurements = components.map((triangles) =>
    componentMeasurement(THREE, mesh, position, triangles, rampY, rotundaWorld, cabWorld));
  const remainingSuspendedSupports = remainingMeasurements.filter((entry) => (
    isAircraftSide(entry)
    && entry.stairTriangleCount === 0
    && entry.triangleCount >= 4
    && entry.triangleCount <= 2200
    && entry.size.y >= 0.25
    && entry.size.y <= 3.20
    && entry.horizontalSpan >= 0.04
    && entry.horizontalSpan <= 1.80
    && entry.verticalAspect >= 1.05
    && entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS
    && entry.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS
  ));
  if (remainingSuspendedSupports.length) {
    throw new Error(`A1 visible Tunnel-C supports remain suspended after grounding: ${JSON.stringify(remainingSuspendedSupports.map(diagnosticEntry))}`);
  }

  return Object.freeze({
    authority: AUTHORITY,
    groundedComponentCount: selected.length,
    groundedTriangleCount: selected.reduce((sum, entry) => sum + entry.triangleCount, 0),
    detailedPodCount: detailedPods.length,
    visibleLoadLegCount: visibleLoadLegs.length,
    remainingSuspendedSupportCount: 0,
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
