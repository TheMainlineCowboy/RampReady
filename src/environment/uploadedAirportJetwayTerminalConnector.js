const CONNECTOR_AUTHORITY = "measured-authored-terminal-wall-to-uploaded-rotunda-v1";

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

  const shell = new THREE.Mesh(new THREE.BoxGeometry(2.66, 2.52, length + 0.42), shellMaterial);
  shell.name = `UploadedAirportJetwayTerminalConnectorShell_${placement.gate}`;
  shell.position.set(centerX, centerY, centerZ);
  shell.rotation.y = yaw;
  shell.castShadow = true;
  shell.receiveShadow = true;
  connector.add(shell);

  const windowHeight = 0.82;
  for (const side of [-1, 1]) {
    const window = new THREE.Mesh(new THREE.BoxGeometry(0.035, windowHeight, Math.max(0.8, length - 0.6)), glassMaterial);
    window.name = `UploadedAirportJetwayTerminalConnectorWindow_${placement.gate}_${side}`;
    window.position.set(
      centerX + Math.cos(yaw) * side * 1.337,
      centerY + 0.22,
      centerZ - Math.sin(yaw) * side * 1.337,
    );
    window.rotation.y = yaw;
    window.castShadow = false;
    window.receiveShadow = true;
    connector.add(window);
  }

  fleet.add(connector);
  return connector;
}

export { CONNECTOR_AUTHORITY as UPLOADED_JETWAY_CONNECTOR_AUTHORITY };
