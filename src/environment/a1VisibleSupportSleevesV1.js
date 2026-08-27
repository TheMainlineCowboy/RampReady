const AUTHORITY = "a1-exact-visible-support-lower-sleeves-to-rendered-pavement-v1";
const GROUND_NAMES = Object.freeze([
  "PHX_KPHX_AuthoredAirportWideGround",
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);
const CONTACT_TOLERANCE = 0.015;
const MAX_EXTENSION = 4.0;
const OVERLAP = 0.035;
const REQUIRED_SLEEVE_COUNT = 4;
const VERTEX_KEY_SCALE = 10000;

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
  throw new Error("A1 support sleeves cannot resolve rendered KPHX pavement");
}

function groundYAt(THREE, ground, x, z, yHint = 4) {
  const ray = new THREE.Raycaster(
    new THREE.Vector3(x, yHint + 50, z),
    new THREE.Vector3(0, -1, 0),
    0,
    250,
  );
  const hit = ray.intersectObject(ground, true)[0];
  if (!hit?.point) throw new Error(`A1 support sleeve pavement ray miss at ${x},${z}`);
  return hit.point.y;
}

function objectCenter(THREE, object) {
  if (!object) return null;
  const box = new THREE.Box3().setFromObject(object);
  return box.isEmpty() ? null : box.getCenter(new THREE.Vector3());
}

function vertexKey(position, index) {
  return `${Math.round(position.getX(index) * VERTEX_KEY_SCALE)},${Math.round(position.getY(index) * VERTEX_KEY_SCALE)},${Math.round(position.getZ(index) * VERTEX_KEY_SCALE)}`;
}

function triangleComponents(mesh) {
  const geometry = mesh.geometry;
  const position = geometry?.getAttribute?.("position");
  if (!position) return [];
  const index = geometry.index;
  const triangleCount = Math.floor((index?.count ?? position.count) / 3);
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
      const positionIndex = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
      const key = index ? `i${positionIndex}` : vertexKey(position, positionIndex);
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

function componentBounds(THREE, mesh, triangles) {
  const position = mesh.geometry.getAttribute("position");
  const index = mesh.geometry.index;
  const box = new THREE.Box3();
  const local = new THREE.Vector3();
  for (const triangle of triangles) {
    for (let corner = 0; corner < 3; corner += 1) {
      const positionIndex = index ? index.getX(triangle * 3 + corner) : triangle * 3 + corner;
      local.fromBufferAttribute(position, positionIndex);
      box.expandByPoint(local.clone().applyMatrix4(mesh.matrixWorld));
    }
  }
  return box;
}

function bridgeLocation(center, rotundaWorld, cabWorld) {
  if (!rotundaWorld || !cabWorld) return { alongRatio: NaN, lateralDistance: NaN };
  const bridge = cabWorld.clone().sub(rotundaWorld).setY(0);
  const lengthSq = bridge.lengthSq();
  if (lengthSq < 1) return { alongRatio: NaN, lateralDistance: NaN };
  const fromRotunda = center.clone().sub(rotundaWorld).setY(0);
  const alongRatio = fromRotunda.dot(bridge) / lengthSq;
  const projected = rotundaWorld.clone().addScaledVector(bridge, alongRatio);
  const lateralDistance = Math.hypot(center.x - projected.x, center.z - projected.z);
  return { alongRatio, lateralDistance };
}

function sleeveMaterial(THREE) {
  return new THREE.MeshStandardMaterial({
    name: "A1 generated lower support sleeve",
    color: 0x252a2d,
    roughness: 0.82,
    metalness: 0.28,
  });
}

function collectLiveSupportCandidates(THREE, model, ground) {
  const rotundaWorld = objectCenter(THREE, model.getObjectByName("Rotunda"));
  const cabWorld = objectCenter(THREE, model.getObjectByName("Cab"));
  if (!rotundaWorld || !cabWorld) throw new Error("A1 support sleeves cannot resolve Rotunda/Cab bridge axis");

  const carrierMeshes = [];
  model.traverse((entry) => {
    if (entry?.isMesh && entry.visible !== false && entry.name === "Tunnel_B_Jetway_0") carrierMeshes.push(entry);
  });
  if (!carrierMeshes.length) throw new Error("A1 support sleeves cannot resolve Tunnel_B_Jetway_0 support carrier");

  const candidates = [];
  for (const mesh of carrierMeshes) {
    mesh.updateWorldMatrix(true, false);
    for (const triangles of triangleComponents(mesh)) {
      const bounds = componentBounds(THREE, mesh, triangles);
      if (bounds.isEmpty()) continue;
      const size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3());
      const horizontalSpan = Math.max(size.x, size.z);
      const verticalAspect = size.y / Math.max(horizontalSpan, 0.01);
      const { alongRatio, lateralDistance } = bridgeLocation(center, rotundaWorld, cabWorld);
      if (!(triangles.length >= 2 && triangles.length <= 600)) continue;
      if (!(size.y >= 0.18 && size.y <= 3.2)) continue;
      if (!(horizontalSpan >= 0.015 && horizontalSpan <= 0.38)) continue;
      if (!(verticalAspect >= 1.2)) continue;
      if (!(Number.isFinite(alongRatio) && alongRatio >= 0.35 && alongRatio <= 1.10)) continue;
      if (!(Number.isFinite(lateralDistance) && lateralDistance <= 5.0)) continue;
      const rampY = groundYAt(THREE, ground, center.x, center.z, Math.max(4, bounds.max.y));
      const extension = bounds.min.y - rampY;
      if (!(extension > CONTACT_TOLERANCE && extension <= MAX_EXTENSION)) continue;
      candidates.push({
        mesh,
        triangles,
        bounds,
        size,
        center,
        horizontalSpan,
        verticalAspect,
        alongRatio,
        lateralDistance,
        rampY,
        extension,
        score: verticalAspect * 4 - horizontalSpan * 2 - lateralDistance - Math.abs(alongRatio - 0.72),
      });
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  if (candidates.length < REQUIRED_SLEEVE_COUNT) {
    throw new Error(`A1 support sleeves found only ${candidates.length} live suspended narrow support components`);
  }
  return candidates.slice(0, REQUIRED_SLEEVE_COUNT);
}

export function addA1VisibleSupportSleevesToPavement(THREE, model) {
  if (!model?.isObject3D) throw new Error("A1 support sleeves require the final exact A1 model");
  const existing = model.getObjectByName?.("A1VisibleSupportSleevesToPavement");
  if (existing) return existing.userData.report;

  const root = rootOf(model);
  const ground = groundOf(root);
  root.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);

  const selectedSupports = collectLiveSupportCandidates(THREE, model, ground);
  const sleeves = new THREE.Group();
  sleeves.name = "A1VisibleSupportSleevesToPavement";
  const material = sleeveMaterial(THREE);
  let maximumExtension = 0;
  let maximumFinalClearance = 0;
  const evidence = [];

  for (let index = 0; index < selectedSupports.length; index += 1) {
    const selected = selectedSupports[index];
    const width = Math.max(0.075, Math.min(0.18, selected.size.x));
    const depth = Math.max(0.075, Math.min(0.18, selected.size.z));
    const sleeveHeight = selected.extension + OVERLAP;
    const worldCenter = new THREE.Vector3(
      selected.center.x,
      selected.rampY + sleeveHeight * 0.5,
      selected.center.z,
    );
    const localCenter = model.worldToLocal(worldCenter.clone());
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(width, sleeveHeight, depth), material);
    sleeve.name = `A1VisibleSupportSleeve_live-${index + 1}`;
    sleeve.position.copy(localCenter);
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    sleeves.add(sleeve);

    maximumExtension = Math.max(maximumExtension, selected.extension);
    const finalBottomY = selected.rampY;
    maximumFinalClearance = Math.max(maximumFinalClearance, Math.abs(finalBottomY - selected.rampY));
    evidence.push(Object.freeze({
      target: `live-${index + 1}`,
      triangleCount: selected.triangles.length,
      sourceBottomY: selected.bounds.min.y,
      sourceTopY: selected.bounds.max.y,
      rampY: selected.rampY,
      extension: selected.extension,
      width,
      depth,
      alongRatio: selected.alongRatio,
      lateralDistance: selected.lateralDistance,
      verticalAspect: selected.verticalAspect,
    }));
  }

  model.add(sleeves);
  model.updateWorldMatrix(true, true);
  const report = Object.freeze({
    authority: AUTHORITY,
    sleeveCount: sleeves.children.length,
    maximumExtensionMeters: maximumExtension,
    maximumFinalClearanceMeters: maximumFinalClearance,
    sourceGeometryMutated: false,
    detectionAuthority: "live-exact-tunnel-b-disconnected-vertical-components-v2",
    evidence,
  });
  sleeves.userData.report = report;
  model.userData.a1VisibleSupportSleeves = report;
  return report;
}

export { AUTHORITY as A1_VISIBLE_SUPPORT_SLEEVE_AUTHORITY };
