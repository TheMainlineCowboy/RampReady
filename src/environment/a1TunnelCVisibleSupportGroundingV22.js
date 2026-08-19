import { groundA1TunnelCVisibleSupportHardwareV3 as groundV21 } from "./a1TunnelCVisibleSupportGroundingV21.js";

const GROUND_NAMES = Object.freeze(["PHX_KPHX_SourceAuthoredPhotoGround_Tiled", "PHX_KPHX_SourceAuthoredPhotoGround"]);
const TARGETS = Object.freeze([
  Object.freeze({ name: "rod-outboard-a", minX: -11.31, maxX: -11.20, minZ: 10.04, maxZ: 10.17, maxHeightAboveRamp: 2.35 }),
  Object.freeze({ name: "rod-outboard-b", minX: -13.10, maxX: -13.00, minZ: 10.27, maxZ: 10.40, maxHeightAboveRamp: 2.20 }),
  Object.freeze({ name: "rod-thin-a", minX: -11.87, maxX: -11.74, minZ: 9.96, maxZ: 10.18, maxHeightAboveRamp: 2.45 }),
  Object.freeze({ name: "rod-thin-b", minX: -12.43, maxX: -12.30, minZ: 10.02, maxZ: 10.23, maxHeightAboveRamp: 2.45 }),
]);
const TOL = 0.015;
const MAX_EXTENSION = 2.20;
const MIN_SURFACE_HEIGHT = 0.04;
const MIN_TRIANGLES = 2;
const MAX_PASSES_PER_TARGET = 12;

function rootOf(object) { let root = object; while (root?.parent) root = root.parent; return root; }
function groundOf(root) { for (const name of GROUND_NAMES) { const ground = root?.getObjectByName?.(name); if (ground) return ground; } throw new Error("A1 V22 no rendered KPHX pavement"); }
function groundYAt(THREE, ground, x, z, yHint = 4) { const ray = new THREE.Raycaster(new THREE.Vector3(x, yHint + 40, z), new THREE.Vector3(0, -1, 0)); ray.far = 200; const hit = ray.intersectObject(ground, true)[0]; if (!hit?.point) throw new Error(`A1 V22 pavement ray miss ${x},${z}`); return hit.point.y; }
function triangleWorld(THREE, mesh, position, triangleIndex) { const local = new THREE.Vector3(); const points = []; for (let corner = 0; corner < 3; corner += 1) { local.fromBufferAttribute(position, triangleIndex * 3 + corner); points.push(local.clone().applyMatrix4(mesh.matrixWorld)); } return points; }
function suspendedTriangles(THREE, mesh, position, target, rampY) { const ids = []; const upper = rampY + target.maxHeightAboveRamp; for (let triangleIndex = 0; triangleIndex < position.count / 3; triangleIndex += 1) { const points = triangleWorld(THREE, mesh, position, triangleIndex); const cx = (points[0].x + points[1].x + points[2].x) / 3; const cz = (points[0].z + points[1].z + points[2].z) / 3; if (cx < target.minX || cx > target.maxX || cz < target.minZ || cz > target.maxZ) continue; const minY = Math.min(...points.map((point) => point.y)); const maxY = Math.max(...points.map((point) => point.y)); if (minY > rampY + TOL && maxY <= upper) ids.push(triangleIndex); } return ids; }
function boundsFor(THREE, mesh, position, triangleIds) { const box = new THREE.Box3(); for (const triangleIndex of triangleIds) for (const point of triangleWorld(THREE, mesh, position, triangleIndex)) box.expandByPoint(point); return box; }
function stretchSurface(THREE, mesh, position, triangleIds, rampY) { if (triangleIds.length < MIN_TRIANGLES) return null; const before = boundsFor(THREE, mesh, position, triangleIds); const height = before.max.y - before.min.y; const extension = before.min.y - rampY; if (height < MIN_SURFACE_HEIGHT || extension <= TOL) return null; if (extension > MAX_EXTENSION) throw new Error(`A1 V22 rendered rod extension ${extension} exceeds ${MAX_EXTENSION}`); const inverse = mesh.matrixWorld.clone().invert(); const local = new THREE.Vector3(); const world = new THREE.Vector3(); const indices = new Set(); for (const triangleIndex of triangleIds) for (let corner = 0; corner < 3; corner += 1) indices.add(triangleIndex * 3 + corner); for (const index of indices) { local.fromBufferAttribute(position, index); world.copy(local).applyMatrix4(mesh.matrixWorld); const fraction = Math.max(0, Math.min(1, (world.y - before.min.y) / height)); world.y = rampY + fraction * (before.max.y - rampY); local.copy(world).applyMatrix4(inverse); position.setXYZ(index, local.x, local.y, local.z); } return { triangleCount: triangleIds.length, vertexCount: indices.size, extension, beforeTopY: before.max.y }; }

export function groundA1TunnelCVisibleSupportHardwareV3(THREE, model) {
  const base = groundV21(THREE, model); const root = rootOf(model); const ground = groundOf(root); const meshes = [];
  root.updateWorldMatrix?.(true, true); model.updateWorldMatrix(true, true);
  model.traverse?.((object) => { if (object?.isMesh && object.name === "Tunnel_B_Jetway_0") meshes.push(object); });
  if (!meshes.length) throw new Error("A1 V22 no rendered Tunnel_B_Jetway_0 meshes");
  let correctedTriangles = 0; let correctedVertices = 0; let maximumCorrection = 0; const evidence = [];
  for (const mesh of meshes) {
    mesh.updateWorldMatrix(true, false); mesh.geometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone(); const position = mesh.geometry.getAttribute("position"); if (!position) continue;
    for (const target of TARGETS) {
      const cx = (target.minX + target.maxX) / 2; const cz = (target.minZ + target.maxZ) / 2; const rampY = groundYAt(THREE, ground, cx, cz);
      for (let pass = 1; pass <= MAX_PASSES_PER_TARGET; pass += 1) {
        const triangleIds = suspendedTriangles(THREE, mesh, position, target, rampY);
        if (triangleIds.length < MIN_TRIANGLES) break;
        const correction = stretchSurface(THREE, mesh, position, triangleIds, rampY);
        if (!correction) break;
        correctedTriangles += correction.triangleCount; correctedVertices += correction.vertexCount; maximumCorrection = Math.max(maximumCorrection, correction.extension); evidence.push({ mesh: mesh.uuid, target: target.name, pass, ...correction });
        position.needsUpdate = true; mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere(); mesh.updateMatrixWorld(true);
        if (pass === MAX_PASSES_PER_TARGET) throw new Error(`A1 V22 ${target.name} did not converge after ${MAX_PASSES_PER_TARGET} rendered-surface passes`);
      }
    }
    position.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere(); mesh.updateMatrixWorld(true);
  }
  model.updateWorldMatrix(true, true);
  const remaining = [];
  for (const mesh of meshes) {
    const position = mesh.geometry.getAttribute("position"); if (!position) continue;
    for (const target of TARGETS) {
      const cx = (target.minX + target.maxX) / 2; const cz = (target.minZ + target.maxZ) / 2; const rampY = groundYAt(THREE, ground, cx, cz); const triangleIds = suspendedTriangles(THREE, mesh, position, target, rampY);
      if (triangleIds.length >= MIN_TRIANGLES) { const bounds = boundsFor(THREE, mesh, position, triangleIds); remaining.push({ mesh: mesh.uuid, target: target.name, triangleCount: triangleIds.length, clearance: bounds.min.y - rampY }); }
    }
  }
  if (remaining.length) throw new Error(`A1 V22 remaining rendered suspended rod faces ${JSON.stringify(remaining)}`);
  model.userData.a1V22RodTriangleSurfaceGrounding = Object.freeze({ meshInstanceCount: meshes.length, correctedTriangleCount: correctedTriangles, correctedVertexCount: correctedVertices, maximumCorrectionMeters: maximumCorrection, remainingSuspendedTriangleSurfaceCount: 0, evidence });
  return Object.freeze({ ...base, remainingSuspendedSupportCount: 0, v22RodCorrectedTriangleCount: correctedTriangles, v22RodCorrectedVertexCount: correctedVertices, v22RodMaximumCorrectionMeters: maximumCorrection });
}

export { A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY, A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY } from "./a1TunnelCVisibleSupportGroundingV5.js";
