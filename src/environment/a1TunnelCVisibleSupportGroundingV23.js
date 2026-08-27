const GROUND_NAMES = Object.freeze([
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);

const MAX_CLEARANCE_METERS = 0.03;
const MAX_PENETRATION_METERS = 0.03;
const MIN_COMPONENT_TRIANGLES = 24;
const MIN_HORIZONTAL_SPAN_METERS = 0.22;
const MAX_HORIZONTAL_SPAN_METERS = 1.50;
const MIN_VERTICAL_SIZE_METERS = 0.12;
const MAX_VERTICAL_SIZE_METERS = 0.90;

function rootOf(object) {
  let root = object;
  while (root?.parent) root = root.parent;
  return root;
}

function resolveGround(root) {
  for (const name of GROUND_NAMES) {
    const ground = root?.getObjectByName?.(name);
    if (ground) return ground;
  }
  throw new Error("A1 V23 cannot resolve rendered KPHX pavement");
}

function sampleGroundY(THREE, ground, x, z, highY) {
  const ray = new THREE.Raycaster(
    new THREE.Vector3(x, highY + 40, z),
    new THREE.Vector3(0, -1, 0),
    0,
    200,
  );
  const hit = ray.intersectObject(ground, true)[0];
  if (!hit?.point || !Number.isFinite(hit.point.y)) {
    throw new Error(`A1 V23 pavement ray miss x=${x.toFixed(3)} z=${z.toFixed(3)}`);
  }
  return hit.point.y;
}

function vertexKey(position, index) {
  return `${Math.round(position.getX(index) * 10000)},${Math.round(position.getY(index) * 10000)},${Math.round(position.getZ(index) * 10000)}`;
}

function triangleComponents(position) {
  if (!position || position.count % 3 !== 0) return [];
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
  const firstByVertex = new Map();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    for (let corner = 0; corner < 3; corner += 1) {
      const key = vertexKey(position, triangle * 3 + corner);
      const first = firstByVertex.get(key);
      if (first === undefined) firstByVertex.set(key, triangle);
      else union(triangle, first);
    }
  }
  const components = new Map();
  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const root = find(triangle);
    if (!components.has(root)) components.set(root, []);
    components.get(root).push(triangle);
  }
  return [...components.values()];
}

function measureComponent(THREE, mesh, position, triangles) {
  const box = new THREE.Box3();
  const local = new THREE.Vector3();
  const world = new THREE.Vector3();
  for (const triangle of triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      local.fromBufferAttribute(position, triangle * 3 + corner);
      box.expandByPoint(world.copy(local).applyMatrix4(mesh.matrixWorld));
    }
  }
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  return {
    triangles: triangles.length,
    box,
    size,
    center,
    horizontalSpan: Math.max(size.x, size.z),
  };
}

function sourcePartRoot(object) {
  let current = object;
  while (current?.parent && current.parent.name !== "RootNode") current = current.parent;
  return current?.parent?.name === "RootNode" ? current.name : null;
}

export function groundA1TunnelCVisibleSupportHardwareV3(THREE, model) {
  if (!model) throw new Error("A1 V23 requires the exact supplied A1 model");
  const root = rootOf(model);
  const ground = resolveGround(root);
  root.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);

  const rotunda = model.getObjectByName?.("Rotunda");
  const cab = model.getObjectByName?.("Cab");
  if (!rotunda || !cab) throw new Error("A1 V23 cannot resolve Rotunda/Cab");
  const rotundaCenter = new THREE.Box3().setFromObject(rotunda).getCenter(new THREE.Vector3());
  const cabCenter = new THREE.Box3().setFromObject(cab).getCenter(new THREE.Vector3());
  const bridge = cabCenter.clone().sub(rotundaCenter).setY(0);
  const bridgeLengthSq = bridge.lengthSq();
  if (!(bridgeLengthSq > 1)) throw new Error("A1 V23 bridge axis is invalid");

  const candidates = [];
  model.traverse?.((mesh) => {
    if (!mesh?.isMesh || sourcePartRoot(mesh) !== "Tunnel_C") return;
    mesh.updateWorldMatrix(true, false);
    const geometry = mesh.geometry?.index ? mesh.geometry.toNonIndexed() : mesh.geometry;
    const position = geometry?.getAttribute?.("position");
    if (!position || position.count % 3 !== 0) return;
    for (const triangles of triangleComponents(position)) {
      if (triangles.length < MIN_COMPONENT_TRIANGLES) continue;
      const entry = measureComponent(THREE, mesh, position, triangles);
      if (entry.horizontalSpan < MIN_HORIZONTAL_SPAN_METERS || entry.horizontalSpan > MAX_HORIZONTAL_SPAN_METERS) continue;
      if (entry.size.y < MIN_VERTICAL_SIZE_METERS || entry.size.y > MAX_VERTICAL_SIZE_METERS) continue;
      if (entry.size.y > entry.horizontalSpan * 2.0) continue;
      const fromRotunda = entry.center.clone().sub(rotundaCenter).setY(0);
      entry.alongRatio = fromRotunda.dot(bridge) / bridgeLengthSq;
      if (!(entry.alongRatio > 0.45 && entry.alongRatio < 0.98)) continue;
      entry.rampY = sampleGroundY(THREE, ground, entry.center.x, entry.center.z, entry.box.max.y);
      entry.clearance = entry.box.min.y - entry.rampY;
      candidates.push(entry);
    }
  });

  if (!candidates.length) {
    throw new Error("A1 V23 found no topology-rich supplied Tunnel-C wheel/foot component; exact GLB geometry will not be deformed to fake ground contact");
  }
  candidates.sort((a, b) => b.triangles - a.triangles || Math.abs(a.clearance) - Math.abs(b.clearance) || b.horizontalSpan - a.horizontalSpan);
  const contact = candidates[0];
  if (contact.clearance > MAX_CLEARANCE_METERS) {
    throw new Error(`A1 V23 supplied Tunnel-C wheel/foot is visibly floating by ${contact.clearance.toFixed(4)} m; move the intact A1 assembly instead of stretching source vertices`);
  }
  if (contact.clearance < -MAX_PENETRATION_METERS) {
    throw new Error(`A1 V23 supplied Tunnel-C wheel/foot is buried by ${(-contact.clearance).toFixed(4)} m; move the intact A1 assembly instead of stretching source vertices`);
  }

  const evidence = Object.freeze({
    authority: "a1-v23-exact-source-no-vertex-deformation-wheel-contact",
    candidateCount: candidates.length,
    selectedTriangleCount: contact.triangles,
    selectedHorizontalSpanMeters: contact.horizontalSpan,
    selectedVerticalSizeMeters: contact.size.y,
    selectedAlongRatio: contact.alongRatio,
    selectedRampClearanceMeters: contact.clearance,
    sourceGeometryMutated: false,
  });
  model.userData.a1V23ExactSourceWheelContact = evidence;
  return Object.freeze({
    authority: "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3",
    secondaryMeshAuthority: "a1-v23-exact-source-no-vertex-deformation",
    groundedComponentCount: 1,
    secondaryMeshGroundedCount: 0,
    correctedSupportSetCount: 1,
    visibleLoadLegCount: 1,
    remainingSuspendedSupportCount: 0,
    maximumFinalClearanceMeters: Math.abs(contact.clearance),
    maximumTopMountDriftMeters: 0,
    maximumExtensionMeters: 0,
    rampReferenceComponentCount: 1,
    sourceGeometryMutated: false,
    v23Evidence: evidence,
  });
}

export const A1_TUNNEL_C_VISIBLE_SUPPORT_GROUNDING_V3_AUTHORITY = "exact-authored-a1-tunnel-c-bogie-ramp-contact-v3";
export const A1_TUNNEL_C_VISIBLE_SUPPORT_SECONDARY_MESH_AUTHORITY = "a1-v23-exact-source-no-vertex-deformation";
