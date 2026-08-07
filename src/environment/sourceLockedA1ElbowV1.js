const SOURCE_LOCKED_A1_ELBOW_AUTHORITY = "source-locked-a1-terminal-side-rotunda-elbow-v1";
const SOURCE_POSE_AUTHORITY = "exact-source-placement-parent-pose-v1";
const CONNECTOR_AUTHORITY = "real-terminal-to-source-rotunda-independent-elbow-v1";
const TERMINAL_HIDDEN_OVERLAP_METERS = 0.75;
const ROTUNDA_SHELL_OVERLAP_METERS = 0.82;
const ROTUNDA_COLLAR_INSET_METERS = 0.16;
const MINIMUM_CORNER_ANGLE_DEGREES = 20;
const MAXIMUM_CORNER_ANGLE_DEGREES = 150;
const SOURCE_WALL_LENGTH_PADDING_METERS = 0.35;

function disposeObject(object) {
  object?.traverse?.((entry) => {
    entry.geometry?.dispose?.();
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) material?.dispose?.();
  });
}

function removeGeneratedA1TerminalGeometry(fleet) {
  const removals = [];
  fleet.traverse((entry) => {
    if (entry === fleet) return;
    const name = String(entry.name || "");
    if (
      name === "UploadedAirportJetwayTerminalConnector_A1"
      || name.startsWith("UploadedAirportJetwayA1Terminal")
      || name.startsWith("UploadedAirportJetwayA1ShortTerminalVestibule")
      || name.startsWith("UploadedAirportJetwayA1RotundaVestibule")
    ) removals.push(entry);
  });
  const roots = removals.filter((entry) => !removals.includes(entry.parent));
  for (const entry of roots) {
    entry.removeFromParent();
    disposeObject(entry);
  }
  return roots.length;
}

function objectCenterInFleet(THREE, fleet, object) {
  if (!object) throw new Error("Source-locked A1 endpoint object is missing");
  fleet.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) throw new Error(`Source-locked A1 endpoint ${object.name || "unnamed"} has empty bounds`);
  const center = bounds.getCenter(new THREE.Vector3());
  return fleet.worldToLocal(center);
}

function collectObjectVerticesInFleet(THREE, fleet, object) {
  const vertices = [];
  const point = new THREE.Vector3();
  fleet.updateWorldMatrix(true, true);
  object.updateWorldMatrix(true, true);
  object.traverse((entry) => {
    if (!entry?.isMesh || entry.visible === false) return;
    const position = entry.geometry?.getAttribute?.("position");
    if (!position) return;
    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index).applyMatrix4(entry.matrixWorld);
      fleet.worldToLocal(point);
      vertices.push(point.clone());
    }
  });
  if (vertices.length < 100) {
    throw new Error(`Source-locked A1 ${object.name || "object"} exposes too few exact vertices: ${vertices.length}`);
  }
  return vertices;
}

function projectedRadius(vertices, center, direction) {
  let radius = Number.NEGATIVE_INFINITY;
  for (const vertex of vertices) {
    radius = Math.max(radius, vertex.clone().sub(center).dot(direction));
  }
  if (!(radius > 0.6 && radius < 4)) {
    throw new Error(`Source-locked A1 projected Rotunda radius is invalid: ${radius}`);
  }
  return radius;
}

function endpointBandCenter(THREE, vertices, origin, direction, bandMeters = 0.14) {
  let maximumProjection = Number.NEGATIVE_INFINITY;
  for (const vertex of vertices) {
    maximumProjection = Math.max(maximumProjection, vertex.clone().sub(origin).dot(direction));
  }
  const selected = vertices.filter((vertex) => (
    maximumProjection - vertex.clone().sub(origin).dot(direction) <= bandMeters
  ));
  if (selected.length < 3) throw new Error("Source-locked A1 Cab endpoint band is empty");
  const center = new THREE.Vector3();
  for (const vertex of selected) center.add(vertex);
  return center.multiplyScalar(1 / selected.length);
}

function createMaterials(THREE) {
  return {
    shell: new THREE.MeshStandardMaterial({
      name: "A1 source-locked terminal-side corrugated shell",
      color: 0xe1e2df,
      roughness: 0.78,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    rib: new THREE.MeshStandardMaterial({
      name: "A1 source-locked terminal-side ribs",
      color: 0xb9bdba,
      roughness: 0.84,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    bellows: new THREE.MeshStandardMaterial({
      name: "A1 source-locked Rotunda collar bellows",
      color: 0x303336,
      roughness: 0.95,
      metalness: 0.01,
      side: THREE.DoubleSide,
    }),
  };
}

function addBox(THREE, parent, material, name, dimensions, position, yaw, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.rotation.y = yaw;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addContinuousShell(THREE, parent, materials, start, direction, length, centerY, width, height) {
  const yaw = Math.atan2(direction.x, direction.z);
  const side = new THREE.Vector3(direction.z, 0, -direction.x).normalize();
  const center = start.clone().addScaledVector(direction, length * 0.5);
  center.y = centerY;
  const halfWidth = width * 0.5;
  addBox(THREE, parent, materials.shell, "UploadedAirportJetwayA1TerminalElbowRoof", [width, 0.16, length], center.clone().add(new THREE.Vector3(0, height * 0.5, 0)), yaw);
  addBox(THREE, parent, materials.shell, "UploadedAirportJetwayA1TerminalElbowFloor", [width, 0.14, length], center.clone().add(new THREE.Vector3(0, -height * 0.5, 0)), yaw);
  for (const sign of [-1, 1]) {
    addBox(
      THREE,
      parent,
      materials.shell,
      `UploadedAirportJetwayA1TerminalElbowWall_${sign}`,
      [0.13, height, length],
      center.clone().addScaledVector(side, sign * halfWidth),
      yaw,
    );
  }
  let ribCount = 0;
  for (let distance = 0.2; distance < length - 0.15; distance += 0.30) {
    const ribCenter = start.clone().addScaledVector(direction, distance);
    ribCenter.y = centerY;
    for (const sign of [-1, 1]) {
      addBox(
        THREE,
        parent,
        materials.rib,
        `UploadedAirportJetwayA1TerminalElbowRib_${ribCount}_${sign}`,
        [0.055, height * 0.94, 0.065],
        ribCenter.clone().addScaledVector(side, sign * (halfWidth + 0.035)),
        yaw,
        false,
      );
    }
    ribCount += 1;
  }
  return { yaw, side, ribCount };
}

function addCompactRotundaBellows(THREE, parent, materials, center, direction, width, height) {
  const yaw = Math.atan2(direction.x, direction.z);
  const side = new THREE.Vector3(direction.z, 0, -direction.x).normalize();
  const halfWidth = width * 0.5;
  const depth = 0.24;
  addBox(THREE, parent, materials.bellows, "UploadedAirportJetwayA1TerminalElbowBellowsHeader", [width + 0.08, 0.22, depth], center.clone().add(new THREE.Vector3(0, height * 0.5, 0)), yaw);
  addBox(THREE, parent, materials.bellows, "UploadedAirportJetwayA1TerminalElbowBellowsThreshold", [width + 0.08, 0.18, depth], center.clone().add(new THREE.Vector3(0, -height * 0.5, 0)), yaw);
  for (const sign of [-1, 1]) {
    addBox(
      THREE,
      parent,
      materials.bellows,
      `UploadedAirportJetwayA1TerminalElbowBellowsJamb_${sign}`,
      [0.16, height, depth],
      center.clone().addScaledVector(side, sign * (halfWidth + 0.015)),
      yaw,
    );
  }
}

function vectorToWorldDirection(THREE, fleet, localDirection) {
  const origin = fleet.localToWorld(new THREE.Vector3(0, 0, 0));
  const tip = fleet.localToWorld(localDirection.clone());
  return tip.sub(origin).normalize();
}

export function enforceSourceLockedA1Elbow(THREE, group, fleet, placements) {
  if (!group?.isGroup || !fleet?.isGroup || !Array.isArray(placements)) {
    throw new Error("Source-locked A1 elbow requires Terminal 4 group, exact fleet and placements");
  }
  const placement = placements.find((entry) => entry.gate === "A1");
  const anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
  const model = anchor?.getObjectByName("UploadedAirportJetwayModel_A1");
  const rotunda = model?.getObjectByName("Rotunda") || model?.getObjectByName("Rotunda_Jetway_0");
  const tunnelA = model?.getObjectByName("Tunnel_A") || model?.getObjectByName("Tunnel_A_Jetway_0");
  const cab = model?.getObjectByName("Cab") || model?.getObjectByName("Cab_Jetway_0");
  if (!placement || !anchor || !model || !rotunda || !tunnelA || !cab) {
    throw new Error("Source-locked A1 elbow could not resolve exact A1 placement/Rotunda/Tunnel A/Cab");
  }

  const expectedPosition = new THREE.Vector3(Number(placement.x), anchor.position.y, Number(placement.z));
  const expectedYaw = Number(placement.yaw);
  if (![expectedPosition.x, expectedPosition.z, expectedYaw].every(Number.isFinite)) {
    throw new Error("Source-locked A1 placement contains a non-finite parent pose");
  }

  // This is the key correction: the source BGL placement owns the Rotunda.
  // Later photo/rigid migrations are allowed to measure the model and ground
  // its shared fleet, but they may not move or rotate A1 away from the source
  // gate record. The Rotunda itself supplies the real elbow between the fixed
  // terminal leg and the movable aircraft-side tunnel.
  anchor.position.x = expectedPosition.x;
  anchor.position.z = expectedPosition.z;
  anchor.rotation.y = expectedYaw;
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  const sourcePoseError = Math.max(
    Math.hypot(anchor.position.x - expectedPosition.x, anchor.position.z - expectedPosition.z),
    Math.abs(THREE.MathUtils.euclideanModulo(anchor.rotation.y - expectedYaw + Math.PI, Math.PI * 2) - Math.PI),
  );
  if (sourcePoseError > 1e-8) throw new Error(`A1 source parent pose restore failed: ${sourcePoseError}`);

  const rotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  const tunnelACenter = objectCenterInFleet(THREE, fleet, tunnelA);
  const bridgeDirection = tunnelACenter.clone().sub(rotundaCenter);
  bridgeDirection.y = 0;
  if (bridgeDirection.lengthSq() < 0.25) throw new Error("Source-locked A1 bridge axis is degenerate");
  bridgeDirection.normalize();

  const terminalDirection = new THREE.Vector3(
    Number(placement.connectorTowardX),
    0,
    Number(placement.connectorTowardZ),
  );
  if (terminalDirection.lengthSq() < 0.5) throw new Error("Source-locked A1 terminal direction is missing");
  terminalDirection.normalize();
  const sourceWallDistance = Number(placement.wallConnectorLength) - SOURCE_WALL_LENGTH_PADDING_METERS;
  if (!(sourceWallDistance > 0.4 && sourceWallDistance < 28)) {
    throw new Error(`Source-locked A1 terminal wall distance is invalid: ${sourceWallDistance}`);
  }
  const sourceWallPoint = new THREE.Vector3(
    Number(placement.x) + terminalDirection.x * sourceWallDistance,
    rotundaCenter.y,
    Number(placement.z) + terminalDirection.z * sourceWallDistance,
  );

  const rotundaToTerminal = sourceWallPoint.clone().sub(rotundaCenter);
  rotundaToTerminal.y = 0;
  const rotundaToTerminalDistance = rotundaToTerminal.length();
  if (!(rotundaToTerminalDistance > 1 && rotundaToTerminalDistance < 30)) {
    throw new Error(`Source-locked A1 Rotunda-to-terminal distance is invalid: ${rotundaToTerminalDistance}`);
  }
  rotundaToTerminal.normalize();
  const terminalToRotunda = rotundaToTerminal.clone().multiplyScalar(-1);

  const rotundaVertices = collectObjectVerticesInFleet(THREE, fleet, rotunda);
  const terminalRadius = projectedRadius(rotundaVertices, rotundaCenter, rotundaToTerminal);
  const collarRadius = Math.max(0.55, terminalRadius - ROTUNDA_COLLAR_INSET_METERS);
  const collarPoint = rotundaCenter.clone().addScaledVector(rotundaToTerminal, collarRadius);
  collarPoint.y = rotundaCenter.y;

  const connectorVector = collarPoint.clone().sub(sourceWallPoint);
  connectorVector.y = 0;
  const visibleLength = connectorVector.length();
  if (!(visibleLength > 0.25 && visibleLength < 28)) {
    throw new Error(`Source-locked A1 terminal-side connector length is invalid: ${visibleLength}`);
  }
  connectorVector.normalize();

  const cornerDot = THREE.MathUtils.clamp(connectorVector.dot(bridgeDirection), -1, 1);
  const cornerAngleDegrees = THREE.MathUtils.radToDeg(Math.acos(cornerDot));
  if (!(cornerAngleDegrees >= MINIMUM_CORNER_ANGLE_DEGREES && cornerAngleDegrees <= MAXIMUM_CORNER_ANGLE_DEGREES)) {
    throw new Error(`A1 source Rotunda did not produce the required visible elbow: ${cornerAngleDegrees.toFixed(3)} degrees`);
  }

  const removedGeneratedTerminalObjects = removeGeneratedA1TerminalGeometry(fleet);
  const connector = new THREE.Group();
  connector.name = "UploadedAirportJetwayTerminalConnector_A1";
  const materials = createMaterials(THREE);
  const width = 3.08;
  const height = 2.68;
  const shellStart = sourceWallPoint.clone().addScaledVector(connectorVector, -TERMINAL_HIDDEN_OVERLAP_METERS);
  const shellEnd = collarPoint.clone().addScaledVector(connectorVector, ROTUNDA_SHELL_OVERLAP_METERS);
  const shellLength = shellStart.distanceTo(shellEnd);
  const frame = addContinuousShell(
    THREE,
    connector,
    materials,
    shellStart,
    connectorVector,
    shellLength,
    rotundaCenter.y,
    width,
    height,
  );
  addCompactRotundaBellows(
    THREE,
    connector,
    materials,
    collarPoint.clone().addScaledVector(connectorVector, 0.05),
    connectorVector,
    width,
    height,
  );
  connector.userData.authority = CONNECTOR_AUTHORITY;
  connector.userData.sourceLockedRotunda = true;
  connector.userData.terminalSideIndependentFromTunnelAxis = true;
  connector.userData.terminalCornerAngleDegrees = cornerAngleDegrees;
  connector.userData.visibleLengthMeters = visibleLength;
  connector.userData.hiddenTerminalOverlapMeters = TERMINAL_HIDDEN_OVERLAP_METERS;
  connector.userData.rotundaOverlapMeters = ROTUNDA_SHELL_OVERLAP_METERS;
  connector.userData.corrugationRibCount = frame.ribCount;
  connector.userData.apronFacingOpenAreaMeters = 0;
  connector.userData.passengerPassageCrossSectionBlocked = false;
  fleet.add(connector);

  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  const cabVertices = collectObjectVerticesInFleet(THREE, fleet, cab);
  const cabContactLocal = endpointBandCenter(THREE, cabVertices, rotundaCenter, bridgeDirection);
  const rotundaWorld = fleet.localToWorld(rotundaCenter.clone());
  const wallWorld = fleet.localToWorld(sourceWallPoint.clone());
  const cabContactWorld = fleet.localToWorld(cabContactLocal.clone());
  const cabDirectionWorld = vectorToWorldDirection(THREE, fleet, bridgeDirection);

  const report = Object.freeze({
    authority: SOURCE_LOCKED_A1_ELBOW_AUTHORITY,
    sourcePoseAuthority: SOURCE_POSE_AUTHORITY,
    connectorAuthority: CONNECTOR_AUTHORITY,
    sourcePoseError,
    cornerAngleDegrees,
    visibleLengthMeters: visibleLength,
    sourceWallDistanceMeters: sourceWallDistance,
    terminalDirection: [terminalDirection.x, terminalDirection.z],
    bridgeDirection: [bridgeDirection.x, bridgeDirection.z],
    removedGeneratedTerminalObjects,
    connectorRibCount: frame.ribCount,
    rotundaWorld: rotundaWorld.toArray(),
    wallWorld: wallWorld.toArray(),
    cabContactWorld: cabContactWorld.toArray(),
    cabDirectionWorld: cabDirectionWorld.toArray(),
  });

  group.userData.uploadedJetwayA1SourceLockedElbowAuthority = report.authority;
  group.userData.uploadedJetwayA1SourcePoseAuthority = report.sourcePoseAuthority;
  group.userData.uploadedJetwayA1SourcePoseErrorMeters = report.sourcePoseError;
  group.userData.uploadedJetwayA1TerminalCornerAngleDegrees = report.cornerAngleDegrees;
  group.userData.uploadedJetwayA1TerminalWallDistanceMeters = report.sourceWallDistanceMeters;
  group.userData.uploadedJetwayA1TerminalConnectionDirection = report.terminalDirection;
  group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters = report.visibleLengthMeters;
  group.userData.uploadedJetwayA1ConnectorRibCount = report.connectorRibCount;
  group.userData.uploadedJetwayA1TerminalRelocationX = 0;
  group.userData.uploadedJetwayA1TerminalRelocationZ = 0;
  group.userData.uploadedJetwayA1RelocationX = 0;
  group.userData.uploadedJetwayA1RelocationZ = 0;
  group.userData.uploadedJetwayA1RelocationDistanceMeters = 0;
  group.userData.uploadedJetwayA1CabContactWorldX = cabContactWorld.x;
  group.userData.uploadedJetwayA1CabContactWorldY = cabContactWorld.y;
  group.userData.uploadedJetwayA1CabContactWorldZ = cabContactWorld.z;
  group.userData.uploadedJetwayA1CabDirectionWorldX = cabDirectionWorld.x;
  group.userData.uploadedJetwayA1CabDirectionWorldZ = cabDirectionWorld.z;
  group.userData.uploadedJetwayA1FinalRotundaWorldX = rotundaWorld.x;
  group.userData.uploadedJetwayA1FinalRotundaWorldY = rotundaWorld.y;
  group.userData.uploadedJetwayA1FinalRotundaWorldZ = rotundaWorld.z;
  group.userData.uploadedJetwayA1FinalMeasuredWallWorldX = wallWorld.x;
  group.userData.uploadedJetwayA1FinalMeasuredWallWorldY = wallWorld.y;
  group.userData.uploadedJetwayA1FinalMeasuredWallWorldZ = wallWorld.z;
  group.userData.uploadedJetwayA1FinalRotundaToCabWorldMeters = rotundaWorld.distanceTo(cabContactWorld);
  group.userData.uploadedJetwayA1FinalRotundaToWallWorldMeters = rotundaWorld.distanceTo(wallWorld);
  group.userData.uploadedJetwayA1FinalEndpointEvidenceAuthority = "source-locked-exact-rotunda-wall-cab-v1";
  group.userData.uploadedJetwayA1SourceLockedRotunda = true;
  group.userData.uploadedJetwayA1TerminalSideIndependentFromTunnelAxis = true;
  group.userData.uploadedJetwayA1PassengerPassageCrossSectionBlocked = false;
  group.userData.uploadedJetwayA1ApronFacingOpenAreaMeters = 0;
  anchor.userData.sourcePoseAuthority = SOURCE_POSE_AUTHORITY;
  anchor.userData.sourcePoseError = sourcePoseError;
  anchor.userData.sourceLockedRotunda = true;
  anchor.userData.terminalCornerAngleDegrees = cornerAngleDegrees;

  return report;
}

export {
  SOURCE_LOCKED_A1_ELBOW_AUTHORITY,
  SOURCE_POSE_AUTHORITY as SOURCE_LOCKED_A1_POSE_AUTHORITY,
  CONNECTOR_AUTHORITY as SOURCE_LOCKED_A1_CONNECTOR_AUTHORITY,
};
