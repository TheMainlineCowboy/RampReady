const AUTHORITY = "exact-supplied-tunnel-c-visible-support-components-grounded-v9-transformed-gate-anchor-plane";
const MAX_GROUNDING_EXTENSION_METERS = 4.0;
const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
const VERTEX_KEY_SCALE = 10000;
const LOWER_RIGID_FRACTION = 0.30;
const UPPER_RIGID_FRACTION = 0.76;

function vertexKey(position, index) {
  return `${Math.round(position.getX(index) * VERTEX_KEY_SCALE)},${Math.round(position.getY(index) * VERTEX_KEY_SCALE)},${Math.round(position.getZ(index) * VERTEX_KEY_SCALE)}`;
}

function findTriangleComponents(position) {
  if (!position || position.count % 3 !== 0) throw new Error(`A1 Tunnel-C visible support proof requires triangle-addressable geometry: vertices=${position?.count}`);
  const triangleCount = position.count / 3;
  const parent = new Int32Array(triangleCount);
  for (let i = 0; i < triangleCount; i += 1) parent[i] = i;
  const find = (value) => {
    let root = value;
    while (parent[root] !== root) root = parent[root];
    while (parent[value] !== value) {
      const next = parent[value]; parent[value] = root; value = next;
    }
    return root;
  };
  const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[rb] = ra; };
  const firstTriangleByVertex = new Map();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const index = triangle * 3 + corner;
      const key = vertexKey(position, index);
      const first = firstTriangleByVertex.get(key);
      if (first === undefined) firstTriangleByVertex.set(key, triangle); else union(triangle, first);
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
  return { triangles, triangleCount: triangles.length, stairTriangleCount, box, size, horizontalSpan,
    verticalAspect: size.y / Math.max(horizontalSpan, 0.01), clearanceMeters: box.min.y - rampY, alongRatio, lateralDistance };
}

function telescopeToRamp(THREE, mesh, position, measurement, rampY) {
  const beforeMinY = measurement.box.min.y;
  const beforeMaxY = measurement.box.max.y;
  const height = beforeMaxY - beforeMinY;
  const extension = beforeMinY - rampY;
  if (!(height > 0.18) || !(extension > 0) || extension > MAX_GROUNDING_EXTENSION_METERS) {
    throw new Error(`A1 visible support cannot telescope to pavement: height=${height}, extension=${extension}`);
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
  if (!mesh?.isMesh || !mesh.geometry?.getAttribute?.("position")) throw new Error("A1 visible support proof cannot resolve Tunnel_C_Jetway_0");
  const placementAnchor = model.parent;
  if (!placementAnchor?.isObject3D) throw new Error("A1 visible support proof cannot resolve the transformed gate-placement anchor");
  placementAnchor.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);
  mesh.updateWorldMatrix(true, false);

  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.geometry = geometry;
  const position = geometry.getAttribute("position");
  const components = findTriangleComponents(position);
  const rotundaWorld = objectCenter(THREE, model.getObjectByName("Rotunda"));
  const cabWorld = objectCenter(THREE, model.getObjectByName("Cab"));

  // The exact-GLB prototype is normalized to ground contact before cloning and the
  // A1 model is mounted beneath its gate-placement anchor. Therefore anchor-local
  // Y=0 is the independent pavement registration plane in whatever final parent
  // frame is active. Transform that plane to scene world space instead of assuming
  // global Y=0 or deriving ground from any Tunnel-C vertex.
  const rampReferenceWorld = placementAnchor.localToWorld(new THREE.Vector3(0, 0, 0));
  const rampY = rampReferenceWorld.y;
  if (!Number.isFinite(rampY)) throw new Error("A1 visible support proof has no finite transformed gate-anchor pavement plane");

  const isAircraftSide = (entry) => Number.isFinite(entry.alongRatio) && entry.alongRatio >= 0.35 && entry.alongRatio <= 1.05
    && Number.isFinite(entry.lateralDistance) && entry.lateralDistance <= 5.5;
  const measurements = components.map((triangles) => measureComponent(THREE, mesh, position, triangles, rampY, rotundaWorld, cabWorld));
  const visibleSupport = (entry) => isAircraftSide(entry) && entry.stairTriangleCount === 0 && entry.triangleCount >= 4
    && entry.triangleCount <= 2200 && entry.size.y >= 0.25 && entry.size.y <= 3.20 && entry.horizontalSpan >= 0.04
    && entry.horizontalSpan <= 1.80 && entry.verticalAspect >= 1.05;

  const supportSet = measurements.filter((entry) => visibleSupport(entry));
  if (supportSet.length !== 5 || supportSet.reduce((sum, entry) => sum + entry.triangleCount, 0) !== 1311) {
    throw new Error(`A1 visible support proof expected the complete five-island/1311-triangle support set, found ${supportSet.length}/${supportSet.reduce((sum, entry) => sum + entry.triangleCount, 0)}`);
  }
  const alreadyGrounded = supportSet.filter((entry) => Math.abs(entry.clearanceMeters) <= MAX_FINAL_CLEARANCE_METERS);
  const selected = supportSet.filter((entry) => entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS);
  const invalid = supportSet.filter((entry) => entry.clearanceMeters < -MAX_FINAL_CLEARANCE_METERS || entry.clearanceMeters > MAX_GROUNDING_EXTENSION_METERS);
  if (invalid.length) {
    const diagnostic = invalid.map((entry) => ({ triangles: entry.triangleCount, minimumWorldY: Number(entry.box.min.y.toFixed(3)),
      maximumWorldY: Number(entry.box.max.y.toFixed(3)), clearance: Number(entry.clearanceMeters.toFixed(3)),
      along: Number(entry.alongRatio.toFixed(3)), lateral: Number(entry.lateralDistance.toFixed(3)) }));
    throw new Error(`A1 visible support proof found support components outside the transformed gate-anchor pavement envelope rampY=${rampY.toFixed(3)}: ${JSON.stringify(diagnostic)}`);
  }

  const extensions = selected.map((entry) => telescopeToRamp(THREE, mesh, position, entry, rampY));
  position.needsUpdate = true;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  mesh.updateMatrixWorld(true); model.updateWorldMatrix(true, true);

  const finalSupportSet = supportSet.map((entry) => measureComponent(THREE, mesh, position, entry.triangles, rampY, rotundaWorld, cabWorld));
  const maximumFinalClearanceMeters = Math.max(...finalSupportSet.map((entry) => Math.abs(entry.clearanceMeters)));
  const maximumTopMountDriftMeters = selected.length ? Math.max(...selected.map((entry, index) => {
    const finalEntry = measureComponent(THREE, mesh, position, entry.triangles, rampY, rotundaWorld, cabWorld);
    return Math.abs(finalEntry.box.max.y - extensions[index].beforeTopY);
  })) : 0;
  if (maximumFinalClearanceMeters > MAX_FINAL_CLEARANCE_METERS) throw new Error(`A1 visible support proof still floats/intersects pavement: clearance=${maximumFinalClearanceMeters}`);
  if (maximumTopMountDriftMeters > MAX_TOP_MOUNT_DRIFT_METERS) throw new Error(`A1 visible support proof moved an upper mount: drift=${maximumTopMountDriftMeters}`);
  const remaining = finalSupportSet.filter((entry) => Math.abs(entry.clearanceMeters) > MAX_FINAL_CLEARANCE_METERS);
  if (remaining.length) throw new Error(`A1 visible support proof found ${remaining.length} support component(s) not seated on transformed gate-anchor pavement`);

  return Object.freeze({ authority: AUTHORITY, groundedComponentCount: supportSet.length, newlyGroundedComponentCount: selected.length,
    alreadyGroundedComponentCount: alreadyGrounded.length, groundedTriangleCount: 1311,
    detailedPodCount: supportSet.filter((entry) => entry.triangleCount >= 600).length, visibleLoadLegCount: supportSet.length,
    remainingSuspendedSupportCount: 0, maximumBeforeClearanceMeters: Math.max(...supportSet.map((entry) => entry.clearanceMeters)),
    maximumExtensionMeters: extensions.length ? Math.max(...extensions.map((entry) => entry.extensionMeters)) : 0,
    maximumFinalClearanceMeters, maximumTopMountDriftMeters, rampWorldY: rampY,
    rampReferenceComponentCount: 1, rampReferenceSpreadMeters: 0,
    rampReferenceAuthority: "transformed-uploaded-a1-gate-anchor-local-y0", componentAlongRatios: supportSet.map((entry) => entry.alongRatio),
    componentLateralDistancesMeters: supportSet.map((entry) => entry.lateralDistance) });
}

export const A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V2_AUTHORITY = AUTHORITY;
