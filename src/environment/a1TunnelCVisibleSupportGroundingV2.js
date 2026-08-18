const AUTHORITY = "exact-supplied-tunnel-c-visible-support-components-grounded-v15-rendered-pavement-spatial-rod-clusters";
const MAX_GROUNDING_EXTENSION_METERS = 4.0;
const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
const MAX_PAVEMENT_SAMPLE_SPREAD_METERS = 0.08;
const VERTEX_KEY_SCALE = 10000;
const LOWER_RIGID_FRACTION = 0.30;
const UPPER_RIGID_FRACTION = 0.76;
const ABOVE_PAVEMENT_MARGIN_METERS = 0.02;
const HORIZONTAL_CLUSTER_RADIUS_METERS = 0.24;
const PHOTO_GROUND_NAMES = Object.freeze([
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);

function vertexKey(position, index) {
  return `${Math.round(position.getX(index) * VERTEX_KEY_SCALE)},${Math.round(position.getY(index) * VERTEX_KEY_SCALE)},${Math.round(position.getZ(index) * VERTEX_KEY_SCALE)}`;
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
  return { triangles, triangleCount: triangles.length, box, center, size, horizontalSpan,
    verticalAspect: size.y / Math.max(horizontalSpan, 0.01), ...bridgeLocation(THREE, center, rotundaWorld, cabWorld) };
}

function measureIndices(THREE, mesh, position, indices, rotundaWorld, cabWorld) {
  const box = new THREE.Box3();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const index of indices) {
    local.fromBufferAttribute(position, index);
    world.copy(local).applyMatrix4(mesh.matrixWorld);
    box.expandByPoint(world);
  }
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  const horizontalSpan = Math.max(size.x, size.z);
  return { indices, vertexCount: indices.length, box, center, size, horizontalSpan,
    verticalAspect: size.y / Math.max(horizontalSpan, 0.01), ...bridgeLocation(THREE, center, rotundaWorld, cabWorld) };
}

function resolveSceneRoot(object) { let root = object; while (root?.parent) root = root.parent; return root; }
function resolveRenderedPhotoGround(root) {
  for (const name of PHOTO_GROUND_NAMES) { const found = root?.getObjectByName?.(name); if (found) return found; }
  throw new Error(`A1 visible support proof cannot resolve rendered KPHX pavement object (${PHOTO_GROUND_NAMES.join(" or ")})`);
}
function sampleRenderedPavementY(THREE, photoGround, x, z, highY) {
  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, highY, z), new THREE.Vector3(0, -1, 0));
  raycaster.near = 0; raycaster.far = 200;
  const hit = raycaster.intersectObject(photoGround, true)[0];
  if (!hit?.point || !Number.isFinite(hit.point.y)) throw new Error(`A1 visible support proof found no rendered KPHX pavement under x=${x.toFixed(3)} z=${z.toFixed(3)}`);
  return hit.point.y;
}
function isAircraftSide(entry) {
  return Number.isFinite(entry.alongRatio) && entry.alongRatio >= 0.35 && entry.alongRatio <= 1.08
    && Number.isFinite(entry.lateralDistance) && entry.lateralDistance <= 6.0;
}
function compactVerticalHardware(entry) {
  return isAircraftSide(entry) && entry.triangleCount >= 4 && entry.triangleCount <= 2200
    && entry.size.y >= 0.15 && entry.size.y <= 4.5 && entry.horizontalSpan >= 0.02
    && entry.horizontalSpan <= 2.2 && entry.verticalAspect >= 0.8;
}
function triangleVertexIndices(triangles) { const out = []; for (const t of triangles) out.push(t * 3, t * 3 + 1, t * 3 + 2); return out; }

function telescopeIndicesToRamp(THREE, mesh, position, indices, beforeMinY, beforeMaxY, rampY) {
  const height = beforeMaxY - beforeMinY;
  const extension = beforeMinY - rampY;
  if (!(height > 0.08) || !(extension > 0) || extension > MAX_GROUNDING_EXTENSION_METERS) throw new Error(`A1 visible support cannot telescope to rendered pavement: height=${height}, extension=${extension}`);
  const inverseWorld = mesh.matrixWorld.clone().invert();
  const local = new THREE.Vector3(); const world = new THREE.Vector3();
  for (const index of indices) {
    local.fromBufferAttribute(position, index); world.copy(local).applyMatrix4(mesh.matrixWorld);
    const fraction = Math.max(0, Math.min(1, (world.y - beforeMinY) / height));
    let downward = 0;
    if (fraction <= LOWER_RIGID_FRACTION) downward = extension;
    else if (fraction < UPPER_RIGID_FRACTION) {
      const blend = (fraction - LOWER_RIGID_FRACTION) / (UPPER_RIGID_FRACTION - LOWER_RIGID_FRACTION);
      downward = extension * (1 - blend);
    }
    world.y -= downward; local.copy(world).applyMatrix4(inverseWorld); position.setXYZ(index, local.x, local.y, local.z);
  }
  return { extensionMeters: extension, beforeTopY: beforeMaxY };
}

function resolveSpatialRodClusters(THREE, mesh, position, crossingCandidates, rotundaWorld, cabWorld) {
  const local = new THREE.Vector3(); const world = new THREE.Vector3();
  const samples = [];
  for (const candidate of crossingCandidates) {
    for (const index of triangleVertexIndices(candidate.triangles)) {
      local.fromBufferAttribute(position, index); world.copy(local).applyMatrix4(mesh.matrixWorld);
      if (world.y <= candidate.rampY + ABOVE_PAVEMENT_MARGIN_METERS) continue;
      samples.push({ index, x: world.x, y: world.y, z: world.z, rampY: candidate.rampY });
    }
  }
  if (!samples.length) return [];

  const parent = new Int32Array(samples.length); for (let i = 0; i < parent.length; i += 1) parent[i] = i;
  const find = (v) => { let r = v; while (parent[r] !== r) r = parent[r]; while (parent[v] !== v) { const n = parent[v]; parent[v] = r; v = n; } return r; };
  const union = (a, b) => { const ra = find(a); const rb = find(b); if (ra !== rb) parent[rb] = ra; };
  const radius2 = HORIZONTAL_CLUSTER_RADIUS_METERS * HORIZONTAL_CLUSTER_RADIUS_METERS;
  for (let i = 0; i < samples.length; i += 1) {
    for (let j = i + 1; j < samples.length; j += 1) {
      const dx = samples[i].x - samples[j].x; const dz = samples[i].z - samples[j].z;
      if (dx * dx + dz * dz <= radius2) union(i, j);
    }
  }
  const groups = new Map();
  for (let i = 0; i < samples.length; i += 1) { const r = find(i); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(samples[i]); }

  const clusters = [];
  for (const group of groups.values()) {
    const indices = [...new Set(group.map((s) => s.index))];
    if (indices.length < 6) continue;
    const measured = measureIndices(THREE, mesh, position, indices, rotundaWorld, cabWorld);
    measured.rampY = group.reduce((sum, s) => sum + s.rampY, 0) / group.length;
    measured.clearanceMeters = measured.box.min.y - measured.rampY;
    if (isAircraftSide(measured) && measured.vertexCount >= 6 && measured.size.y >= 0.18 && measured.size.y <= 3.6
      && measured.horizontalSpan >= 0.015 && measured.horizontalSpan <= 0.65 && measured.verticalAspect >= 1.35
      && measured.clearanceMeters > MAX_FINAL_CLEARANCE_METERS && measured.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS) clusters.push(measured);
  }
  return clusters;
}

export function groundA1TunnelCVisibleSupportHardwareV2(THREE, model) {
  const mesh = model?.getObjectByName?.("Tunnel_C_Jetway_0");
  if (!mesh?.isMesh || !mesh.geometry?.getAttribute?.("position")) throw new Error("A1 visible support proof cannot resolve Tunnel_C_Jetway_0");
  const sceneRoot = resolveSceneRoot(model); const photoGround = resolveRenderedPhotoGround(sceneRoot);
  sceneRoot.updateWorldMatrix?.(true, true); photoGround.updateWorldMatrix?.(true, true); model.updateWorldMatrix(true, true); mesh.updateWorldMatrix(true, false);
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone(); mesh.geometry = geometry;
  const position = geometry.getAttribute("position"); const components = findTriangleComponents(position);
  const rotundaWorld = objectCenter(THREE, model.getObjectByName("Rotunda")); const cabWorld = objectCenter(THREE, model.getObjectByName("Cab"));
  const measurements = components.map((triangles) => measureTriangles(THREE, mesh, position, triangles, rotundaWorld, cabWorld));
  const candidates = measurements.filter(compactVerticalHardware);
  if (!candidates.length) throw new Error("A1 visible support proof found no compact aircraft-side Tunnel-C hardware candidates");
  const highY = Math.max(...candidates.map((e) => e.box.max.y), 1) + 40;
  for (const entry of candidates) { entry.rampY = sampleRenderedPavementY(THREE, photoGround, entry.center.x, entry.center.z, highY); entry.clearanceMeters = entry.box.min.y - entry.rampY; }
  const abovePavement = candidates.filter((e) => e.clearanceMeters > MAX_FINAL_CLEARANCE_METERS && e.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS);
  const alreadySeated = candidates.filter((e) => Math.abs(e.clearanceMeters) <= MAX_FINAL_CLEARANCE_METERS);
  const buried = candidates.filter((e) => e.box.max.y < e.rampY - MAX_FINAL_CLEARANCE_METERS);
  const crossingPavement = candidates.filter((e) => e.box.min.y < e.rampY - MAX_FINAL_CLEARANCE_METERS && e.box.max.y >= e.rampY - MAX_FINAL_CLEARANCE_METERS);
  if (!abovePavement.length) throw new Error("A1 visible support proof found no wholly suspended compact support candidates");

  const spatialRodClusters = resolveSpatialRodClusters(THREE, mesh, position, crossingPavement, rotundaWorld, cabWorld);
  if (!spatialRodClusters.length) {
    const diagnostic = crossingPavement.map((e) => ({ triangles: e.triangleCount, minY: Number(e.box.min.y.toFixed(3)), maxY: Number(e.box.max.y.toFixed(3)), horizontal: Number(e.horizontalSpan.toFixed(3)), aspect: Number(e.verticalAspect.toFixed(3)) }));
    throw new Error(`A1 visible support proof found no spatial rod clusters inside mixed support components: ${JSON.stringify(diagnostic)}`);
  }

  const rampYs = [...abovePavement.map((e) => e.rampY), ...spatialRodClusters.map((e) => e.rampY)];
  const rampReferenceSpreadMeters = Math.max(...rampYs) - Math.min(...rampYs);
  if (rampReferenceSpreadMeters > MAX_PAVEMENT_SAMPLE_SPREAD_METERS) throw new Error(`A1 visible support pavement samples disagree by ${rampReferenceSpreadMeters} m`);
  const corrections = [];
  for (const entry of abovePavement) {
    const indices = triangleVertexIndices(entry.triangles); const result = telescopeIndicesToRamp(THREE, mesh, position, indices, entry.box.min.y, entry.box.max.y, entry.rampY);
    corrections.push({ kind: "whole", indices, beforeTopY: result.beforeTopY, extensionMeters: result.extensionMeters });
  }
  for (const rod of spatialRodClusters) {
    const result = telescopeIndicesToRamp(THREE, mesh, position, rod.indices, rod.box.min.y, rod.box.max.y, rod.rampY);
    corrections.push({ kind: "spatial-rod", indices: rod.indices, beforeTopY: result.beforeTopY, extensionMeters: result.extensionMeters });
  }
  position.needsUpdate = true; geometry.computeBoundingBox(); geometry.computeBoundingSphere(); mesh.updateMatrixWorld(true); model.updateWorldMatrix(true, true);

  let maximumFinalClearanceMeters = 0; let maximumTopMountDriftMeters = 0; let remainingSuspendedSupportCount = 0;
  for (const correction of corrections) {
    const measured = measureIndices(THREE, mesh, position, correction.indices, rotundaWorld, cabWorld);
    const rampY = sampleRenderedPavementY(THREE, photoGround, measured.center.x, measured.center.z, highY);
    const clearance = measured.box.min.y - rampY;
    maximumFinalClearanceMeters = Math.max(maximumFinalClearanceMeters, Math.abs(clearance));
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, Math.abs(measured.box.max.y - correction.beforeTopY));
    if (Math.abs(clearance) > MAX_FINAL_CLEARANCE_METERS) remainingSuspendedSupportCount += 1;
  }
  if (maximumFinalClearanceMeters > MAX_FINAL_CLEARANCE_METERS) throw new Error(`A1 visible support proof still floats/intersects rendered pavement: clearance=${maximumFinalClearanceMeters}`);
  if (maximumTopMountDriftMeters > MAX_TOP_MOUNT_DRIFT_METERS) throw new Error(`A1 visible support proof moved an upper mount: drift=${maximumTopMountDriftMeters}`);
  if (remainingSuspendedSupportCount) throw new Error(`A1 visible support proof found ${remainingSuspendedSupportCount} corrected support set(s) still suspended`);

  return Object.freeze({ authority: AUTHORITY, inspectedCandidateCount: candidates.length, groundedComponentCount: abovePavement.length,
    groundedTriangleCount: abovePavement.reduce((s,e)=>s+e.triangleCount,0), alreadyGroundedComponentCount: alreadySeated.length,
    buriedCandidateCount: buried.length, pavementCrossingCandidateCount: crossingPavement.length,
    spatialRodClusterCount: spatialRodClusters.length, spatialRodVertexCount: spatialRodClusters.reduce((s,e)=>s+e.vertexCount,0),
    correctedSupportSetCount: corrections.length, visibleLoadLegCount: corrections.length, remainingSuspendedSupportCount,
    maximumBeforeClearanceMeters: Math.max(...abovePavement.map((e)=>e.clearanceMeters), ...spatialRodClusters.map((e)=>e.clearanceMeters)),
    maximumExtensionMeters: Math.max(...corrections.map((e)=>e.extensionMeters)), maximumFinalClearanceMeters, maximumTopMountDriftMeters,
    rampWorldY: rampYs.reduce((s,v)=>s+v,0)/rampYs.length, rampReferenceComponentCount: rampYs.length, rampReferenceSpreadMeters,
    rampReferenceAuthority: "rendered-kphx-source-aerial-raycast-under-whole-and-spatial-rod-supports",
    spatialRodCenters: spatialRodClusters.map((e)=>[e.center.x,e.center.y,e.center.z]), spatialRodSpans: spatialRodClusters.map((e)=>e.horizontalSpan) });
}

export const A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V2_AUTHORITY = AUTHORITY;
