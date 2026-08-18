const AUTHORITY = "exact-supplied-tunnel-c-visible-support-components-grounded-v16-rendered-pavement-triangle-rod-clusters";
const SECONDARY_AUTHORITY = "a1-visible-support-all-rendered-mesh-secondary-scan-v1";
const RAMP_AUTHORITY = "rendered-kphx-source-aerial-raycast-under-whole-and-all-rendered-mesh-supports";
const MAX_GROUNDING_EXTENSION_METERS = 4.0;
const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
const MAX_PAVEMENT_SAMPLE_SPREAD_METERS = 0.08;
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
  if (!position || position.count % 3 !== 0) {
    throw new Error(`A1 visible-support all-mesh scan requires triangle-addressable geometry: vertices=${position?.count}`);
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
  throw new Error(`A1 visible-support all-mesh scan cannot resolve rendered KPHX pavement (${PHOTO_GROUND_NAMES.join(" or ")})`);
}

function sampleRenderedPavementY(THREE, photoGround, x, z, highY) {
  const raycaster = new THREE.Raycaster();
  raycaster.set(new THREE.Vector3(x, highY, z), new THREE.Vector3(0, -1, 0));
  raycaster.near = 0;
  raycaster.far = 200;
  const hit = raycaster.intersectObject(photoGround, true)[0];
  if (!hit?.point || !Number.isFinite(hit.point.y)) {
    throw new Error(`A1 visible-support all-mesh scan found no rendered pavement under x=${x.toFixed(3)} z=${z.toFixed(3)}`);
  }
  return hit.point.y;
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
    mesh,
    meshName: mesh.name || "<unnamed>",
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

function isAircraftSide(entry) {
  return Number.isFinite(entry.alongRatio)
    && entry.alongRatio >= 0.35
    && entry.alongRatio <= 1.10
    && Number.isFinite(entry.lateralDistance)
    && entry.lateralDistance <= 6.0;
}

function primaryCompactHardware(entry) {
  return isAircraftSide(entry)
    && entry.triangleCount >= 4
    && entry.triangleCount <= 2200
    && entry.size.y >= 0.15
    && entry.size.y <= 4.5
    && entry.horizontalSpan >= 0.02
    && entry.horizontalSpan <= 2.2
    && entry.verticalAspect >= 0.8;
}

function secondarySupportHardware(entry) {
  return isAircraftSide(entry)
    && entry.triangleCount >= 2
    && entry.triangleCount <= 2200
    && entry.size.y >= 0.18
    && entry.size.y <= 4.0
    && entry.horizontalSpan >= 0.015
    && entry.horizontalSpan <= 0.95
    && entry.verticalAspect >= 1.05;
}

function triangleVertexIndices(triangles) {
  const out = [];
  for (const triangle of triangles) out.push(triangle * 3, triangle * 3 + 1, triangle * 3 + 2);
  return [...new Set(out)];
}

function telescopeComponentToRamp(THREE, mesh, position, entry, rampY) {
  const beforeMinY = entry.box.min.y;
  const beforeMaxY = entry.box.max.y;
  const height = beforeMaxY - beforeMinY;
  const extension = beforeMinY - rampY;
  if (!(height > 0.08) || !(extension > 0) || extension > MAX_GROUNDING_EXTENSION_METERS) {
    throw new Error(`A1 visible support ${entry.meshName} cannot telescope: height=${height}, extension=${extension}`);
  }
  const inverseWorld = mesh.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const index of triangleVertexIndices(entry.triangles)) {
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
  return { beforeTopY: beforeMaxY, extensionMeters: extension };
}

function cloneMeshGeometryForMutation(mesh) {
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  mesh.geometry = geometry;
  return geometry;
}

function diagnosticEntry(entry) {
  return {
    mesh: entry.meshName,
    triangles: entry.triangleCount,
    minY: Number(entry.box.min.y.toFixed(3)),
    maxY: Number(entry.box.max.y.toFixed(3)),
    horizontal: Number(entry.horizontalSpan.toFixed(3)),
    aspect: Number(entry.verticalAspect.toFixed(2)),
    along: Number.isFinite(entry.alongRatio) ? Number(entry.alongRatio.toFixed(3)) : null,
    lateral: Number.isFinite(entry.lateralDistance) ? Number(entry.lateralDistance.toFixed(3)) : null,
    clearance: Number.isFinite(entry.clearanceMeters) ? Number(entry.clearanceMeters.toFixed(3)) : null,
  };
}

export function groundA1TunnelCVisibleSupportHardwareV3(THREE, model) {
  const primaryMesh = model?.getObjectByName?.("Tunnel_C_Jetway_0");
  if (!primaryMesh?.isMesh || !primaryMesh.geometry?.getAttribute?.("position")) {
    throw new Error("A1 visible-support all-mesh scan cannot resolve Tunnel_C_Jetway_0");
  }
  const sceneRoot = resolveSceneRoot(model);
  const photoGround = resolveRenderedPhotoGround(sceneRoot);
  sceneRoot.updateWorldMatrix?.(true, true);
  photoGround.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);
  const rotundaWorld = objectCenter(THREE, model.getObjectByName("Rotunda"));
  const cabWorld = objectCenter(THREE, model.getObjectByName("Cab"));

  // First retain the proven primary Tunnel-C classification: 25 compact islands,
  // five wholly suspended (590 triangles), twelve buried and eight pavement-crossing.
  const primaryGeometry = cloneMeshGeometryForMutation(primaryMesh);
  primaryMesh.updateWorldMatrix(true, false);
  const primaryPosition = primaryGeometry.getAttribute("position");
  const primaryComponents = findTriangleComponents(primaryPosition);
  const primaryMeasurements = primaryComponents.map((triangles) =>
    measureTriangles(THREE, primaryMesh, primaryPosition, triangles, rotundaWorld, cabWorld));
  const primaryCandidates = primaryMeasurements.filter(primaryCompactHardware);
  if (!primaryCandidates.length) throw new Error("A1 all-mesh support proof found no primary compact Tunnel-C hardware");
  const highY = Math.max(...primaryCandidates.map((entry) => entry.box.max.y), 1) + 40;
  for (const entry of primaryCandidates) {
    entry.rampY = sampleRenderedPavementY(THREE, photoGround, entry.center.x, entry.center.z, highY);
    entry.clearanceMeters = entry.box.min.y - entry.rampY;
  }
  const primarySuspended = primaryCandidates.filter((entry) =>
    entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS && entry.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS);
  const primarySeated = primaryCandidates.filter((entry) => Math.abs(entry.clearanceMeters) <= MAX_FINAL_CLEARANCE_METERS);
  const primaryBuried = primaryCandidates.filter((entry) => entry.box.max.y < entry.rampY - MAX_FINAL_CLEARANCE_METERS);
  const primaryCrossing = primaryCandidates.filter((entry) =>
    entry.box.min.y < entry.rampY - MAX_FINAL_CLEARANCE_METERS && entry.box.max.y >= entry.rampY - MAX_FINAL_CLEARANCE_METERS);
  if (primaryCandidates.length !== 25 || primarySuspended.length !== 5
    || primarySuspended.reduce((sum, entry) => sum + entry.triangleCount, 0) !== 590
    || primaryBuried.length !== 12 || primaryCrossing.length !== 8) {
    throw new Error(`A1 primary Tunnel-C identity changed before all-mesh grounding: ${JSON.stringify({
      candidates: primaryCandidates.length,
      suspended: primarySuspended.length,
      suspendedTriangles: primarySuspended.reduce((sum, entry) => sum + entry.triangleCount, 0),
      seated: primarySeated.length,
      buried: primaryBuried.length,
      crossing: primaryCrossing.length,
    })}`);
  }

  const corrections = [];
  for (const entry of primarySuspended) {
    const result = telescopeComponentToRamp(THREE, primaryMesh, primaryPosition, entry, entry.rampY);
    corrections.push({ mesh: primaryMesh, geometry: primaryGeometry, position: primaryPosition, entry, ...result, kind: "primary-whole" });
  }
  primaryPosition.needsUpdate = true;
  primaryGeometry.computeBoundingBox();
  primaryGeometry.computeBoundingSphere();
  primaryMesh.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);

  // Now scan every other rendered supplied mesh. The previous proof only touched
  // Tunnel_C_Jetway_0, allowing visibly separate dark rods on another exact mesh
  // to remain suspended while primary telemetry reported zero clearance.
  const secondaryDiagnostics = [];
  const secondaryCorrections = [];
  const allMeshes = [];
  model.traverse?.((object) => {
    if (object?.isMesh && object.geometry?.getAttribute?.("position")) allMeshes.push(object);
  });
  for (const mesh of allMeshes) {
    if (mesh === primaryMesh) continue;
    mesh.updateWorldMatrix(true, false);
    const originalGeometry = mesh.geometry;
    const workingGeometry = originalGeometry.index ? originalGeometry.toNonIndexed() : originalGeometry.clone();
    const workingPosition = workingGeometry.getAttribute("position");
    if (!workingPosition || workingPosition.count % 3 !== 0) continue;
    const components = findTriangleComponents(workingPosition);
    const measurements = components.map((triangles) =>
      measureTriangles(THREE, mesh, workingPosition, triangles, rotundaWorld, cabWorld));
    for (const entry of measurements) {
      if (!isAircraftSide(entry) || entry.size.y < 0.12 || entry.horizontalSpan > 2.5) continue;
      entry.rampY = sampleRenderedPavementY(THREE, photoGround, entry.center.x, entry.center.z, Math.max(highY, entry.box.max.y + 40));
      entry.clearanceMeters = entry.box.min.y - entry.rampY;
      secondaryDiagnostics.push(diagnosticEntry(entry));
    }
    const suspended = measurements.filter((entry) => {
      if (!secondarySupportHardware(entry)) return false;
      entry.rampY = sampleRenderedPavementY(THREE, photoGround, entry.center.x, entry.center.z, Math.max(highY, entry.box.max.y + 40));
      entry.clearanceMeters = entry.box.min.y - entry.rampY;
      return entry.clearanceMeters > MAX_FINAL_CLEARANCE_METERS
        && entry.clearanceMeters <= MAX_GROUNDING_EXTENSION_METERS;
    });
    if (!suspended.length) continue;
    mesh.geometry = workingGeometry;
    for (const entry of suspended) {
      const result = telescopeComponentToRamp(THREE, mesh, workingPosition, entry, entry.rampY);
      secondaryCorrections.push({ mesh, geometry: workingGeometry, position: workingPosition, entry, ...result, kind: "secondary-mesh" });
    }
    workingPosition.needsUpdate = true;
    workingGeometry.computeBoundingBox();
    workingGeometry.computeBoundingSphere();
    mesh.updateMatrixWorld(true);
    model.updateWorldMatrix(true, true);
  }

  if (!secondaryCorrections.length) {
    throw new Error(`A1 all-rendered-mesh support scan found no secondary suspended support components; mesh diagnostics=${JSON.stringify(secondaryDiagnostics.slice(0, 120))}`);
  }
  corrections.push(...secondaryCorrections);

  const rampYs = corrections.map((correction) => correction.entry.rampY);
  const rampReferenceSpreadMeters = Math.max(...rampYs) - Math.min(...rampYs);
  if (rampReferenceSpreadMeters > MAX_PAVEMENT_SAMPLE_SPREAD_METERS) {
    throw new Error(`A1 all-mesh support pavement samples disagree by ${rampReferenceSpreadMeters} m: ${JSON.stringify(rampYs)}`);
  }

  let maximumFinalClearanceMeters = 0;
  let maximumTopMountDriftMeters = 0;
  let remainingSuspendedSupportCount = 0;
  for (const correction of corrections) {
    correction.mesh.updateWorldMatrix(true, false);
    const measured = measureTriangles(THREE, correction.mesh, correction.position, correction.entry.triangles, rotundaWorld, cabWorld);
    const rampY = sampleRenderedPavementY(THREE, photoGround, measured.center.x, measured.center.z, Math.max(highY, measured.box.max.y + 40));
    const clearance = measured.box.min.y - rampY;
    maximumFinalClearanceMeters = Math.max(maximumFinalClearanceMeters, Math.abs(clearance));
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, Math.abs(measured.box.max.y - correction.beforeTopY));
    if (Math.abs(clearance) > MAX_FINAL_CLEARANCE_METERS) remainingSuspendedSupportCount += 1;
  }
  if (maximumFinalClearanceMeters > MAX_FINAL_CLEARANCE_METERS) {
    throw new Error(`A1 all-mesh visible supports still float/intersect rendered pavement: clearance=${maximumFinalClearanceMeters}`);
  }
  if (maximumTopMountDriftMeters > MAX_TOP_MOUNT_DRIFT_METERS) {
    throw new Error(`A1 all-mesh visible support moved an upper mount: drift=${maximumTopMountDriftMeters}`);
  }
  if (remainingSuspendedSupportCount) {
    throw new Error(`A1 all-mesh visible support proof found ${remainingSuspendedSupportCount} corrected support set(s) still suspended`);
  }

  const secondaryMeshNames = [...new Set(secondaryCorrections.map((entry) => entry.mesh.name || "<unnamed>"))];
  return Object.freeze({
    authority: AUTHORITY,
    secondaryMeshAuthority: SECONDARY_AUTHORITY,
    rampReferenceAuthority: RAMP_AUTHORITY,
    inspectedCandidateCount: primaryCandidates.length,
    groundedComponentCount: primarySuspended.length,
    groundedTriangleCount: primarySuspended.reduce((sum, entry) => sum + entry.triangleCount, 0),
    alreadyGroundedComponentCount: primarySeated.length,
    buriedCandidateCount: primaryBuried.length,
    pavementCrossingCandidateCount: primaryCrossing.length,
    secondaryMeshGroundedCount: secondaryCorrections.length,
    secondaryMeshGroundedTriangleCount: secondaryCorrections.reduce((sum, entry) => sum + entry.entry.triangleCount, 0),
    secondaryMeshNames,
    spatialRodClusterCount: secondaryCorrections.length,
    spatialRodTriangleCount: secondaryCorrections.reduce((sum, entry) => sum + entry.entry.triangleCount, 0),
    spatialRodVertexCount: secondaryCorrections.reduce((sum, entry) => sum + entry.entry.triangleCount * 3, 0),
    correctedSupportSetCount: corrections.length,
    visibleLoadLegCount: corrections.length,
    remainingSuspendedSupportCount,
    maximumBeforeClearanceMeters: Math.max(...corrections.map((entry) => entry.entry.clearanceMeters)),
    maximumExtensionMeters: Math.max(...corrections.map((entry) => entry.extensionMeters)),
    maximumFinalClearanceMeters,
    maximumTopMountDriftMeters,
    rampWorldY: rampYs.reduce((sum, value) => sum + value, 0) / rampYs.length,
    rampReferenceComponentCount: rampYs.length,
    rampReferenceSpreadMeters,
  });
}

export const A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY = AUTHORITY;
export const A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY = SECONDARY_AUTHORITY;
