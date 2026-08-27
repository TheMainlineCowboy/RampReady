import { groundA1TunnelCVisibleSupportHardwareV3 as groundV11 } from "./a1TunnelCVisibleSupportGroundingV11.js";

const PHOTO_GROUND_NAMES = Object.freeze([
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);

// Tight world-space window around the still-visible hanging hardware in the
// accepted-head aircraft-side / bogie screenshots. This is diagnostic only:
// it identifies the actual rendered mesh ownership after V11 has run.
const REGION = Object.freeze({
  minX: -13.8,
  maxX: -10.8,
  minY: 0.55,
  maxY: 3.1,
  minZ: 8.8,
  maxZ: 10.8,
});

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
  throw new Error("A1 V12 cannot resolve rendered KPHX pavement");
}

function groundY(THREE, ground, x, z, highY) {
  const ray = new THREE.Raycaster(
    new THREE.Vector3(x, highY + 40, z),
    new THREE.Vector3(0, -1, 0),
  );
  ray.far = 200;
  const hit = ray.intersectObject(ground, true)[0];
  return hit?.point?.y;
}

function inside(world) {
  return world.x >= REGION.minX && world.x <= REGION.maxX
    && world.y >= REGION.minY && world.y <= REGION.maxY
    && world.z >= REGION.minZ && world.z <= REGION.maxZ;
}

export function groundA1TunnelCVisibleSupportHardwareV3(THREE, model) {
  const base = groundV11(THREE, model);
  const root = sceneRoot(model);
  const ground = resolveGround(root);
  root.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);

  const findings = [];
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  model.traverse((mesh) => {
    if (!mesh?.isMesh || !mesh.geometry?.getAttribute?.("position")) return;
    mesh.updateWorldMatrix(true, false);
    const source = mesh.geometry;
    const geometry = source.index ? source.toNonIndexed() : source;
    const position = geometry.getAttribute("position");
    if (!position || position.count % 3 !== 0) return;

    let triangleCount = 0;
    const box = new THREE.Box3();
    for (let triangle = 0; triangle < position.count / 3; triangle += 1) {
      const points = [];
      for (let corner = 0; corner < 3; corner += 1) {
        local.fromBufferAttribute(position, triangle * 3 + corner);
        points.push(world.copy(local).applyMatrix4(mesh.matrixWorld).clone());
      }
      if (!points.every(inside)) continue;
      triangleCount += 1;
      for (const point of points) box.expandByPoint(point);
    }
    if (!triangleCount || box.isEmpty()) return;
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const pavementY = groundY(THREE, ground, center.x, center.z, box.max.y);
    const clearance = Number.isFinite(pavementY) ? box.min.y - pavementY : NaN;
    findings.push({
      mesh: mesh.name || "<unnamed>",
      triangles: triangleCount,
      min: box.min.toArray().map((v) => +v.toFixed(4)),
      max: box.max.toArray().map((v) => +v.toFixed(4)),
      size: size.toArray().map((v) => +v.toFixed(4)),
      center: center.toArray().map((v) => +v.toFixed(4)),
      clearance: Number.isFinite(clearance) ? +clearance.toFixed(4) : null,
    });
  });

  findings.sort((a, b) => (b.clearance ?? -Infinity) - (a.clearance ?? -Infinity) || b.triangles - a.triangles);
  throw new Error(`A1 V12 REMAINING RENDERED SUPPORT OWNERSHIP ${JSON.stringify(findings.slice(0, 40))}`);
}

export {
  A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY,
  A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY,
} from "./a1TunnelCVisibleSupportGroundingV5.js";
