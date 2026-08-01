const CONNECTOR_AUTHORITY = "measured-authored-terminal-wall-to-uploaded-rotunda-v2-framed-glazed";

function addBox(THREE, parent, geometry, material, name, position, yaw, castShadow = true) {
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
  const length = Math.max(1.25, Math.min(18, Number(placement.wallConnectorLength) || 1.25));
  const towardX = Number(placement.connectorTowardX) || 0;
  const towardZ = Number(placement.connectorTowardZ) || 0;
  const magnitude = Math.hypot(towardX, towardZ) || 1;
  const ux = towardX / magnitude;
  const uz = towardZ / magnitude;
  const connector = new THREE.Group();
  connector.name = `UploadedAirportJetwayTerminalConnector_${placement.gate}`;
  connector.userData.connectorAuthority = CONNECTOR_AUTHORITY;
  connector.userData.connectorLengthMeters = length;

  const shellMaterial = new THREE.MeshStandardMaterial({
    name: `Uploaded airport jetway fixed terminal connector ${placement.gate}`,
    color: 0xc9c7c1,
    roughness: 0.72,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const frameMaterial = new THREE.MeshStandardMaterial({
    name: `Uploaded airport jetway fixed connector frame ${placement.gate}`,
    color: 0x5b6062,
    roughness: 0.58,
    metalness: 0.42,
    side: THREE.DoubleSide,
  });
  const glassMaterial = new THREE.MeshStandardMaterial({
    name: `Uploaded airport jetway fixed connector glazing ${placement.gate}`,
    color: 0x263c46,
    roughness: 0.22,
    metalness: 0.08,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const centerX = placement.x + ux * length * 0.5;
  const centerZ = placement.z + uz * length * 0.5;
  const centerY = Number(placement.rotundaY) || 4.1;
  const yaw = Math.atan2(ux, uz);
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  const span = length + 0.5;
  const halfWidth = 1.31;

  addBox(
    THREE,
    connector,
    new THREE.BoxGeometry(2.68, 0.18, span),
    shellMaterial,
    `UploadedAirportJetwayTerminalConnectorRoof_${placement.gate}`,
    [centerX, centerY + 1.19, centerZ],
    yaw,
  );
  addBox(
    THREE,
    connector,
    new THREE.BoxGeometry(2.58, 0.16, span),
    frameMaterial,
    `UploadedAirportJetwayTerminalConnectorFloor_${placement.gate}`,
    [centerX, centerY - 1.17, centerZ],
    yaw,
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
    );
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(0.035, 1.0, Math.max(0.8, length - 0.22)),
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
      );
    }
  }

  fleet.add(connector);
  return connector;
}

export { CONNECTOR_AUTHORITY as UPLOADED_JETWAY_CONNECTOR_AUTHORITY };
