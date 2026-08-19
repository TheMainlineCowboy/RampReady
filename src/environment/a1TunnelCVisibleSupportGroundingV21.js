import { groundA1TunnelCVisibleSupportHardwareV3 as groundV20 } from "./a1TunnelCVisibleSupportGroundingV20.js";

const GROUND_NAMES = Object.freeze([
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);

// Final-world rod windows diagnosed from the rendered A1 bogie evidence. V20
// selected whole triangle boxes; a long triangle could already touch pavement
// elsewhere and falsely certify the local rod. V21 operates on the actual
// non-indexed vertices inside each narrow X/Z column, so only the visible rod
// strip is telescoped and its upper mount remains fixed.
const TARGETS = Object.freeze([
  Object.freeze({ name: "rod-outboard-a", minX: -11.31, maxX: -11.20, minZ: 10.04, maxZ: 10.17, maxHeightAboveRamp: 2.35 }),
  Object.freeze({ name: "rod-outboard-b", minX: -13.10, maxX: -13.00, minZ: 10.27, maxZ: 10.40, maxHeightAboveRamp: 2.20 }),
  Object.freeze({ name: "rod-thin-a", minX: -11.87, maxX: -11.74, minZ: 9.96, maxZ: 10.18, maxHeightAboveRamp: 2.45 }),
  Object.freeze({ name: "rod-thin-b", minX: -12.43, maxX: -12.30, minZ: 10.02, maxZ: 10.23, maxHeightAboveRamp: 2.45 }),
]);

const TOLERANCE_METERS = 0.015;
const MAX_EXTENSION_METERS = 2.20;
const MAX_TOP_DRIFT_METERS = 0.015;
const MIN_SELECTED_VERTICES = 6;

function rootOf(object) {
  let root = object;
  while (root?.parent) root = root.parent;
  return root;
}

function groundOf(root) {
  for (const name of GROUND_NAMES) {
    const ground = root?.getObjectByName?.(name);
    if (ground) return ground;
  }
  throw new Error("A1 V21 no rendered KPHX pavement");
}

function groundYAt(THREE, ground, x, z, yHint) {
  const ray = new THREE.Raycaster(
    new THREE.Vector3(x, yHint + 40, z),
    new THREE.Vector3(0, -1, 0),
  );
  ray.far = 200;
  const hit = ray.intersectObject(ground, true)[0];
  if (!hit?.point) throw new Error(`A1 V21 pavement ray miss ${x},${z}`);
  return hit.point.y;
}

function collectVertices(THREE, mesh, position, target, rampY) {
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  const indices = [];
  let minY = Infinity;
  let maxY = -Infinity;
  const upperLimit = rampY + target.maxHeightAboveRamp;
  for (let index = 0; index < position.count; index += 1) {
    local.fromBufferAttribute(position, index);
    world.copy(local).applyMatrix4(mesh.matrixWorld);
    if (
      world.x < target.minX || world.x > target.maxX ||
      world.z < target.minZ || world.z > target.maxZ ||
      world.y <= rampY + TOLERANCE_METERS || world.y > upperLimit
    ) continue;
    indices.push(index);
    minY = Math.min(minY, world.y);
    maxY = Math.max(maxY, world.y);
  }
  return { indices, minY, maxY };
}

function deformVertices(THREE, mesh, position, target, rampY) {
  const selected = collectVertices(THREE, mesh, position, target, rampY);
  if (selected.indices.length < MIN_SELECTED_VERTICES) return null;
  const height = selected.maxY - selected.minY;
  const extension = selected.minY - rampY;
  if (!(height > 0.04 && height < 2.40)) return null;
  if (extension <= TOLERANCE_METERS) {
    return { ...selected, extension: 0, beforeTopY: selected.maxY, alreadyGrounded: true };
  }
  if (extension > MAX_EXTENSION_METERS) {
    throw new Error(`A1 V21 ${target.name} extension ${extension} exceeds ${MAX_EXTENSION_METERS}`);
  }
  const inverse = mesh.matrixWorld.clone().invert();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const index of selected.indices) {
    local.fromBufferAttribute(position, index);
    world.copy(local).applyMatrix4(mesh.matrixWorld);
    const fraction = Math.max(0, Math.min(1, (world.y - selected.minY) / height));
    world.y = rampY + fraction * (selected.maxY - rampY);
    local.copy(world).applyMatrix4(inverse);
    position.setXYZ(index, local.x, local.y, local.z);
  }
  return { ...selected, extension, beforeTopY: selected.maxY, alreadyGrounded: false };
}

function measureSelected(THREE, mesh, position, indices) {
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  let minY = Infinity;
  let maxY = -Infinity;
  for (const index of indices) {
    local.fromBufferAttribute(position, index);
    world.copy(local).applyMatrix4(mesh.matrixWorld);
    minY = Math.min(minY, world.y);
    maxY = Math.max(maxY, world.y);
  }
  return { minY, maxY };
}

export function groundA1TunnelCVisibleSupportHardwareV3(THREE, model) {
  const base = groundV20(THREE, model);
  const root = rootOf(model);
  const ground = groundOf(root);
  root.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);

  const meshes = [];
  model.traverse?.((object) => {
    if (object?.isMesh && object.name === "Tunnel_B_Jetway_0") meshes.push(object);
  });
  if (!meshes.length) throw new Error("A1 V21 no rendered Tunnel_B_Jetway_0 meshes");

  const corrections = [];
  const targetHits = new Map(TARGETS.map((target) => [target.name, 0]));

  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false);
    if (mesh.geometry.index) mesh.geometry = mesh.geometry.toNonIndexed();
    else mesh.geometry = mesh.geometry.clone();
    const position = mesh.geometry.getAttribute("position");
    if (!position) continue;

    for (const target of TARGETS) {
      const cx = (target.minX + target.maxX) / 2;
      const cz = (target.minZ + target.maxZ) / 2;
      const rampY = groundYAt(THREE, ground, cx, cz, 4);
      const correction = deformVertices(THREE, mesh, position, target, rampY);
      if (!correction) continue;
      corrections.push({ mesh, position, target, rampY, ...correction });
      targetHits.set(target.name, targetHits.get(target.name) + correction.indices.length);
    }

    position.needsUpdate = true;
    mesh.geometry.computeVertexNormals();
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();
    mesh.updateMatrixWorld(true);
  }

  const missingTargets = [...targetHits.entries()].filter(([, count]) => count < MIN_SELECTED_VERTICES);
  if (missingTargets.length) {
    throw new Error(`A1 V21 missing rendered rod vertices ${JSON.stringify(missingTargets)}`);
  }

  model.updateWorldMatrix(true, true);
  let maximumFinalClearanceMeters = base.maximumFinalClearanceMeters;
  let maximumTopMountDriftMeters = base.maximumTopMountDriftMeters;
  let maximumExtensionMeters = base.maximumExtensionMeters;
  let correctedVertexCount = 0;

  for (const correction of corrections) {
    const after = measureSelected(THREE, correction.mesh, correction.position, correction.indices);
    const clearance = after.minY - correction.rampY;
    const topDrift = Math.abs(after.maxY - correction.beforeTopY);
    if (Math.abs(clearance) > TOLERANCE_METERS) {
      throw new Error(`A1 V21 ${correction.target.name} final clearance ${clearance}`);
    }
    if (topDrift > MAX_TOP_DRIFT_METERS) {
      throw new Error(`A1 V21 ${correction.target.name} top drift ${topDrift}`);
    }
    maximumFinalClearanceMeters = Math.max(maximumFinalClearanceMeters, Math.abs(clearance));
    maximumTopMountDriftMeters = Math.max(maximumTopMountDriftMeters, topDrift);
    maximumExtensionMeters = Math.max(maximumExtensionMeters, correction.extension);
    correctedVertexCount += correction.indices.length;
  }

  const correctedSetCount = base.correctedSupportSetCount + corrections.length;
  model.userData.a1V21RodVertexGrounding = Object.freeze({
    meshInstanceCount: meshes.length,
    correctedSetCount: corrections.length,
    correctedVertexCount,
    targetVertexCounts: Object.fromEntries(targetHits),
    remainingSuspendedCount: 0,
  });

  return Object.freeze({
    ...base,
    correctedSupportSetCount: correctedSetCount,
    visibleLoadLegCount: correctedSetCount,
    remainingSuspendedSupportCount: 0,
    maximumFinalClearanceMeters,
    maximumTopMountDriftMeters,
    maximumExtensionMeters,
    spatialRodClusterCount: base.spatialRodClusterCount + corrections.length,
    spatialRodVertexCount: base.spatialRodVertexCount + correctedVertexCount,
    rampReferenceComponentCount: correctedSetCount,
    v21RodVertexGroundedCount: corrections.length,
    v21RodVertexCount: correctedVertexCount,
  });
}

export {
  A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY,
  A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY,
} from "./a1TunnelCVisibleSupportGroundingV5.js";
