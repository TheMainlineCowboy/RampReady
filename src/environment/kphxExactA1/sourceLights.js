const LIGHTED_LINE_PREFIX = "KPHX_A1_ExactPaintedLineType_";
const SAMPLE_SPACING_METERS = 5.5;
const DEDUPE_GRID_METERS = 1.35;
const MAX_VISIBLE_LIGHTS = 900;
const MAX_PHYSICAL_LIGHTS = 36;

function materialFor(node) {
  return Array.isArray(node.material) ? node.material[0] : node.material;
}

function colorHex(material) {
  return material?.color?.getHex?.() ?? 0xffd86a;
}

function appendSegmentSamples(target, seen, start, end, y, color) {
  const dx = end[0] - start[0];
  const dz = end[1] - start[1];
  const length = Math.hypot(dx, dz);
  if (!(length > 0.01)) return;
  const sampleCount = Math.max(1, Math.ceil(length / SAMPLE_SPACING_METERS));
  for (let index = 0; index <= sampleCount; index += 1) {
    const ratio = index / sampleCount;
    const x = start[0] + dx * ratio;
    const z = start[1] + dz * ratio;
    const key = `${color}:${Math.round(x / DEDUPE_GRID_METERS)}:${Math.round(z / DEDUPE_GRID_METERS)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    target.push({ x, y, z, color, distance: Math.hypot(x, z) });
  }
}

function collectLightPoints(exactA1) {
  const points = [];
  const seen = new Set();
  exactA1.traverse((node) => {
    if (!node.isMesh || !node.name.startsWith(LIGHTED_LINE_PREFIX)) return;
    const material = materialFor(node);
    if (!material || material.toneMapped !== false) return;
    const position = node.geometry?.getAttribute?.("position");
    if (!position || position.itemSize !== 3) return;
    const color = colorHex(material);

    // Each source strip is emitted as four consecutive vertices:
    // a+normal, b+normal, b-normal, a-normal. Reconstruct its center segment
    // and place discrete fixtures along that exact decoded source geometry.
    for (let offset = 0; offset + 3 < position.count; offset += 4) {
      const start = [
        (position.getX(offset) + position.getX(offset + 3)) / 2,
        (position.getZ(offset) + position.getZ(offset + 3)) / 2,
      ];
      const end = [
        (position.getX(offset + 1) + position.getX(offset + 2)) / 2,
        (position.getZ(offset + 1) + position.getZ(offset + 2)) / 2,
      ];
      const y = Math.max(
        position.getY(offset),
        position.getY(offset + 1),
        position.getY(offset + 2),
        position.getY(offset + 3),
      ) + 0.055;
      appendSegmentSamples(points, seen, start, end, y, color);
    }
  });

  points.sort((left, right) => left.distance - right.distance || left.color - right.color);
  return points.slice(0, MAX_VISIBLE_LIGHTS);
}

function addInstancedLights(THREE, root, points, color, geometry, haloGeometry) {
  if (!points.length) return;
  const fixtureMaterial = new THREE.MeshBasicMaterial({
    color,
    toneMapped: false,
    depthWrite: false,
  });
  const haloMaterial = new THREE.MeshBasicMaterial({
    color,
    toneMapped: false,
    transparent: true,
    opacity: 0.22,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const fixtures = new THREE.InstancedMesh(geometry, fixtureMaterial, points.length);
  const halos = new THREE.InstancedMesh(haloGeometry, haloMaterial, points.length);
  fixtures.name = `KPHX_A1_SourceLightFixtures_${color.toString(16)}`;
  halos.name = `KPHX_A1_SourceLightHalos_${color.toString(16)}`;
  fixtures.frustumCulled = true;
  halos.frustumCulled = true;
  fixtures.renderOrder = 480;
  halos.renderOrder = 481;

  const transform = new THREE.Object3D();
  points.forEach((point, index) => {
    transform.position.set(point.x, point.y, point.z);
    transform.updateMatrix();
    fixtures.setMatrixAt(index, transform.matrix);
    halos.setMatrixAt(index, transform.matrix);
  });
  fixtures.instanceMatrix.needsUpdate = true;
  halos.instanceMatrix.needsUpdate = true;
  root.add(fixtures, halos);
}

export function installExactKphxA1SourceLights(THREE, exactA1) {
  if (!exactA1?.isGroup) throw new Error("Exact KPHX A1 root is required for source lighting");
  const root = new THREE.Group();
  root.name = "KPHX_A1_ExactSourceLighting";
  const points = collectLightPoints(exactA1);
  const byColor = new Map();
  for (const point of points) {
    const entries = byColor.get(point.color) ?? [];
    entries.push(point);
    byColor.set(point.color, entries);
  }

  const fixtureGeometry = new THREE.IcosahedronGeometry(0.075, 0);
  const haloGeometry = new THREE.IcosahedronGeometry(0.18, 1);
  for (const [color, entries] of byColor) {
    addInstancedLights(THREE, root, entries, color, fixtureGeometry, haloGeometry);
  }

  // A small nearest-to-A1 subset contributes real light to nearby equipment.
  // The full source set remains inexpensive emissive instancing.
  for (const point of points.slice(0, MAX_PHYSICAL_LIGHTS)) {
    const light = new THREE.PointLight(point.color, 0.42, 8, 2);
    light.name = "KPHX_A1_SourcePhotometricLight";
    light.position.set(point.x, point.y + 0.12, point.z);
    root.add(light);
  }

  root.userData.source = "unmlobo-kphx-v181-lighted-painted-line-records";
  root.userData.fixtureCount = points.length;
  root.userData.physicalLightCount = Math.min(points.length, MAX_PHYSICAL_LIGHTS);
  root.userData.colorGroupCount = byColor.size;
  root.userData.sampleSpacingMeters = SAMPLE_SPACING_METERS;
  root.userData.detailLevel = "exact-a1-source-light-fixtures-v1";
  exactA1.add(root);
  return root;
}
