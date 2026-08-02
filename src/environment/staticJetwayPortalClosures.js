const STATIC_PORTAL_AUTHORITY = "57-static-terminal-portals-paired-vestibule-doors-v1";

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function buildInstancedBoxes(THREE, name, material, transforms) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const instances = new THREE.InstancedMesh(geometry, material, transforms.length);
  instances.name = name;
  instances.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  instances.castShadow = false;
  instances.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();
  transforms.forEach((transform, index) => {
    position.fromArray(transform.position);
    euler.set(0, transform.yaw, 0);
    quaternion.setFromEuler(euler);
    scale.fromArray(transform.scale);
    matrix.compose(position, quaternion, scale);
    instances.setMatrixAt(index, matrix);
  });
  instances.instanceMatrix.needsUpdate = true;
  instances.computeBoundingBox();
  instances.computeBoundingSphere();
  return instances;
}

export function installStaticJetwayPortalClosures(THREE, fleet, placements) {
  const existing = fleet.getObjectByName("UploadedAirportJetwayStaticPortalClosures");
  if (existing) {
    return {
      authority: existing.userData.authority,
      gateCount: Number(existing.userData.gateCount || 0),
      batchCount: Number(existing.userData.batchCount || 0),
      panelCount: Number(existing.userData.panelCount || 0),
      windowCount: Number(existing.userData.windowCount || 0),
    };
  }

  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  const doorTransforms = [];
  const windowTransforms = [];
  for (const placement of staticPlacements) {
    const towardX = Number(placement.connectorTowardX) || 0;
    const towardZ = Number(placement.connectorTowardZ) || 0;
    const magnitude = Math.hypot(towardX, towardZ) || 1;
    const ux = towardX / magnitude;
    const uz = towardZ / magnitude;
    const yaw = Math.atan2(ux, uz);
    const rightX = Math.cos(yaw);
    const rightZ = -Math.sin(yaw);
    const measuredLength = clamp(placement.wallConnectorLength, 1.25, 18);
    const facadeDistance = Math.max(0.85, measuredLength - 0.14);
    const facadeX = placement.x + ux * facadeDistance;
    const facadeZ = placement.z + uz * facadeDistance;
    const centerY = Number(placement.rotundaY) || 4.1;

    for (const side of [-1, 1]) {
      const sideOffset = side * 0.59;
      const panelX = facadeX + rightX * sideOffset - ux * 0.04;
      const panelZ = facadeZ + rightZ * sideOffset - uz * 0.04;
      doorTransforms.push({
        position: [panelX, centerY - 0.04, panelZ],
        yaw,
        scale: [1.13, 2.06, 0.12],
      });
      windowTransforms.push({
        position: [panelX - ux * 0.07, centerY + 0.32, panelZ - uz * 0.07],
        yaw,
        scale: [0.62, 0.62, 0.035],
      });
    }
  }

  const doorMaterial = new THREE.MeshStandardMaterial({
    name: "Static jetway terminal paired vestibule door",
    color: 0xaeb3b2,
    roughness: 0.64,
    metalness: 0.2,
    emissive: 0x171a1a,
    emissiveIntensity: 0.14,
    side: THREE.DoubleSide,
  });
  const windowMaterial = new THREE.MeshPhysicalMaterial({
    name: "Static jetway terminal vestibule door window",
    color: 0x35525e,
    roughness: 0.24,
    metalness: 0.04,
    transmission: 0.08,
    clearcoat: 0.18,
    transparent: true,
    opacity: 0.8,
    depthWrite: true,
    side: THREE.DoubleSide,
  });

  const group = new THREE.Group();
  group.name = "UploadedAirportJetwayStaticPortalClosures";
  group.add(
    buildInstancedBoxes(THREE, "StaticJetwayVestibuleDoorPanels", doorMaterial, doorTransforms),
    buildInstancedBoxes(THREE, "StaticJetwayVestibuleDoorWindows", windowMaterial, windowTransforms),
  );
  group.userData.authority = STATIC_PORTAL_AUTHORITY;
  group.userData.gateCount = staticPlacements.length;
  group.userData.batchCount = group.children.length;
  group.userData.panelCount = doorTransforms.length;
  group.userData.windowCount = windowTransforms.length;
  group.userData.a1LeftOpen = true;
  fleet.add(group);

  return {
    authority: STATIC_PORTAL_AUTHORITY,
    gateCount: staticPlacements.length,
    batchCount: group.children.length,
    panelCount: doorTransforms.length,
    windowCount: windowTransforms.length,
  };
}

export { STATIC_PORTAL_AUTHORITY as STATIC_JETWAY_PORTAL_CLOSURE_AUTHORITY };
