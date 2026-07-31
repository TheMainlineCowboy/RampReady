const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const STRUCTURAL_FACADE_MATERIAL = /BGATE|DGATE|PHX_TERM400/i;
const FACADE_CONTINUITY_EXCLUDED_GATES = new Set(["A1", "A3"]);

// Exact authored BGATE1 wall plane near A3. Coordinates are expressed in the
// source-placed jetway group before its +6.2 m Z scene offset. This adds only
// architectural detail on the ramp-facing side of the valid source wall; it
// does not replace, move, or delete Terminal 4 geometry.
const A3_CORNER_WALL = Object.freeze({
  centerX: 25.0,
  planeZ: -30.343,
  width: 24.0,
  height: 8.2,
  jetwayCenterX: 20.38,
  rampFacingZSign: 1,
});

function structuralFacadeDistance(THREE, terminal, originX, originZ, towardX, towardZ, height) {
  terminal.updateMatrixWorld(true);
  const origin = new THREE.Vector3(originX, height, originZ);
  const direction = new THREE.Vector3(towardX, 0, towardZ).normalize();
  const raycaster = new THREE.Raycaster(origin, direction, 0.05, 52);
  const hit = raycaster.intersectObject(terminal, true).find((entry) => {
    if (entry.object?.visible === false) return false;
    const materials = Array.isArray(entry.object?.material) ? entry.object.material : [entry.object?.material];
    const material = materials[entry.face?.materialIndex ?? 0] ?? materials[0];
    return STRUCTURAL_FACADE_MATERIAL.test(material?.name || "");
  });
  return hit?.distance > 0.05 ? hit.distance : null;
}

function gateHash(gate) {
  return [...String(gate)].reduce((value, character) => ((value * 33) ^ character.charCodeAt(0)) >>> 0, 2166136261);
}

function mesh(THREE, geometry, material, name) {
  const result = new THREE.Mesh(geometry, material);
  result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

function addBox(THREE, parent, material, name, position, yaw, size) {
  const result = mesh(THREE, new THREE.BoxGeometry(...size), material, name);
  result.position.set(...position);
  result.rotation.y = yaw;
  parent.add(result);
  return result;
}

function buildA3CornerDetail(THREE, group, materials) {
  const detail = new THREE.Group();
  detail.name = "Terminal4_A3_SourceWallArchitecturalDetail_V11";

  const frameMaterial = materials.facadeDoor.clone();
  frameMaterial.name = "Terminal 4 A3 galvanized facade framing";
  frameMaterial.map = null;
  frameMaterial.color?.setHex(0x5d6266);
  frameMaterial.emissive?.setHex(0x000000);
  frameMaterial.emissiveIntensity = 0;
  frameMaterial.roughness = 0.58;
  frameMaterial.metalness = 0.28;

  const curbMaterial = materials.facadeDoor.clone();
  curbMaterial.name = "Terminal 4 A3 continuous source-wall curb";
  curbMaterial.map = null;
  curbMaterial.color?.setHex(0x5c5751);
  curbMaterial.emissive?.setHex(0x000000);
  curbMaterial.emissiveIntensity = 0;
  curbMaterial.roughness = 0.86;
  curbMaterial.metalness = 0.02;

  const doorMaterial = materials.facadeDoor.clone();
  doorMaterial.name = "Terminal 4 A3 source-wall service door";
  doorMaterial.map = null;
  doorMaterial.color?.setHex(0x777c7f);
  doorMaterial.emissive?.setHex(0x000000);
  doorMaterial.emissiveIntensity = 0;
  doorMaterial.roughness = 0.68;
  doorMaterial.metalness = 0.16;

  const ventMaterial = materials.facadeVent.clone();
  ventMaterial.name = "Terminal 4 A3 source-wall ventilation grille";
  ventMaterial.map = null;
  ventMaterial.color?.setHex(0x4d5357);
  ventMaterial.emissive?.setHex(0x000000);
  ventMaterial.emissiveIntensity = 0;
  ventMaterial.roughness = 0.63;
  ventMaterial.metalness = 0.32;

  const z = A3_CORNER_WALL.planeZ + 0.12;
  addBox(
    THREE,
    detail,
    curbMaterial,
    "Terminal 4 A3 source-wall base curb",
    [A3_CORNER_WALL.centerX, 0.14, z],
    0,
    [A3_CORNER_WALL.width, 0.28, 0.18],
  );

  for (const x of [14.2, 17.4, 23.35, 27.8, 32.4, 36.2]) {
    addBox(
      THREE,
      detail,
      frameMaterial,
      `Terminal 4 A3 vertical facade pilaster ${x.toFixed(1)}`,
      [x, A3_CORNER_WALL.height / 2, z + 0.02],
      0,
      [0.22, A3_CORNER_WALL.height, 0.18],
    );
  }

  for (const y of [3.32, 5.72]) {
    addBox(
      THREE,
      detail,
      frameMaterial,
      `Terminal 4 A3 horizontal facade beam ${y.toFixed(2)}`,
      [A3_CORNER_WALL.centerX, y, z + 0.03],
      0,
      [A3_CORNER_WALL.width, 0.16, 0.17],
    );
  }

  addBox(
    THREE,
    detail,
    doorMaterial,
    "Terminal 4 A3 closed ramp service door",
    [28.9, 1.16, z + 0.12],
    0,
    [1.52, 2.24, 0.14],
  );
  addBox(
    THREE,
    detail,
    frameMaterial,
    "Terminal 4 A3 service-door header",
    [28.9, 2.34, z + 0.15],
    0,
    [1.76, 0.14, 0.17],
  );
  addBox(
    THREE,
    detail,
    ventMaterial,
    "Terminal 4 A3 ventilation grille",
    [33.2, 2.18, z + 0.13],
    0,
    [1.86, 0.48, 0.14],
  );

  const portalHalfWidth = 1.62;
  const portalCenterY = 4.36;
  const portalHeight = 3.02;
  for (const side of [-1, 1]) {
    addBox(
      THREE,
      detail,
      frameMaterial,
      `Terminal 4 A3 jetway portal post ${side < 0 ? "left" : "right"}`,
      [A3_CORNER_WALL.jetwayCenterX + side * portalHalfWidth, portalCenterY, z + 0.18],
      0,
      [0.24, portalHeight, 0.22],
    );
  }
  for (const [name, y] of [["header", portalCenterY + portalHeight / 2], ["sill", portalCenterY - portalHeight / 2]]) {
    addBox(
      THREE,
      detail,
      frameMaterial,
      `Terminal 4 A3 jetway portal ${name}`,
      [A3_CORNER_WALL.jetwayCenterX, y, z + 0.18],
      0,
      [portalHalfWidth * 2 + 0.24, 0.22, 0.22],
    );
  }

  for (const x of [27.95, 29.85]) {
    addBox(
      THREE,
      detail,
      curbMaterial,
      `Terminal 4 A3 service-door bollard ${x.toFixed(2)}`,
      [x, 0.56, z + 0.62],
      0,
      [0.16, 1.12, 0.16],
    );
  }

  detail.userData.authority = "exact-BGATE1-source-wall-plane-ramp-facing-A3-architectural-detail-v11";
  detail.userData.sourceWallWorldPlaneZ = A3_CORNER_WALL.planeZ + 6.2;
  detail.userData.sourceWallLocalPlaneZ = A3_CORNER_WALL.planeZ;
  detail.userData.detailRampFaceWorldZ = z + 6.2;
  detail.userData.jetwayCenterX = A3_CORNER_WALL.jetwayCenterX;
  detail.userData.detailObjectCount = detail.children.length;
  group.add(detail);
  return detail;
}

export function buildTerminal4FacadeContinuity(THREE, terminal, jetways, parkingByGate, materials, sceneOffset = [0, 0, 6.2]) {
  const group = new THREE.Group();
  group.name = "Terminal4_ContinuousStructuralLowerFacade_V8";
  const records = [];

  for (const jetway of jetways) {
    // A1 and adjacent A3 form the Terminal 4 corner around the long fixed A1
    // walkway. Generic minimum-width panels from either gate overlap that
    // corner. Their valid authored wall remains active; A3 receives dedicated
    // ramp-facing source-plane detailing below instead of another opaque wall.
    if (FACADE_CONTINUITY_EXCLUDED_GATES.has(jetway.g)) continue;

    const parking = parkingByGate.get(jetway.g);
    const heading = THREE.MathUtils.degToRad(parking?.h ?? 0);
    const forwardX = Math.cos(heading);
    const forwardZ = Math.sin(heading);
    const leftX = forwardZ;
    const leftZ = -forwardX;
    const targetX = jetway.px - forwardX * 6.25 + leftX * 1.35;
    const targetZ = jetway.pz - forwardZ * 6.25 + leftZ * 1.35;
    let dx = targetX - jetway.x;
    let dz = targetZ - jetway.z;
    let distance = Math.hypot(dx, dz);
    if (distance < 2) {
      const fallback = THREE.MathUtils.degToRad(jetway.h);
      dx = Math.sin(fallback);
      dz = Math.cos(fallback);
      distance = 24;
    }
    const ux = dx / distance;
    const uz = dz / distance;
    const wallDistance = structuralFacadeDistance(
      THREE,
      terminal,
      jetway.x,
      jetway.z + sceneOffset[2],
      -ux,
      -uz,
      4.35,
    );
    if (wallDistance == null) continue;
    const outwardOffset = 0.52;
    records.push({
      gate: jetway.g,
      x: jetway.x - ux * wallDistance + ux * outwardOffset,
      z: jetway.z - uz * wallDistance + uz * outwardOffset,
      ux,
      uz,
      px: -uz,
      pz: ux,
      yaw: Math.atan2(ux, uz),
      wallDistance,
    });
  }

  const wallVariants = [0xc7b8a3, 0xbeb2a2, 0xd0c1ad].map((color, index) => {
    const material = materials.facadeWall.clone();
    material.name = `Terminal 4 structural lower facade variation ${index + 1}`;
    material.color?.setHex(color);
    material.emissive?.setHex(0x000000);
    material.emissiveIntensity = 0;
    material.roughness = 0.82;
    material.metalness = 0.025;
    return material;
  });
  const doorMaterial = materials.facadeDoor.clone();
  doorMaterial.name = "Terminal 4 irregular service doors v8";
  const ventMaterial = materials.facadeVent.clone();
  ventMaterial.name = "Terminal 4 irregular ventilation v8";
  const curbMaterial = materials.facadeDoor.clone();
  curbMaterial.name = "Terminal 4 continuous lower curb v8";
  curbMaterial.color?.setHex(0x655f58);

  let doorCount = 0;
  let ventCount = 0;
  let widestPanelMeters = 0;
  let maximumAlignedGapMeters = 0;

  for (const record of records) {
    const alignedGaps = records
      .filter((candidate) => candidate !== record && record.ux * candidate.ux + record.uz * candidate.uz > 0.82)
      .map((candidate) => {
        const vx = candidate.x - record.x;
        const vz = candidate.z - record.z;
        const lateral = Math.abs(vx * record.px + vz * record.pz);
        const depth = Math.abs(vx * record.ux + vz * record.uz);
        return { lateral, depth };
      })
      .filter(({ lateral, depth }) => lateral > 3 && lateral < 62 && depth < 7)
      .sort((a, b) => a.lateral - b.lateral);
    const alignedGap = alignedGaps[0]?.lateral ?? 13.5;
    maximumAlignedGapMeters = Math.max(maximumAlignedGapMeters, alignedGap);
    const width = clamp(alignedGap * 1.08, 12, 44);
    widestPanelMeters = Math.max(widestPanelMeters, width);
    const hash = gateHash(record.gate);
    const variant = hash % wallVariants.length;
    const wall = addBox(
      THREE,
      group,
      wallVariants[variant],
      `Terminal 4 continuous lower facade panel ${record.gate}`,
      [record.x, 1.72, record.z],
      record.yaw,
      [width, 3.38, 0.44],
    );
    wall.userData.gate = record.gate;
    wall.userData.structuralWallDistanceMeters = record.wallDistance;
    wall.userData.alignedFacadeSpanMeters = width;

    addBox(
      THREE,
      group,
      curbMaterial,
      `Terminal 4 continuous lower curb ${record.gate}`,
      [record.x + record.ux * 0.26, 0.14, record.z + record.uz * 0.26],
      record.yaw,
      [width, 0.28, 0.12],
    );

    if (hash % 5 === 0) {
      const side = hash % 2 === 0 ? -1 : 1;
      addBox(
        THREE,
        group,
        doorMaterial,
        `Terminal 4 irregular closed service door ${record.gate}`,
        [record.x + record.px * side * Math.min(width * 0.23, 3.2) + record.ux * 0.28, 1.1, record.z + record.pz * side * Math.min(width * 0.23, 3.2) + record.uz * 0.28],
        record.yaw,
        [1.35, 2.12, 0.13],
      );
      doorCount += 1;
    } else if (hash % 7 === 0) {
      const side = hash % 2 === 0 ? -1 : 1;
      addBox(
        THREE,
        group,
        ventMaterial,
        `Terminal 4 irregular lower facade vent ${record.gate}`,
        [record.x + record.px * side * Math.min(width * 0.25, 3.6) + record.ux * 0.28, 2.05, record.z + record.pz * side * Math.min(width * 0.25, 3.6) + record.uz * 0.28],
        record.yaw,
        [1.5, 0.42, 0.13],
      );
      ventCount += 1;
    }
  }

  const a3CornerDetail = buildA3CornerDetail(THREE, group, materials);
  group.userData.panelCount = records.length;
  group.userData.doorCount = doorCount;
  group.userData.ventCount = ventCount;
  group.userData.widestPanelMeters = widestPanelMeters;
  group.userData.maximumAlignedGapMeters = maximumAlignedGapMeters;
  group.userData.excludedGates = [...FACADE_CONTINUITY_EXCLUDED_GATES];
  group.userData.a3CornerDetailCount = a3CornerDetail.userData.detailObjectCount;
  group.userData.a3CornerDetailAuthority = a3CornerDetail.userData.authority;
  group.userData.authority = "structural-facade-neighbor-span-continuity-v8-with-ramp-facing-source-anchored-A3-detail-v11";
  return group;
}
