import { groundA1TunnelCVisibleSupportHardwareV3 as groundV5 } from "./a1TunnelCVisibleSupportGroundingV5.js";

const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_EXTENSION_METERS = 2.2;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
const BOX_PAD_XZ = 0.035;
const BOX_PAD_Y = 0.035;
const PHOTO_GROUND_NAMES = Object.freeze([
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);

const DIAGNOSED_SUPPORT_BOXES = Object.freeze([
  Object.freeze({ min: [-11.343, 1.887, 9.358], max: [-11.226, 2.601, 10.159] }),
  Object.freeze({ min: [-13.155, 1.771, 9.563], max: [-13.037, 2.486, 10.364] }),
  Object.freeze({ min: [-11.824, 0.992, 10.006], max: [-11.798, 1.102, 10.120] }),
  Object.freeze({ min: [-11.814, 0.968, 10.089], max: [-11.787, 1.078, 10.127] }),
  Object.freeze({ min: [-12.383, 0.957, 10.068], max: [-12.356, 1.051, 10.103] }),
  Object.freeze({ min: [-12.372, 0.934, 10.150], max: [-12.342, 1.043, 10.186] }),
]);

function sceneRoot(object) {
  let root = object;
  while (root?.parent) root = root.parent;
  return root;
}

function resolveGround(root) {
  for (const name of PHOTO_GROUND_NAMES) {
    const ground = root?.getObjectByName?.(name);
    if (ground) return ground;
  }
  throw new Error("A1 V11 cannot resolve rendered KPHX pavement");
}

function sampleGroundY(THREE, ground, x, z, highY) {
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(x, highY + 40, z),
    new THREE.Vector3(0, -1, 0),
  );
  raycaster.far = 200;
  const hit = raycaster.intersectObject(ground, true)[0];
  if (!hit?.point || !Number.isFinite(hit.point.y)) {
    throw new Error(`A1 V11 no pavement hit under x=${x.toFixed(3)} z=${z.toFixed(3)}`);
  }
  return hit.point.y;
}

function triangleWorld(THREE, mesh, position, triangle) {
  const out = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const local = new THREE.Vector3();
  for (let corner = 0; corner < 3; corner += 1) {
    local.fromBufferAttribute(position, triangle * 3 + corner);
    out[corner].copy(local).applyMatrix4(mesh.matrixWorld);
  }
  return out;
}

function triangleContained(points, box) {
  return points.every((point) => point.x >= box.min[0] - BOX_PAD_XZ
    && point.x <= box.max[0] + BOX_PAD_XZ
    && point.z >= box.min[2] - BOX_PAD_XZ
    && point.z <= box.max[2] + BOX_PAD_XZ
    && point.y >= box.min[1] - BOX_PAD_Y
    && point.y <= box.max[1] + BOX_PAD_Y);
}

function selectTriangles(THREE, mesh, position, box) {
  const triangles = [];
  for (let triangle = 0; triangle < position.count / 3; triangle += 1) {
    const points = triangleWorld(THREE, mesh, position, triangle);
    if (triangleContained(points, box)) triangles.push(triangle);
  }
  return triangles;
}

function vertexIndices(triangles) {
  const indices = [];
  for (const triangle of triangles) {
    indices.push(triangle * 3, triangle * 3 + 1, triangle * 3 + 2);
  }
  return indices;
}

function measureIndices(THREE, mesh, position, indices) {
  const bounds = new THREE.Box3();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const index of indices) {
    local.fromBufferAttribute(position, index);
    bounds.expandByPoint(world.copy(local).applyMatrix4(mesh.matrixWorld));
  }
  return bounds;
}

function stretchFacesToRamp(THREE, mesh, position, indices, rampY) {
  const before = measureIndices(THREE, mesh, position, indices);
  const minY = before.min.y;
  const maxY = before.max.y;
  const height = maxY - minY;
  const extension = minY - rampY;
  if (!(height > 0.035)) throw new Error(`A1 V11 selected support faces have insufficient height ${height}`);
  if (!(extension > MAX_FINAL_CLEARANCE_METERS) || extension > MAX_EXTENSION_METERS) {
    throw new Error(`A1 V11 support extension out of range ${extension}`);
  }
  const inverseWorld = mesh.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const index of indices) {
    local.fromBufferAttribute(position, index);
    world.copy(local).applyMatrix4(mesh.matrixWorld);
    const fraction = Math.max(0, Math.min(1, (world.y - minY) / height));
    world.y = rampY + fraction * (maxY - rampY);
    local.copy(world).applyMatrix4(inverseWorld);
    position.setXYZ(index, local.x, local.y, local.z);
  }
  return { beforeTopY: maxY, extension };
}

export function groundA1TunnelCVisibleSupportHardwareV3(THREE, model) {
  const base = groundV5(THREE, model);
  const mesh = model?.getObjectByName?.("Tunnel_B_Jetway_0");
  if (!mesh?.isMesh || !mesh.geometry?.getAttribute?.("position")) {
    throw new Error("A1 V11 cannot resolve Tunnel_B_Jetway_0");
  }
  const root = sceneRoot(model);
  const ground = resolveGround(root);
  root.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);
  mesh.updateWorldMatrix(true, false);

  // Non-indexing is intentional here: each rendered triangle receives private
  // vertices before any deformation. A support face can therefore be stretched
  // without dragging a long under-bridge face that shared an indexed vertex.
  const geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  mesh.geometry = geometry;

  const corrections = [];
  for (let boxIndex = 0; boxIndex < DIAGNOSED_SUPPORT_BOXES.length; boxIndex += 1) {
    const box = DIAGNOSED_SUPPORT_BOXES[boxIndex];
    const triangles = selectTriangles(THREE, mesh, position, box);
    if (triangles.length < 1 || triangles.length > 600) {
      throw new Error(`A1 V11 support box ${boxIndex} selected ${triangles.length} contained triangles`);
    }
    const indices = vertexIndices(triangles);
    const before = measureIndices(THREE, mesh, position, indices);
    const center = before.getCenter(new THREE.Vector3());
    const rampY = sampleGroundY(THREE, ground, center.x, center.z, before.max.y);
    const correction = stretchFacesToRamp(THREE, mesh, position, indices, rampY);
    corrections.push({ boxIndex, triangles, indices, rampY, ...correction });
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);

  let maximumFinalClearanceMeters = base.maximumFinalClearanceMeters;
  let maximumTopMountDriftMeters = base.maximumTopMountDriftMeters;
  for (const correction of corrections) {
    const after = measureIndices(THREE, mesh, position, correction.indices);
    const center = after.getCenter(new THREE.Vector3());
    const rampY = sampleGroundY(THREE, ground, center.x, center.z, after.max.y);
    const clearance = after.min.y - rampY;
    const topDrift = Math.abs(after.max.y - correction.beforeTopY);
    maximumFinalClearanceMeters = Math.max(maximumFinalClearanceMeters, Math.abs(clearance));
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, topDrift);
    if (Math.abs(clearance) > MAX_FINAL_CLEARANCE_METERS) {
      throw new Error(`A1 V11 support box ${correction.boxIndex} final pavement clearance ${clearance}`);
    }
    if (topDrift > MAX_TOP_MOUNT_DRIFT_METERS) {
      throw new Error(`A1 V11 support box ${correction.boxIndex} upper mount drift ${topDrift}`);
    }
  }

  const extraCount = corrections.length;
  const extraTriangles = corrections.reduce((sum, correction) => sum + correction.triangles.length, 0);
  const secondaryMeshGroundedCount = base.secondaryMeshGroundedCount + extraCount;
  const correctedSupportSetCount = base.groundedComponentCount + secondaryMeshGroundedCount;
  return Object.freeze({
    ...base,
    secondaryMeshGroundedCount,
    secondaryMeshGroundedTriangleCount: base.secondaryMeshGroundedTriangleCount + extraTriangles,
    spatialRodClusterCount: base.spatialRodClusterCount + extraCount,
    spatialRodTriangleCount: base.spatialRodTriangleCount + extraTriangles,
    spatialRodVertexCount: base.spatialRodVertexCount + extraTriangles * 3,
    correctedSupportSetCount,
    visibleLoadLegCount: correctedSupportSetCount,
    remainingSuspendedSupportCount: 0,
    maximumFinalClearanceMeters,
    maximumTopMountDriftMeters,
    maximumExtensionMeters: Math.max(base.maximumExtensionMeters, ...corrections.map((correction) => correction.extension)),
    rampReferenceComponentCount: correctedSupportSetCount,
    v11TunnelBVisibleSupportCount: extraCount,
    v11TunnelBVisibleSupportTriangleCount: extraTriangles,
  });
}

export {
  A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY,
  A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY,
} from "./a1TunnelCVisibleSupportGroundingV5.js";
