const AUTHORITY = "exact-supplied-tunnel-c-visible-support-components-grounded-v12-rendered-pavement-suspended-set";
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
  for (const triangle of triangles) {
    const base = triangle * 3;
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
    box,
    center,
    size,
    horizontalSpan,
    verticalAspect: size.y / Math.max(horizontalSpan, 0.01),
    alongRatio,
    lateralDistance,
  };
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
    throw new Error(`A1 visible support proof found no rendered KPHX pavement under x=${x.toFixed(3)} z=${z.toFixed(3)}`);
  }
  return hit.point.y;
}

function telescopeToRamp(THREE, mesh, position, measurement, rampY) {
  const beforeMinY = measurement.box.min.y;
  const beforeMaxY = measurement.box.max.y;
  const height = beforeMaxY - beforeMinY;
  const extension = beforeMinY - rampY;
  if (!(height > 0.15) || !(extension > 0) || extension > MAX_GROUNDING_EXTENSION_METERS) {
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

  const isAircraftSide = (entry) => Number.isFinite(entry.alongRatio)
    && entry.alongRatio >= 0.35
    && entry.alongRatio <= 1.08
    && Number.isFinite(entry.lateralDistance)
    && entry.lateralDistance <= 6.0;
  const compactVerticalHardware = (entry) => isAircraftSide(entry)
    && entry.triangleCount >= 4
    && entry.triangleCount <= 2200
    && entry.size.y >= 0.15
    && entry.size.y <= 4.5
    && entry.horizontalSpan >= 0.02
    && entry.horizontalSpan <= 2.2
    && entry.verticalAspect >= 0.8;

  const measurements = components.map((triangles) => measureComponent(THREE, mesh, position, triangles, rotundaWorld, cabWorld));
  const candidates = measurements.filter((entry) => compactVerticalHardware(entry));
  if (!candidates.length) throw new Error("A1 visible support proof found no compact aircraft-side Tunnel-C hardware candidates");
  const highY = Math.max(...candidates.map((entry) => entry.box.max.y), 1) + 40;
  for (const entry of candidates) {
    entry.rampY = sampleRenderedPavementY(THREE, photoGround, entry.center.x, entry.center.z, highY);
    entry.clearanceMeters = entry.box.min.y - entry.rampY;
  }

  const abovePavement = candidates.filter((entry) => entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS
    && entry.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS);
  const alreadySeated = candidates.filter((entry) => Math.abs(entry.clearanceMeters) <= MAX_FINAL_CLEARANCE_METERS);
  const buried = candidates.filter((entry) => entry.box.max.y < entry.rampY - MAX_FINAL_CLEARANCE_METERS);
  const crossingPavement = candidates.filter((entry) => entry.box.min.y < entry.rampY - MAX_FINAL_CLEARANCE_METERS
    && entry.box.max.y >= entry.rampY - MAX_FINAL_CLEARANCE_METERS);

  if (!abovePavement.length) {
    const diagnostic = candidates.map((entry) => ({
      triangles: entry.triangleCount,
      minY: Number(entry.box.min.y.toFixed(3)),
      maxY: Number(entry.box.max.y.toFixed(3)),
      pavementY: Number(entry.rampY.toFixed(3)),
      clearance: Number(entry.clearanceMeters.toFixed(3)),
      height: Number(entry.size.y.toFixed(3)),
      horizontal: Number(entry.horizontalSpan.toFixed(3)),
      aspect: Number(entry.verticalAspect.toFixed(3)),
      along: Number(entry.alongRatio.toFixed(3)),
      lateral: Number(entry.lateralDistance.toFixed(3)),
    }));
    throw new Error(`A1 visible support proof found no above-pavement compact support candidate; candidates=${JSON.stringify(diagnostic)}`);
  }

  const rampYs = abovePavement.map((entry) => entry.rampY);
  const rampReferenceSpreadMeters = Math.max(...rampYs) - Math.min(...rampYs);
  if (rampReferenceSpreadMeters > MAX_PAVEMENT_SAMPLE_SPREAD_METERS) {
    throw new Error(`A1 visible support rendered pavement samples disagree by ${rampReferenceSpreadMeters} m: ${JSON.stringify(rampYs)}`);
  }

  const extensionByTriangles = new Map();
  for (const entry of abovePavement) {
    extensionByTriangles.set(entry.triangles, telescopeToRamp(THREE, mesh, position, entry, entry.rampY));
  }
  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);

  const finalCandidates = candidates.map((entry) => {
    const measured = measureComponent(THREE, mesh, position, entry.triangles, rotundaWorld, cabWorld);
    measured.rampY = sampleRenderedPavementY(THREE, photoGround, measured.center.x, measured.center.z, highY);
    measured.clearanceMeters = measured.box.min.y - measured.rampY;
    return measured;
  });
  const finalGrounded = finalCandidates.filter((entry) => extensionByTriangles.has(entry.triangles));
  const remainingSuspended = finalCandidates.filter((entry) => compactVerticalHardware(entry)
    && entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS
    && entry.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS);
  const maximumFinalClearanceMeters = Math.max(...finalGrounded.map((entry) => Math.abs(entry.clearanceMeters)));
  let maximumTopMountDriftMeters = 0;
  for (const finalEntry of finalGrounded) {
    const extension = extensionByTriangles.get(finalEntry.triangles);
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, Math.abs(finalEntry.box.max.y - extension.beforeTopY));
  }
  if (maximumFinalClearanceMeters > MAX_FINAL_CLEARANCE_METERS) {
    throw new Error(`A1 visible support proof still floats/intersects rendered pavement: clearance=${maximumFinalClearanceMeters}`);
  }
  if (maximumTopMountDriftMeters > MAX_TOP_MOUNT_DRIFT_METERS) {
    throw new Error(`A1 visible support proof moved an upper mount: drift=${maximumTopMountDriftMeters}`);
  }
  if (remainingSuspended.length) {
    throw new Error(`A1 visible support proof found ${remainingSuspended.length} compact aircraft-side component(s) still suspended after grounding`);
  }

  return Object.freeze({
    authority: AUTHORITY,
    inspectedCandidateCount: candidates.length,
    groundedComponentCount: abovePavement.length,
    groundedTriangleCount: abovePavement.reduce((sum, entry) => sum + entry.triangleCount, 0),
    alreadyGroundedComponentCount: alreadySeated.length,
    buriedCandidateCount: buried.length,
    pavementCrossingCandidateCount: crossingPavement.length,
    visibleLoadLegCount: abovePavement.length,
    remainingSuspendedSupportCount: 0,
    maximumBeforeClearanceMeters: Math.max(...abovePavement.map((entry) => entry.clearanceMeters)),
    maximumExtensionMeters: Math.max(...abovePavement.map((entry) => extensionByTriangles.get(entry.triangles).extensionMeters)),
    maximumFinalClearanceMeters,
    maximumTopMountDriftMeters,
    rampWorldY: rampYs.reduce((sum, value) => sum + value, 0) / rampYs.length,
    rampReferenceComponentCount: rampYs.length,
    rampReferenceSpreadMeters,
    rampReferenceAuthority: "rendered-kphx-source-aerial-raycast-under-suspended-compact-hardware",
    groundedTriangleCounts: abovePavement.map((entry) => entry.triangleCount),
    componentRampWorldYs: rampYs,
  });
}

export const A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V2_AUTHORITY = AUTHORITY;
