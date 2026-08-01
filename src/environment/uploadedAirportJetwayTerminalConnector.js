const CONNECTOR_AUTHORITY = "measured-authored-terminal-wall-to-uploaded-rotunda-v3-a1-deep-overlap-terminal-frame";

function addBox(THREE, parent, geometry, material, name, position, yaw, castShadow = false) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.y = yaw;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function addUploadedAirportJetwayTerminalConnector(THREE, fleet, placement) {
  const measuredLength = Math.max(1.25, Math.min(18, Number(placement.wallConnectorLength) || 1.25));
  const terminalOverlap = placement.gate === "A1" ? 1.45 : 0.55;
  const length = Math.max(1.8, Math.min(19.5, measuredLength + terminalOverlap));
  const towardX = Number(placement.connectorTowardX) || 0;
  const towardZ = Number(placement.connectorTowardZ) || 0;
  const magnitude = Math.hypot(towardX, towardZ) || 1;
  const ux = towardX / magnitude;
  const uz = towardZ / magnitude;
  const connector = new THREE.Group();
  connector.name = `UploadedAirportJetwayTerminalConnector_${placement.gate}`;
  connector.userData.connectorAuthority = CONNECTOR_AUTHORITY;
  connector.userData.connectorLengthMeters = length;
  connector.userData.measuredWallLengthMeters = measuredLength;
  connector.userData.terminalOverlapMeters = terminalOverlap;

  const shellMaterial = new THREE.MeshStandardMaterial({
    name: `Uploaded airport jetway fixed terminal connector ${placement.gate}`,
    color: 0xd4d2cc,
    roughness: 0.7,
    metalness: 0.07,
    side: THREE.DoubleSide,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    name: `Uploaded airport jetway fixed connector frame ${placement.gate}`,
    color: 0x555b5e,
    roughness: 0.56,
    metalness: 0.38,
    side: THREE.DoubleSide,
  });
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    name: `Uploaded airport jetway fixed connector glazing ${placement.gate}`,
    color: 0x597784,
    roughness: 0.28,
    metalness: 0.04,
    transmission: 0.08,
    clearcoat: 0.18,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const centerX = placement.x + ux * length * 0.5;
  const centerZ = placement.z + uz * length * 0.5;
  const centerY = Number(placement.rotundaY) || 4.1;
  const yaw = Math.atan2(ux, uz);
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  const span = length + 0.35;
  const halfWidth = 1.31;
  const castDynamicShadow = placement.gate === "A1";

  addBox(
    THREE,
    connector,
    new THREE.BoxGeometry(2.68, 0.18, span),
    shellMaterial,
    `UploadedAirportJetwayTerminalConnectorRoof_${placement.gate}`,
    [centerX, centerY + 1.19, centerZ],
    yaw,
    castDynamicShadow,
  );
  addBox(
    THREE,
    connector,
    new THREE.BoxGeometry(2.58, 0.16, span),
    frameMaterial,
    `UploadedAirportJetwayTerminalConnectorFloor_${placement.gate}`,
    [centerX, centerY - 1.17, centerZ],
    yaw,
    castDynamicShadow,
  );

  for (const side of [-1, 1]) {
    const sideOffsetX = sideX * side * halfWidth;
    const sideOffsetZ = sideZ * side * halfWidth;
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(0.12, 0.88, span),
      shellMaterial,
      `UploadedAirportJetwayTerminalConnectorLowerPanel_${placement.gate}_${side}`,
      [centerX + sideOffsetX, centerY - 0.66, centerZ + sideOffsetZ],
      yaw,
      castDynamicShadow,
    );
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(0.035, 1.0, Math.max(0.8, length - 0.12)),
      glassMaterial,
      `UploadedAirportJetwayTerminalConnectorWindow_${placement.gate}_${side}`,
      [centerX + sideOffsetX * 1.008, centerY + 0.31, centerZ + sideOffsetZ * 1.008],
      yaw,
      false,
    );
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(0.12, 0.18, span),
      frameMaterial,
      `UploadedAirportJetwayTerminalConnectorUpperRail_${placement.gate}_${side}`,
      [centerX + sideOffsetX, centerY + 0.86, centerZ + sideOffsetZ],
      yaw,
      castDynamicShadow,
    );
  }

  for (const end of [-1, 1]) {
    const alongX = ux * end * length * 0.5;
    const alongZ = uz * end * length * 0.5;
    for (const side of [-1, 1]) {
      addBox(
        THREE,
        connector,
        new THREE.BoxGeometry(0.14, 2.25, 0.14),
        frameMaterial,
        `UploadedAirportJetwayTerminalConnectorEndPost_${placement.gate}_${end}_${side}`,
        [
          centerX + alongX + sideX * side * halfWidth,
          centerY,
          centerZ + alongZ + sideZ * side * halfWidth,
        ],
        yaw,
        castDynamicShadow,
      );
    }
  }

  if (placement.gate === "A1") {
    for (const fraction of [0.24, 0.5, 0.76]) {
      const alongX = ux * (fraction - 0.5) * length;
      const alongZ = uz * (fraction - 0.5) * length;
      for (const side of [-1, 1]) {
        addBox(
          THREE,
          connector,
          new THREE.BoxGeometry(0.09, 2.1, 0.09),
          frameMaterial,
          `UploadedAirportJetwayTerminalConnectorMullion_A1_${fraction}_${side}`,
          [
            centerX + alongX + sideX * side * halfWidth,
            centerY + 0.03,
            centerZ + alongZ + sideZ * side * halfWidth,
          ],
          yaw,
          true,
        );
      }
    }

    const terminalX = placement.x + ux * length;
    const terminalZ = placement.z + uz * length;
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(2.96, 0.24, 0.52),
      frameMaterial,
      "UploadedAirportJetwayTerminalPortalHeader_A1",
      [terminalX, centerY + 1.12, terminalZ],
      yaw,
      true,
    );
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(2.9, 0.16, 0.62),
      frameMaterial,
      "UploadedAirportJetwayTerminalPortalThreshold_A1",
      [terminalX, centerY - 1.14, terminalZ],
      yaw,
      true,
    );
    for (const side of [-1, 1]) {
      addBox(
        THREE,
        connector,
        new THREE.BoxGeometry(0.2, 2.45, 0.56),
        frameMaterial,
        `UploadedAirportJetwayTerminalPortalJamb_A1_${side}`,
        [
          terminalX + sideX * side * 1.38,
          centerY,
          terminalZ + sideZ * side * 1.38,
        ],
        yaw,
        true,
      );
    }
    connector.userData.a1TerminalPortalFrame = "deep-overlap-open-framed-terminal-end-v3";
  }

  fleet.add(connector);
  return connector;
}

export { CONNECTOR_AUTHORITY as UPLOADED_JETWAY_CONNECTOR_AUTHORITY };
