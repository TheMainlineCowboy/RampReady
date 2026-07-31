const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const STRUCTURAL_FACADE_MATERIAL = /BGATE|DGATE|PHX_TERM400/i;
const FACADE_CONTINUITY_EXCLUDED_GATES = new Set(["A1"]);

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

export function buildTerminal4FacadeContinuity(THREE, terminal, jetways, parkingByGate, materials, sceneOffset = [0, 0, 6.2]) {
  const group = new THREE.Group();
  group.name = "Terminal4_ContinuousStructuralLowerFacade_V8";
  const records = [];

  for (const jetway of jetways) {
    // A1 is a corner gate with a long fixed terminal walkway. A generic
    // minimum-width continuity panel projects into the ramp at this location
    // and obscures the authored corner. The measured walkway and localized V9
    // source skin provide the connection here; V8 remains active elsewhere.
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

  group.userData.panelCount = records.length;
  group.userData.doorCount = doorCount;
  group.userData.ventCount = ventCount;
  group.userData.widestPanelMeters = widestPanelMeters;
  group.userData.maximumAlignedGapMeters = maximumAlignedGapMeters;
  group.userData.excludedGates = [...FACADE_CONTINUITY_EXCLUDED_GATES];
  group.userData.authority = "structural-facade-neighbor-span-continuity-v8-no-repeated-black-bays";
  return group;
}
