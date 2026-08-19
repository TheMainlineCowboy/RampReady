const AUTHORITY = "a1-exact-visible-support-lower-sleeves-to-rendered-pavement-v1";
const GROUND_NAMES = Object.freeze([
  "PHX_KPHX_AuthoredAirportWideGround",
  "PHX_KPHX_SourceAuthoredPhotoGround_Tiled",
  "PHX_KPHX_SourceAuthoredPhotoGround",
]);
const TARGETS = Object.freeze([
  Object.freeze({ name: "outboard-a", minX: -11.31, maxX: -11.20, minZ: 10.04, maxZ: 10.17, maxHeightAboveRamp: 2.35 }),
  Object.freeze({ name: "outboard-b", minX: -13.10, maxX: -13.00, minZ: 10.27, maxZ: 10.40, maxHeightAboveRamp: 2.20 }),
  Object.freeze({ name: "thin-a", minX: -11.87, maxX: -11.74, minZ: 9.96, maxZ: 10.18, maxHeightAboveRamp: 2.45 }),
  Object.freeze({ name: "thin-b", minX: -12.43, maxX: -12.30, minZ: 10.02, maxZ: 10.23, maxHeightAboveRamp: 2.45 }),
]);
const CONTACT_TOLERANCE = 0.015;
const MAX_EXTENSION = 4.0;
const OVERLAP = 0.035;

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

function trianglePoints(THREE, mesh, position, triangleIndex) {
  const points = [];
  const local = new THREE.Vector3();
  const index = mesh.geometry.index;
  for (let corner = 0; corner < 3; corner += 1) {
    const vertexIndex = index ? index.getX(triangleIndex * 3 + corner) : triangleIndex * 3 + corner;
    local.fromBufferAttribute(position, vertexIndex);
    points.push(local.clone().applyMatrix4(mesh.matrixWorld));
  }
  return points;
}

function targetBounds(THREE, mesh, target, rampY) {
  const position = mesh.geometry?.getAttribute?.("position");
  if (!position) return null;
  const triangleCount = Math.floor((mesh.geometry.index?.count ?? position.count) / 3);
  const bounds = new THREE.Box3();
  let selectedTriangles = 0;
  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const points = trianglePoints(THREE, mesh, position, triangleIndex);
    const cx = (points[0].x + points[1].x + points[2].x) / 3;
    const cz = (points[0].z + points[1].z + points[2].z) / 3;
    if (cx < target.minX || cx > target.maxX || cz < target.minZ || cz > target.maxZ) continue;
    const minY = Math.min(points[0].y, points[1].y, points[2].y);
    const maxY = Math.max(points[0].y, points[1].y, points[2].y);
    if (maxY > rampY + target.maxHeightAboveRamp || minY < rampY - 0.08) continue;
    for (const point of points) bounds.expandByPoint(point);
    selectedTriangles += 1;
  }
  return selectedTriangles >= 2 && !bounds.isEmpty() ? { bounds, selectedTriangles } : null;
}

function sleeveMaterial(THREE) {
  return new THREE.MeshStandardMaterial({
    name: "A1 generated lower support sleeve",
    color: 0x252a2d,
    roughness: 0.82,
    metalness: 0.28,
  });
}

export function addA1VisibleSupportSleevesToPavement(THREE, model) {
  if (!model?.isObject3D) throw new Error("A1 support sleeves require the final exact A1 model");
  const existing = model.getObjectByName?.("A1VisibleSupportSleevesToPavement");
  if (existing) return existing.userData.report;

  const root = rootOf(model);
  const ground = groundOf(root);
  root.updateWorldMatrix?.(true, true);
  model.updateWorldMatrix(true, true);

  const carrierMeshes = [];
  model.traverse((entry) => {
    if (entry?.isMesh && entry.visible !== false && entry.name === "Tunnel_B_Jetway_0") carrierMeshes.push(entry);
  });
  if (!carrierMeshes.length) throw new Error("A1 support sleeves cannot resolve Tunnel_B_Jetway_0 support carrier");

  const sleeves = new THREE.Group();
  sleeves.name = "A1VisibleSupportSleevesToPavement";
  const material = sleeveMaterial(THREE);
  let maximumExtension = 0;
  let maximumFinalClearance = 0;
  const evidence = [];

  for (const target of TARGETS) {
    const cx = (target.minX + target.maxX) * 0.5;
    const cz = (target.minZ + target.maxZ) * 0.5;
    const rampY = groundYAt(THREE, ground, cx, cz);
    let selected = null;
    for (const mesh of carrierMeshes) {
      mesh.updateWorldMatrix(true, false);
      const candidate = targetBounds(THREE, mesh, target, rampY);
      if (candidate && (!selected || candidate.selectedTriangles > selected.selectedTriangles)) selected = candidate;
    }
    if (!selected) throw new Error(`A1 support sleeve ${target.name} could not resolve its exact visible rod surface`);

    const sourceBottomY = selected.bounds.min.y;
    const extension = sourceBottomY - rampY;
    if (!(extension > CONTACT_TOLERANCE && extension <= MAX_EXTENSION)) {
      throw new Error(`A1 support sleeve ${target.name} extension is invalid: ${extension}`);
    }

    const width = Math.max(0.075, Math.min(0.18, selected.bounds.max.x - selected.bounds.min.x));
    const depth = Math.max(0.075, Math.min(0.18, selected.bounds.max.z - selected.bounds.min.z));
    const sleeveHeight = extension + OVERLAP;
    const worldCenter = new THREE.Vector3(
      (selected.bounds.min.x + selected.bounds.max.x) * 0.5,
      rampY + sleeveHeight * 0.5,
      (selected.bounds.min.z + selected.bounds.max.z) * 0.5,
    );
    const localCenter = model.worldToLocal(worldCenter.clone());
    const sleeve = new THREE.Mesh(
      new THREE.BoxGeometry(width, sleeveHeight, depth),
      material,
    );
    sleeve.name = `A1VisibleSupportSleeve_${target.name}`;
    sleeve.position.copy(localCenter);
    sleeve.castShadow = true;
    sleeve.receiveShadow = true;
    sleeves.add(sleeve);

    maximumExtension = Math.max(maximumExtension, extension);
    const finalBottomY = rampY;
    maximumFinalClearance = Math.max(maximumFinalClearance, Math.abs(finalBottomY - rampY));
    evidence.push(Object.freeze({
      target: target.name,
      selectedTriangles: selected.selectedTriangles,
      sourceBottomY,
      rampY,
      extension,
      width,
      depth,
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
    evidence,
  });
  sleeves.userData.report = report;
  model.userData.a1VisibleSupportSleeves = report;
  return report;
}

export { AUTHORITY as A1_VISIBLE_SUPPORT_SLEEVE_AUTHORITY };
