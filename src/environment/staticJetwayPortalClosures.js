const STATIC_PORTAL_AUTHORITY = "57-static-terminal-portals-paired-vestibule-doors-v1";
const STATIC_CAB_CLOSURE_AUTHORITY = "57-static-aircraft-facing-cab-portals-opaque-contact-plane-caps-v3";

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

function finitePositive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
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
      cabPanelCount: Number(existing.userData.cabPanelCount || 0),
      cabWindowCount: Number(existing.userData.cabWindowCount || 0),
      cabClosureAuthority: existing.userData.cabClosureAuthority || "missing",
    };
  }

  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  const doorTransforms = [];
  const windowTransforms = [];
  const cabPanelTransforms = [];
  const cabWindowTransforms = [];
  const cabHeaderTransforms = [];
  const cabJambTransforms = [];

  for (const placement of staticPlacements) {
    const towardX = Number(placement.connectorTowardX) || 0;
    const towardZ = Number(placement.connectorTowardZ) || 0;
    const magnitude = Math.hypot(towardX, towardZ) || 1;
    const ux = towardX / magnitude;
    const uz = towardZ / magnitude;
    const terminalYaw = Math.atan2(ux, uz);
    const rightX = Math.cos(terminalYaw);
    const rightZ = -Math.sin(terminalYaw);
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
        yaw: terminalYaw,
        scale: [1.13, 2.06, 0.12],
      });
      windowTransforms.push({
        position: [panelX - ux * 0.07, centerY + 0.32, panelZ - uz * 0.07],
        yaw: terminalYaw,
        scale: [0.62, 0.62, 0.035],
      });
    }

    // Straddle the authored aircraft-contact plane with a thick opaque cap.
    // This closes the aperture from either viewing side and avoids depending
    // on an exporter-specific Cab forward-axis sign. No GLB node is changed.
    const cabYaw = Number(placement.yaw) || 0;
    const cabForwardX = Math.sin(cabYaw);
    const cabForwardZ = Math.cos(cabYaw);
    const cabRightX = Math.cos(cabYaw);
    const cabRightZ = -Math.sin(cabYaw);
    const contactDistance = finitePositive(placement.bridgeEnd, 18);
    const cabFaceX = placement.x + cabForwardX * contactDistance;
    const cabFaceZ = placement.z + cabForwardZ * contactDistance;
    const cabCenterY = centerY + 0.02;

    cabPanelTransforms.push({
      position: [cabFaceX, cabCenterY, cabFaceZ],
      yaw: cabYaw,
      scale: [3.9, 3.5, 1.45],
    });
    cabWindowTransforms.push({
      position: [
        cabFaceX + cabForwardX * 0.76,
        cabCenterY + 0.35,
        cabFaceZ + cabForwardZ * 0.76,
      ],
      yaw: cabYaw,
      scale: [1.08, 0.72, 0.055],
    });
    for (const vertical of [-1, 1]) {
      cabHeaderTransforms.push({
        position: [
          cabFaceX + cabForwardX * 0.78,
          cabCenterY + vertical * 1.58,
          cabFaceZ + cabForwardZ * 0.78,
        ],
        yaw: cabYaw,
        scale: [4.05, 0.3, 0.18],
      });
    }
    for (const side of [-1, 1]) {
      cabJambTransforms.push({
        position: [
          cabFaceX + cabRightX * side * 1.82 + cabForwardX * 0.78,
          cabCenterY,
          cabFaceZ + cabRightZ * side * 1.82 + cabForwardZ * 0.78,
        ],
        yaw: cabYaw,
        scale: [0.3, 3.5, 0.18],
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
  const cabPanelMaterial = new THREE.MeshStandardMaterial({
    name: "Static jetway opaque aircraft interface cap",
    color: 0xd9dcda,
    roughness: 0.76,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const cabWindowMaterial = new THREE.MeshStandardMaterial({
    name: "Static jetway closed aircraft interface service window",
    color: 0x6f858c,
    roughness: 0.52,
    metalness: 0.08,
    transparent: false,
    side: THREE.DoubleSide,
  });
  const cabBellowsMaterial = new THREE.MeshStandardMaterial({
    name: "Static jetway aircraft interface rubber surround",
    color: 0x303336,
    roughness: 0.94,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });

  const group = new THREE.Group();
  group.name = "UploadedAirportJetwayStaticPortalClosures";
  group.add(
    buildInstancedBoxes(THREE, "StaticJetwayVestibuleDoorPanels", doorMaterial, doorTransforms),
    buildInstancedBoxes(THREE, "StaticJetwayVestibuleDoorWindows", windowMaterial, windowTransforms),
    buildInstancedBoxes(THREE, "StaticJetwayCabClosurePanels", cabPanelMaterial, cabPanelTransforms),
    buildInstancedBoxes(THREE, "StaticJetwayCabClosureWindows", cabWindowMaterial, cabWindowTransforms),
    buildInstancedBoxes(THREE, "StaticJetwayCabClosureHeaders", cabBellowsMaterial, cabHeaderTransforms),
    buildInstancedBoxes(THREE, "StaticJetwayCabClosureJambs", cabBellowsMaterial, cabJambTransforms),
  );
  group.userData.authority = STATIC_PORTAL_AUTHORITY;
  group.userData.cabClosureAuthority = STATIC_CAB_CLOSURE_AUTHORITY;
  group.userData.gateCount = staticPlacements.length;
  group.userData.batchCount = group.children.length;
  group.userData.panelCount = doorTransforms.length;
  group.userData.windowCount = windowTransforms.length;
  group.userData.cabPanelCount = cabPanelTransforms.length;
  group.userData.cabWindowCount = cabWindowTransforms.length;
  group.userData.cabSurroundPieceCount = cabHeaderTransforms.length + cabJambTransforms.length;
  group.userData.a1LeftOpen = true;
  group.userData.authoredNodeTransformCount = 0;
  group.userData.opaqueCabCapDepthMeters = 1.45;
  group.userData.apronFacingOpenAreaMeters = 0;
  fleet.add(group);

  return {
    authority: STATIC_PORTAL_AUTHORITY,
    cabClosureAuthority: STATIC_CAB_CLOSURE_AUTHORITY,
    gateCount: staticPlacements.length,
    batchCount: group.children.length,
    panelCount: doorTransforms.length,
    windowCount: windowTransforms.length,
    cabPanelCount: cabPanelTransforms.length,
    cabWindowCount: cabWindowTransforms.length,
    cabSurroundPieceCount: cabHeaderTransforms.length + cabJambTransforms.length,
  };
}

export { STATIC_PORTAL_AUTHORITY as STATIC_JETWAY_PORTAL_CLOSURE_AUTHORITY };
export { STATIC_CAB_CLOSURE_AUTHORITY as STATIC_JETWAY_CAB_CLOSURE_AUTHORITY };
