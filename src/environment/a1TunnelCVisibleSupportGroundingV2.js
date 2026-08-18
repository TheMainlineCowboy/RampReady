const AUTHORITY = "exact-supplied-tunnel-c-visible-support-components-grounded-v14-rendered-pavement-vertex-branch-scan";
const MAX_GROUNDING_EXTENSION_METERS = 4.0;
const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
const MAX_PAVEMENT_SAMPLE_SPREAD_METERS = 0.08;
const VERTEX_KEY_SCALE = 10000;
const LOWER_RIGID_FRACTION = 0.30;
const UPPER_RIGID_FRACTION = 0.76;
const ABOVE_PAVEMENT_MARGIN_METERS = 0.02;
const PHOTO_GROUND_NAMES = Object.freeze([
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);

function vertexKeyXYZ(x, y, z) {
  return `${Math.round(x * VERTEX_KEY_SCALE)},${Math.round(y * VERTEX_KEY_SCALE)},${Math.round(z * VERTEX_KEY_SCALE)}`;
}

function vertexKey(position, index) {
  return vertexKeyXYZ(position.getX(index), position.getY(index), position.getZ(index));
}

function findTriangleComponents(position) {
  if (!position || position.count % 3 !== 0) throw new Error(`A1 Tunnel-C support proof requires triangle-addressable geometry: vertices=${position?.count}`);
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
      const key = vertexKey(position, triangle * 3 + corner);
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

function bridgeLocation(THREE, center, rotundaWorld, cabWorld) {
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
  return { alongRatio, lateralDistance };
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
    triangles,
    triangleCount: triangles.length,
    box,
    center,
    size,
    horizontalSpan,
    verticalAspect: size.y / Math.max(horizontalSpan, 0.01),
    ...bridgeLocation(THREE, center, rotundaWorld, cabWorld),
  };
}

function measureVertexIndices(THREE, mesh, position, vertexIndices, rotundaWorld, cabWorld) {
  const box = new THREE.Box3();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const index of vertexIndices) {
    local.fromBufferAttribute(position, index);
    world.copy(local).applyMatrix4(mesh.matrixWorld);
    box.expandByPoint(world);
  }
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const horizontalSpan = Math.max(size.x, size.z);
  return {
    vertexIndices,
    vertexCount: vertexIndices.length,
    box,
    center,
    size,
    horizontalSpan,
    verticalAspect: size.y / Math.max(horizontalSpan, 0.01),
    ...bridgeLocation(THREE, center, rotundaWorld, cabWorld),
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

function isAircraftSide(entry) {
  return Number.isFinite(entry.alongRatio)
    && entry.alongRatio >= 0.35
    && entry.alongRatio <= 1.08
    && Number.isFinite(entry.lateralDistance)
    && entry.lateralDistance <= 6.0;
}

function compactVerticalHardware(entry) {
  return isAircraftSide(entry)
    && entry.triangleCount >= 4
    && entry.triangleCount <= 2200
    && entry.size.y >= 0.15
    && entry.size.y <= 4.5
    && entry.horizontalSpan >= 0.02
    && entry.horizontalSpan <= 2.2
    && entry.verticalAspect >= 0.8;
}

function telescopeIndicesToRamp(THREE, mesh, position, indices, beforeMinY, beforeMaxY, rampY) {
  const height = beforeMaxY - beforeMinY;
  const extension = beforeMinY - rampY;
  if (!(height > 0.08) || !(extension > 0) || extension > MAX_GROUNDING_EXTENSION_METERS) {
    throw new Error(`A1 visible support cannot telescope to rendered pavement: height=${height}, extension=${extension}, rampY=${rampY}`);
  }
  const inverseWorld = mesh.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const index of indices) {
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
  return { extensionMeters: extension, beforeTopY: beforeMaxY };
}

function triangleVertexIndices(triangles) {
  const indices = [];
  for (const triangle of triangles) indices.push(triangle * 3, triangle * 3 + 1, triangle * 3 + 2);
  return indices;
}

function resolveAbovePavementVertexBranches(THREE, mesh, position, candidate, rotundaWorld, cabWorld) {
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  const keyToIndices = new Map();
  const parent = new Map();
  const find = (key) => {
    let root = key;
    while (parent.get(root) !== root) root = parent.get(root);
    while (parent.get(key) !== key) {
      const next = parent.get(key);
      parent.set(key, root);
      key = next;
    }
    return root;
  };
  const union = (a, b) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(rb, ra);
  };

  for (const triangle of candidate.triangles) {
    const aboveKeys = [];
    for (let corner = 0; corner < 3; corner += 1) {
      const index = triangle * 3 + corner;
      local.fromBufferAttribute(position, index);
      world.copy(local).applyMatrix4(mesh.matrixWorld);
      if (world.y <= candidate.rampY + ABOVE_PAVEMENT_MARGIN_METERS) continue;
      const key = vertexKey(position, index);
      if (!parent.has(key)) parent.set(key, key);
      if (!keyToIndices.has(key)) keyToIndices.set(key, []);
      keyToIndices.get(key).push(index);
      aboveKeys.push(key);
    }
    for (let i = 1; i < aboveKeys.length; i += 1) union(aboveKeys[0], aboveKeys[i]);
  }

  const keysByRoot = new Map();
  for (const key of parent.keys()) {
    const root = find(key);
    if (!keysByRoot.has(root)) keysByRoot.set(root, []);
    keysByRoot.get(root).push(key);
  }

  const branches = [];
  for (const keys of keysByRoot.values()) {
    const indices = [...new Set(keys.flatMap((key) => keyToIndices.get(key) || []))];
    if (indices.length < 6) continue;
    const measured = measureVertexIndices(THREE, mesh, position, indices, rotundaWorld, cabWorld);
    measured.rampY = candidate.rampY;
    measured.clearanceMeters = measured.box.min.y - measured.rampY;
    if (
      isAircraftSide(measured)
      && measured.vertexCount >= 6
      && measured.size.y >= 0.12
      && measured.size.y <= 3.5
      && measured.horizontalSpan >= 0.01
      && measured.horizontalSpan <= 1.35
      && measured.verticalAspect >= 0.9
      && measured.clearanceMeters > MAX_FINAL_CLEARANCE_METERS
      && measured.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS
    ) branches.push(measured);
  }
  return branches;
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
  const measurements = components.map((triangles) => measureTriangles(THREE, mesh, position, triangles, rotundaWorld, cabWorld));
  const candidates = measurements.filter((entry) => compactVerticalHardware(entry));
  if (!candidates.length) throw new Error("A1 visible support proof found no compact aircraft-side Tunnel-C hardware candidates");

  const highY = Math.max(...candidates.map((entry) => entry.box.max.y), 1) + 40;
  for (const entry of candidates) {
    entry.rampY = sampleRenderedPavementY(THREE, photoGround, entry.center.x, entry.center.z, highY);
    entry.clearanceMeters = entry.box.min.y - entry.rampY;
  }
  const abovePavement = candidates.filter((entry) => entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS && entry.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS);
  const alreadySeated = candidates.filter((entry) => Math.abs(entry.clearanceMeters) <= MAX_FINAL_CLEARANCE_METERS);
  const buried = candidates.filter((entry) => entry.box.max.y < entry.rampY - MAX_FINAL_CLEARANCE_METERS);
  const crossingPavement = candidates.filter((entry) => entry.box.min.y < entry.rampY - MAX_FINAL_CLEARANCE_METERS && entry.box.max.y >= entry.rampY - MAX_FINAL_CLEARANCE_METERS);
  if (!abovePavement.length) throw new Error("A1 visible support proof found no wholly suspended compact support candidates");

  const crossingBranches = crossingPavement.flatMap((entry) => resolveAbovePavementVertexBranches(THREE, mesh, position, entry, rotundaWorld, cabWorld));
  if (!crossingBranches.length) {
    throw new Error(`A1 visible support proof found no above-pavement vertex branches inside ${crossingPavement.length} mixed support components`);
  }

  const rampYs = [...abovePavement.map((entry) => entry.rampY), ...crossingBranches.map((entry) => entry.rampY)];
  const rampReferenceSpreadMeters = Math.max(...rampYs) - Math.min(...rampYs);
  if (rampReferenceSpreadMeters > MAX_PAVEMENT_SAMPLE_SPREAD_METERS) throw new Error(`A1 visible support pavement samples disagree by ${rampReferenceSpreadMeters} m`);

  const corrections = [];
  for (const entry of abovePavement) {
    const indices = triangleVertexIndices(entry.triangles);
    const result = telescopeIndicesToRamp(THREE, mesh, position, indices, entry.box.min.y, entry.box.max.y, entry.rampY);
    corrections.push({ kind: "whole", indices, rampY: entry.rampY, beforeTopY: result.beforeTopY, extensionMeters: result.extensionMeters });
  }
  for (const branch of crossingBranches) {
    const result = telescopeIndicesToRamp(THREE, mesh, position, branch.vertexIndices, branch.box.min.y, branch.box.max.y, branch.rampY);
    corrections.push({ kind: "mixed-vertex-branch", indices: branch.vertexIndices, rampY: branch.rampY, beforeTopY: result.beforeTopY, extensionMeters: result.extensionMeters });
  }

  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);

  let maximumFinalClearanceMeters = 0;
  let maximumTopMountDriftMeters = 0;
  let remainingSuspendedSupportCount = 0;
  for (const correction of corrections) {
    const measured = measureVertexIndices(THREE, mesh, position, correction.indices, rotundaWorld, cabWorld);
    const rampY = sampleRenderedPavementY(THREE, photoGround, measured.center.x, measured.center.z, highY);
    const clearance = measured.box.min.y - rampY;
    maximumFinalClearanceMeters = Math.max(maximumFinalClearanceMeters, Math.abs(clearance));
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, Math.abs(measured.box.max.y - correction.beforeTopY));
    if (Math.abs(clearance) > MAX_FINAL_CLEARANCE_METERS) remainingSuspendedSupportCount += 1;
  }
  if (maximumFinalClearanceMeters > MAX_FINAL_CLEARANCE_METERS) throw new Error(`A1 visible support proof still floats/intersects rendered pavement: clearance=${maximumFinalClearanceMeters}`);
  if (maximumTopMountDriftMeters > MAX_TOP_MOUNT_DRIFT_METERS) throw new Error(`A1 visible support proof moved an upper mount: drift=${maximumTopMountDriftMeters}`);
  if (remainingSuspendedSupportCount) throw new Error(`A1 visible support proof found ${remainingSuspendedSupportCount} corrected support set(s) still suspended`);

  return Object.freeze({
    authority: AUTHORITY,
    inspectedCandidateCount: candidates.length,
    groundedComponentCount: abovePavement.length,
    groundedTriangleCount: abovePavement.reduce((sum, entry) => sum + entry.triangleCount, 0),
    alreadyGroundedComponentCount: alreadySeated.length,
    buriedCandidateCount: buried.length,
    pavementCrossingCandidateCount: crossingPavement.length,
    crossingHangingBranchCount: crossingBranches.length,
    crossingHangingBranchVertexCount: crossingBranches.reduce((sum, entry) => sum + entry.vertexCount, 0),
    correctedSupportSetCount: corrections.length,
    visibleLoadLegCount: corrections.length,
    remainingSuspendedSupportCount,
    maximumBeforeClearanceMeters: Math.max(...abovePavement.map((entry) => entry.clearanceMeters), ...crossingBranches.map((entry) => entry.clearanceMeters)),
    maximumExtensionMeters: Math.max(...corrections.map((entry) => entry.extensionMeters)),
    maximumFinalClearanceMeters,
    maximumTopMountDriftMeters,
    rampWorldY: rampYs.reduce((sum, value) => sum + value, 0) / rampYs.length,
    rampReferenceComponentCount: rampYs.length,
    rampReferenceSpreadMeters,
    rampReferenceAuthority: "rendered-kphx-source-aerial-raycast-under-whole-and-mixed-vertex-support-branches",
    groundedTriangleCounts: abovePavement.map((entry) => entry.triangleCount),
    crossingBranchVertexCounts: crossingBranches.map((entry) => entry.vertexCount),
  });
}

export const A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V2_AUTHORITY = AUTHORITY;
