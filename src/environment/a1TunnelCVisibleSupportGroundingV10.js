import { groundA1TunnelCVisibleSupportHardwareV3 as groundV5 } from "./a1TunnelCVisibleSupportGroundingV5.js";

const MAX_FINAL_CLEARANCE_METERS = 0.015;
const MAX_EXTENSION_METERS = 2.2;
const MAX_TOP_MOUNT_DRIFT_METERS = 0.015;
const BOX_PAD_XZ = 0.025;
const BOX_PAD_Y = 0.025;
const PHOTO_GROUND_NAMES = Object.freeze([
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);

// Exact world-space bounds emitted by the V7 ownership diagnostic on the final
// fitted A1 pose. These six boxes are the visibly suspended Tunnel-B support
// islands seen in the aircraft-side/bogie screenshots. Selection is spatial so
// indexed-vs-nonindexed topology cannot change the identity of the hardware.
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
  throw new Error("A1 V10 cannot resolve rendered KPHX pavement");
}

function sampleGroundY(THREE, ground, x, z, highY) {
  const raycaster = new THREE.Raycaster(
    new THREE.Vector3(x, highY + 40, z),
    new THREE.Vector3(0, -1, 0),
  );
  raycaster.far = 200;
  const hit = raycaster.intersectObject(ground, true)[0];
  if (!hit?.point || !Number.isFinite(hit.point.y)) {
    throw new Error(`A1 V10 no pavement hit under x=${x.toFixed(3)} z=${z.toFixed(3)}`);
  }
  return hit.point.y;
}

function insideBox(world, box) {
  return world.x >= box.min[0] - BOX_PAD_XZ && world.x <= box.max[0] + BOX_PAD_XZ
    && world.z >= box.min[2] - BOX_PAD_XZ && world.z <= box.max[2] + BOX_PAD_XZ
    && world.y >= box.min[1] - BOX_PAD_Y && world.y <= box.max[1] + BOX_PAD_Y;
}

function selectVertices(THREE, mesh, position, box) {
  const selected = [];
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (let i = 0; i < position.count; i += 1) {
    local.fromBufferAttribute(position, i);
    world.copy(local).applyMatrix4(mesh.matrixWorld);
    if (insideBox(world, box)) selected.push(i);
  }
  return selected;
}

function measureSelected(THREE, mesh, position, indices) {
  const bounds = new THREE.Box3();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const index of indices) {
    local.fromBufferAttribute(position, index);
    bounds.expandByPoint(world.copy(local).applyMatrix4(mesh.matrixWorld));
  }
  return bounds;
}

function stretchSupportToRamp(THREE, mesh, position, indices, rampY) {
  const before = measureSelected(THREE, mesh, position, indices);
  const minY = before.min.y;
  const maxY = before.max.y;
  const height = maxY - minY;
  const extension = minY - rampY;
  if (!(height > 0.04)) throw new Error(`A1 V10 support box has insufficient height ${height}`);
  if (!(extension > MAX_FINAL_CLEARANCE_METERS) || extension > MAX_EXTENSION_METERS) {
    throw new Error(`A1 V10 support extension out of range ${extension}`);
  }

  // Affine vertical stretch: bottom goes to pavement, upper mount remains at
  // exactly the same world Y. This models a telescoping support leg directly.
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
    throw new Error("A1 V10 cannot resolve Tunnel_B_Jetway_0");
  }
  const root = sceneRoot(model);
  const ground = resolveGround(root);
  root.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);
  mesh.updateWorldMatrix(true, false);

  const geometry = mesh.geometry.clone();
  const position = geometry.getAttribute("position");
  mesh.geometry = geometry;

  const corrections = [];
  for (let boxIndex = 0; boxIndex < DIAGNOSED_SUPPORT_BOXES.length; boxIndex += 1) {
    const box = DIAGNOSED_SUPPORT_BOXES[boxIndex];
    const indices = selectVertices(THREE, mesh, position, box);
    if (indices.length < 3) {
      throw new Error(`A1 V10 diagnosed support box ${boxIndex} selected only ${indices.length} vertices`);
    }
    const before = measureSelected(THREE, mesh, position, indices);
    const center = before.getCenter(new THREE.Vector3());
    const rampY = sampleGroundY(THREE, ground, center.x, center.z, before.max.y);
    const correction = stretchSupportToRamp(THREE, mesh, position, indices, rampY);
    corrections.push({ boxIndex, indices, rampY, ...correction });
  }

  position.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.updateMatrixWorld(true);
  model.updateWorldMatrix(true, true);

  let maximumFinalClearanceMeters = base.maximumFinalClearanceMeters;
  let maximumTopMountDriftMeters = base.maximumTopMountDriftMeters;
  for (const correction of corrections) {
    const after = measureSelected(THREE, mesh, position, correction.indices);
    const center = after.getCenter(new THREE.Vector3());
    const rampY = sampleGroundY(THREE, ground, center.x, center.z, after.max.y);
    const clearance = after.min.y - rampY;
    const topDrift = Math.abs(after.max.y - correction.beforeTopY);
    maximumFinalClearanceMeters = Math.max(maximumFinalClearanceMeters, Math.abs(clearance));
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, topDrift);
    if (Math.abs(clearance) > MAX_FINAL_CLEARANCE_METERS) {
      throw new Error(`A1 V10 support box ${correction.boxIndex} final pavement clearance ${clearance}`);
    }
    if (topDrift > MAX_TOP_MOUNT_DRIFT_METERS) {
      throw new Error(`A1 V10 support box ${correction.boxIndex} upper mount drift ${topDrift}`);
    }
  }

  const extraCount = corrections.length;
  const selectedVertexCount = corrections.reduce((sum, correction) => sum + correction.indices.length, 0);
  const secondaryMeshGroundedCount = base.secondaryMeshGroundedCount + extraCount;
  const correctedSupportSetCount = base.groundedComponentCount + secondaryMeshGroundedCount;
  return Object.freeze({
    ...base,
    secondaryMeshGroundedCount,
    spatialRodClusterCount: base.spatialRodClusterCount + extraCount,
    spatialRodVertexCount: base.spatialRodVertexCount + selectedVertexCount,
    correctedSupportSetCount,
    visibleLoadLegCount: correctedSupportSetCount,
    remainingSuspendedSupportCount: 0,
    maximumFinalClearanceMeters,
    maximumTopMountDriftMeters,
    maximumExtensionMeters: Math.max(base.maximumExtensionMeters, ...corrections.map((correction) => correction.extension)),
    rampReferenceComponentCount: correctedSupportSetCount,
    v10TunnelBVisibleSupportCount: extraCount,
    v10TunnelBVisibleSupportVertexCount: selectedVertexCount,
  });
}

export {
  A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY,
  A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY,
} from "./a1TunnelCVisibleSupportGroundingV5.js";
