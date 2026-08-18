const AUTHORITY = "exact-supplied-tunnel-c-visible-support-components-grounded-v11-rendered-kphx-pavement-raycast";
const MAX_GROUNDING_EXTENSION_METERS = 4.0;
const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
const MAX_PAVEMENT_SAMPLE_SPREAD_METERS = 0.08;
const VERTEX_KEY_SCALE = 10000;
const LOWER_RIGID_FRACTION = 0.30;
const UPPER_RIGID_FRACTION = 0.76;
const PHOTO_GROUND_NAMES = Object.freeze([
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);

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

function measureComponent(THREE, mesh, position, triangles, rotundaWorld, cabWorld) {
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
  return { triangles, triangleCount: triangles.length, stairTriangleCount, box, center, size, horizontalSpan,
    verticalAspect: size.y / Math.max(horizontalSpan, 0.01), alongRatio, lateralDistance };
}

function resolveSceneRoot(object) {
  let root = object;
  while (root?.parent) root = root.parent;
  return root;
}

function resolveRenderedPhotoGround(root) {
  for (const name of PHOTO_GROUND_NAMES) {
    const found = root?.getObjectByName?.(name);
    if (found) return found;
  }
  throw new Error(`A1 visible support proof cannot resolve rendered KPHX pavement object (${PHOTO_GROUND_NAMES.join(" or ")})`);
}

function sampleRenderedPavementY(THREE, photoGround, x, z, highY) {
  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, highY, z), new THREE.Vector3(0, -1, 0));
  raycaster.near = 0;
  raycaster.far = 200;
  const hit = raycaster.intersectObject(photoGround, true)[0];
  if (!hit?.point || !Number.isFinite(hit.point.y)) {
    throw new Error(`A1 visible support proof found no rendered KPHX pavement under support x=${x.toFixed(3)} z=${z.toFixed(3)}`);
  }
  return hit.point.y;
}

function telescopeToRamp(THREE, mesh, position, measurement, rampY) {
  const beforeMinY = measurement.box.min.y;
  const beforeMaxY = measurement.box.max.y;
  const height = beforeMaxY - beforeMinY;
  const extension = beforeMinY - rampY;
  if (!(height > 0.18) || !(extension > 0) || extension > MAX_GROUNDING_EXTENSION_METERS) {
    throw new Error(`A1 visible support cannot telescope to rendered pavement: height=${height}, extension=${extension}, rampY=${rampY}`);
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
  const sceneRoot = resolveSceneRoot(model);
  const photoGround = resolveRenderedPhotoGround(sceneRoot);
  sceneRoot.updateWorldMatrix?.(true, true);
  photoGround.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);
  mesh.updateWorldMatrix(true, false);

  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.geometry = geometry;
  const position = geometry.getAttribute("position");
  const components = findTriangleComponents(position);
  const rotundaWorld = objectCenter(THREE, model.getObjectByName("Rotunda"));
  const cabWorld = objectCenter(THREE, model.getObjectByName("Cab"));
  const isAircraftSide = (entry) => Number.isFinite(entry.alongRatio) && entry.alongRatio >= 0.35 && entry.alongRatio <= 1.05
    && Number.isFinite(entry.lateralDistance) && entry.lateralDistance <= 5.5;
  const visibleSupport = (entry) => isAircraftSide(entry) && entry.stairTriangleCount === 0 && entry.triangleCount >= 4
    && entry.triangleCount <= 2200 && entry.size.y >= 0.25 && entry.size.y <= 3.20 && entry.horizontalSpan >= 0.04
    && entry.horizontalSpan <= 1.80 && entry.verticalAspect >= 1.05;

  const measurements = components.map((triangles) => measureComponent(THREE, mesh, position, triangles, rotundaWorld, cabWorld));
  const supportSet = measurements.filter((entry) => visibleSupport(entry));
  const supportTriangleCount = supportSet.reduce((sum, entry) => sum + entry.triangleCount, 0);
  if (supportSet.length !== 5 || supportTriangleCount !== 1311) {
    throw new Error(`A1 visible support proof expected the complete five-island/1311-triangle support set, found ${supportSet.length}/${supportTriangleCount}`);
  }

  const highY = Math.max(...supportSet.map((entry) => entry.box.max.y)) + 40;
  for (const entry of supportSet) {
    entry.rampY = sampleRenderedPavementY(THREE, photoGround, entry.center.x, entry.center.z, highY);
    entry.clearanceMeters = entry.box.min.y - entry.rampY;
  }
  const rampYs = supportSet.map((entry) => entry.rampY);
  const rampMinimumY = Math.min(...rampYs);
  const rampMaximumY = Math.max(...rampYs);
  const rampReferenceSpreadMeters = rampMaximumY - rampMinimumY;
  if (rampReferenceSpreadMeters > MAX_PAVEMENT_SAMPLE_SPREAD_METERS) {
    throw new Error(`A1 visible support rendered pavement samples disagree by ${rampReferenceSpreadMeters} m: ${JSON.stringify(rampYs)}`);
  }

  const alreadyGrounded = supportSet.filter((entry) => Math.abs(entry.clearanceMeters) <= MAX_FINAL_CLEARANCE_METERS);
  const selected = supportSet.filter((entry) => entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS);
  const invalid = supportSet.filter((entry) => entry.clearanceMeters < -MAX_FINAL_CLEARANCE_METERS || entry.clearanceMeters > MAX_GROUNDING_EXTENSION_METERS);
  if (invalid.length) {
    const diagnostic = invalid.map((entry) => ({ triangles: entry.triangleCount, minimumWorldY: Number(entry.box.min.y.toFixed(3)),
      pavementWorldY: Number(entry.rampY.toFixed(3)), clearance: Number(entry.clearanceMeters.toFixed(3)),
      along: Number(entry.alongRatio.toFixed(3)), lateral: Number(entry.lateralDistance.toFixed(3)) }));
    throw new Error(`A1 visible support proof found support components outside the rendered KPHX pavement envelope: ${JSON.stringify(diagnostic)}`);
  }

  const extensionByTriangles = new Map();
  for (const entry of selected) extensionByTriangles.set(entry.triangles, telescopeToRamp(THREE, mesh, position, entry, entry.rampY));
  position.needsUpdate = true;
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  mesh.updateMatrixWorld(true); model.updateWorldMatrix(true, true);

  const finalSupportSet = supportSet.map((entry) => {
    const measured = measureComponent(THREE, mesh, position, entry.triangles, rotundaWorld, cabWorld);
    measured.rampY = sampleRenderedPavementY(THREE, photoGround, measured.center.x, measured.center.z, highY);
    measured.clearanceMeters = measured.box.min.y - measured.rampY;
    return measured;
  });
  const maximumFinalClearanceMeters = Math.max(...finalSupportSet.map((entry) => Math.abs(entry.clearanceMeters)));
  let maximumTopMountDriftMeters = 0;
  for (const finalEntry of finalSupportSet) {
    const extension = extensionByTriangles.get(finalEntry.triangles);
    if (!extension) continue;
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, Math.abs(finalEntry.box.max.y - extension.beforeTopY));
  }
  if (maximumFinalClearanceMeters > MAX_FINAL_CLEARANCE_METERS) throw new Error(`A1 visible support proof still floats/intersects rendered pavement: clearance=${maximumFinalClearanceMeters}`);
  if (maximumTopMountDriftMeters > MAX_TOP_MOUNT_DRIFT_METERS) throw new Error(`A1 visible support proof moved an upper mount: drift=${maximumTopMountDriftMeters}`);
  const remaining = finalSupportSet.filter((entry) => Math.abs(entry.clearanceMeters) > MAX_FINAL_CLEARANCE_METERS);
  if (remaining.length) throw new Error(`A1 visible support proof found ${remaining.length} support component(s) not seated on rendered KPHX pavement`);

  return Object.freeze({ authority: AUTHORITY, groundedComponentCount: supportSet.length, newlyGroundedComponentCount: selected.length,
    alreadyGroundedComponentCount: alreadyGrounded.length, groundedTriangleCount: 1311,
    detailedPodCount: supportSet.filter((entry) => entry.triangleCount >= 600).length, visibleLoadLegCount: supportSet.length,
    remainingSuspendedSupportCount: 0, maximumBeforeClearanceMeters: Math.max(...supportSet.map((entry) => entry.clearanceMeters)),
    maximumExtensionMeters: selected.length ? Math.max(...selected.map((entry) => extensionByTriangles.get(entry.triangles).extensionMeters)) : 0,
    maximumFinalClearanceMeters, maximumTopMountDriftMeters,
    rampWorldY: rampYs.reduce((sum, value) => sum + value, 0) / rampYs.length,
    rampReferenceComponentCount: rampYs.length, rampReferenceSpreadMeters,
    rampReferenceAuthority: "rendered-kphx-source-aerial-raycast-under-visible-supports",
    componentRampWorldYs: rampYs,
    componentAlongRatios: supportSet.map((entry) => entry.alongRatio),
    componentLateralDistancesMeters: supportSet.map((entry) => entry.lateralDistance) });
}

export const A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V2_AUTHORITY = AUTHORITY;
