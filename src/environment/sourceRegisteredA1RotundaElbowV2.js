const SOURCE_REGISTERED_A1_ELBOW_AUTHORITY = "photo-registered-a1-source-yaw-rotunda-elbow-v2";
const SOURCE_YAW_AUTHORITY = "exact-bgl-aircraft-side-heading-with-photo-registered-rotunda-v2";
const CONNECTOR_AUTHORITY = "real-terminal-to-photo-registered-rotunda-independent-elbow-v2";
const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-compact-solid-terminal-leg-with-rotunda-elbow-v2";
const VISIBLE_TERMINAL_LEG_METERS = 2.4;
const TERMINAL_HIDDEN_OVERLAP_METERS = 0.75;
const ROTUNDA_SHELL_OVERLAP_METERS = 0.82;
const ROTUNDA_COLLAR_INSET_METERS = 0.16;
const MINIMUM_CORNER_ANGLE_DEGREES = 35;
const MAXIMUM_CORNER_ANGLE_DEGREES = 135;
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
  fleet.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) throw new Error(`A1 endpoint ${object?.name || "unnamed"} has empty bounds`);
  return fleet.worldToLocal(bounds.getCenter(new THREE.Vector3()));
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
    throw new Error(`A1 ${object?.name || "object"} exposes too few exact vertices: ${vertices.length}`);
  }
  return vertices;
}

function projectedRadius(vertices, center, direction) {
  let radius = Number.NEGATIVE_INFINITY;
  for (const vertex of vertices) {
    radius = Math.max(radius, vertex.clone().sub(center).dot(direction));
  }
  if (!(radius > 0.6 && radius < 4)) {
    throw new Error(`A1 projected Rotunda radius is invalid: ${radius}`);
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
  if (selected.length < 3) throw new Error("A1 Cab endpoint band is empty");
  const center = new THREE.Vector3();
  for (const vertex of selected) center.add(vertex);
  return center.multiplyScalar(1 / selected.length);
}

function createMaterials(THREE) {
  return {
    shell: new THREE.MeshStandardMaterial({
      name: "A1 photo-registered compact terminal-side shell",
      color: 0xe1e2df,
      roughness: 0.78,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    rib: new THREE.MeshStandardMaterial({
      name: "A1 photo-registered terminal-side ribs",
      color: 0xb9bdba,
      roughness: 0.84,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    bellows: new THREE.MeshStandardMaterial({
      name: "A1 photo-registered Rotunda collar bellows",
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
  return { yaw, ribCount };
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

function wrappedYawError(THREE, actual, expected) {
  return Math.abs(THREE.MathUtils.euclideanModulo(actual - expected + Math.PI, Math.PI * 2) - Math.PI);
}

export function enforceSourceRegisteredA1RotundaElbow(THREE, group, fleet, placements) {
  if (!group?.isGroup || !fleet?.isGroup || !Array.isArray(placements)) {
    throw new Error("A1 Rotunda registration requires Terminal 4 group, exact fleet and placements");
  }
  const placement = placements.find((entry) => entry.gate === "A1");
  const anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
  const model = anchor?.getObjectByName("UploadedAirportJetwayModel_A1");
  const rotunda = model?.getObjectByName("Rotunda") || model?.getObjectByName("Rotunda_Jetway_0");
  const tunnelA = model?.getObjectByName("Tunnel_A") || model?.getObjectByName("Tunnel_A_Jetway_0");
  const cab = model?.getObjectByName("Cab") || model?.getObjectByName("Cab_Jetway_0");
  if (!placement || !anchor || !model || !rotunda || !tunnelA || !cab) {
    throw new Error("A1 Rotunda registration could not resolve placement/anchor/Rotunda/Tunnel A/Cab");
  }

  const sourceX = Number(placement.x);
  const sourceZ = Number(placement.z);
  const sourceYaw = Number(placement.yaw);
  const wallDistanceFromSourceRecord = Number(placement.wallConnectorLength) - SOURCE_WALL_LENGTH_PADDING_METERS;
  const terminalDirection = new THREE.Vector3(
    Number(placement.connectorTowardX),
    0,
    Number(placement.connectorTowardZ),
  );
  if (![sourceX, sourceZ, sourceYaw, wallDistanceFromSourceRecord].every(Number.isFinite) || terminalDirection.lengthSq() < 0.5) {
    throw new Error("A1 source record is missing finite gate/yaw/real-wall registration evidence");
  }
  if (!(wallDistanceFromSourceRecord > 3.4 && wallDistanceFromSourceRecord < 28)) {
    throw new Error(`A1 raw source-to-wall distance is invalid: ${wallDistanceFromSourceRecord}`);
  }
  terminalDirection.normalize();

  // The BGL AIR_Jetway01 record is the stock model origin, not the Rotunda
  // pivot of the user's replacement GLB. Preserve its AIRCRAFT-SIDE heading,
  // but do not force the replacement Rotunda onto that stock origin. The raw
  // record and measured wall ray identify the real terminal portal; the exact
  // supplied Rotunda is then registered a photo-matched 2.4 m collar-to-wall
  // distance out on the apron. This keeps the real building attachment while
  // allowing the authored Rotunda to provide the actual corner toward A1.
  anchor.position.x = sourceX;
  anchor.position.z = sourceZ;
  anchor.rotation.y = sourceYaw;
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  const sourceRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  const sourceRotundaOffset = sourceRotundaCenter.clone().sub(anchor.position);
  sourceRotundaOffset.y = 0;
  const sourceWallPoint = new THREE.Vector3(
    sourceX + terminalDirection.x * wallDistanceFromSourceRecord,
    sourceRotundaCenter.y,
    sourceZ + terminalDirection.z * wallDistanceFromSourceRecord,
  );

  const sourceRotundaVertices = collectObjectVerticesInFleet(THREE, fleet, rotunda);
  const terminalRadius = projectedRadius(sourceRotundaVertices, sourceRotundaCenter, terminalDirection);
  const collarRadius = Math.max(0.55, terminalRadius - ROTUNDA_COLLAR_INSET_METERS);
  const desiredCenterToWallMeters = collarRadius + VISIBLE_TERMINAL_LEG_METERS;
  const desiredRotundaCenter = sourceWallPoint.clone().addScaledVector(terminalDirection, -desiredCenterToWallMeters);
  desiredRotundaCenter.y = sourceRotundaCenter.y;
  const desiredAnchorX = desiredRotundaCenter.x - sourceRotundaOffset.x;
  const desiredAnchorZ = desiredRotundaCenter.z - sourceRotundaOffset.z;

  anchor.position.x = desiredAnchorX;
  anchor.position.z = desiredAnchorZ;
  anchor.rotation.y = sourceYaw;
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  const yawErrorRadians = wrappedYawError(THREE, anchor.rotation.y, sourceYaw);
  if (yawErrorRadians > 1e-8) throw new Error(`A1 source aircraft-side yaw was not preserved: ${yawErrorRadians}`);

  const rotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  const rotundaRegistrationErrorMeters = Math.hypot(
    rotundaCenter.x - desiredRotundaCenter.x,
    rotundaCenter.z - desiredRotundaCenter.z,
  );
  if (rotundaRegistrationErrorMeters > 1e-6) {
    throw new Error(`A1 photo Rotunda registration error is ${rotundaRegistrationErrorMeters}`);
  }

  const tunnelACenter = objectCenterInFleet(THREE, fleet, tunnelA);
  const bridgeDirection = tunnelACenter.clone().sub(rotundaCenter);
  bridgeDirection.y = 0;
  if (bridgeDirection.lengthSq() < 0.25) throw new Error("A1 exact bridge axis is degenerate");
  bridgeDirection.normalize();

  const rotundaVertices = collectObjectVerticesInFleet(THREE, fleet, rotunda);
  const finalTerminalRadius = projectedRadius(rotundaVertices, rotundaCenter, terminalDirection);
  const finalCollarRadius = Math.max(0.55, finalTerminalRadius - ROTUNDA_COLLAR_INSET_METERS);
  const collarPoint = rotundaCenter.clone().addScaledVector(terminalDirection, finalCollarRadius);
  collarPoint.y = rotundaCenter.y;
  const connectorVector = collarPoint.clone().sub(sourceWallPoint);
  connectorVector.y = 0;
  const visibleLength = connectorVector.length();
  if (Math.abs(visibleLength - VISIBLE_TERMINAL_LEG_METERS) > 0.025) {
    throw new Error(`A1 photo terminal leg must be ${VISIBLE_TERMINAL_LEG_METERS} m, measured ${visibleLength}`);
  }
  connectorVector.normalize();

  const cornerDot = THREE.MathUtils.clamp(connectorVector.dot(bridgeDirection), -1, 1);
  const cornerAngleDegrees = THREE.MathUtils.radToDeg(Math.acos(cornerDot));
  if (!(cornerAngleDegrees >= MINIMUM_CORNER_ANGLE_DEGREES && cornerAngleDegrees <= MAXIMUM_CORNER_ANGLE_DEGREES)) {
    throw new Error(`A1 Rotunda did not produce the required visible corner: ${cornerAngleDegrees.toFixed(3)} degrees`);
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
  connector.userData.connectorAuthority = CONNECTOR_AUTHORITY;
  connector.userData.connectorStyleAuthority = CONNECTOR_STYLE_AUTHORITY;
  connector.userData.sourceRegisteredRotunda = true;
  connector.userData.sourceYawPreserved = true;
  connector.userData.terminalSideIndependentFromTunnelAxis = true;
  connector.userData.terminalCornerAngleDegrees = cornerAngleDegrees;
  connector.userData.visibleLengthMeters = visibleLength;
  connector.userData.visibleMainLengthMeters = visibleLength;
  connector.userData.measuredWallLengthMeters = desiredCenterToWallMeters;
  connector.userData.measuredWallDirection = [terminalDirection.x, terminalDirection.z];
  connector.userData.hiddenTerminalOverlapMeters = TERMINAL_HIDDEN_OVERLAP_METERS;
  connector.userData.terminalHiddenOverlapMeters = TERMINAL_HIDDEN_OVERLAP_METERS;
  connector.userData.rotundaOverlapMeters = ROTUNDA_SHELL_OVERLAP_METERS;
  connector.userData.corrugationRibCount = frame.ribCount;
  connector.userData.noGeneratedGlassCorridor = true;
  connector.userData.userPhotoOverheadVerified = true;
  connector.userData.singleStraightSolidVestibule = false;
  connector.userData.apronFacingOpenAreaMeters = 0;
  connector.userData.apronFacingRotundaOpeningClosed = true;
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
  const relocationX = desiredAnchorX - sourceX;
  const relocationZ = desiredAnchorZ - sourceZ;
  const relocationDistanceMeters = Math.hypot(relocationX, relocationZ);

  const report = Object.freeze({
    authority: SOURCE_REGISTERED_A1_ELBOW_AUTHORITY,
    sourceYawAuthority: SOURCE_YAW_AUTHORITY,
    connectorAuthority: CONNECTOR_AUTHORITY,
    connectorStyleAuthority: CONNECTOR_STYLE_AUTHORITY,
    yawErrorRadians,
    rotundaRegistrationErrorMeters,
    cornerAngleDegrees,
    visibleLengthMeters: visibleLength,
    centerToWallMeters: desiredCenterToWallMeters,
    rawSourceToWallMeters: wallDistanceFromSourceRecord,
    terminalDirection: [terminalDirection.x, terminalDirection.z],
    bridgeDirection: [bridgeDirection.x, bridgeDirection.z],
    relocationX,
    relocationZ,
    relocationDistanceMeters,
    removedGeneratedTerminalObjects,
    connectorRibCount: frame.ribCount,
    rotundaWorld: rotundaWorld.toArray(),
    wallWorld: wallWorld.toArray(),
    cabContactWorld: cabContactWorld.toArray(),
    cabDirectionWorld: cabDirectionWorld.toArray(),
  });

  group.userData.uploadedJetwayA1SourceLockedElbowAuthority = report.authority;
  group.userData.uploadedJetwayA1SourcePoseAuthority = report.sourceYawAuthority;
  group.userData.uploadedJetwayA1SourcePoseErrorMeters = report.rotundaRegistrationErrorMeters;
  group.userData.uploadedJetwayA1SourceYawErrorRadians = report.yawErrorRadians;
  group.userData.uploadedJetwayA1TerminalCornerAngleDegrees = report.cornerAngleDegrees;
  group.userData.uploadedJetwayA1TerminalWallDistanceMeters = report.centerToWallMeters;
  group.userData.uploadedJetwayA1TerminalConnectionDirection = report.terminalDirection;
  group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters = report.visibleLengthMeters;
  group.userData.uploadedJetwayA1ConnectorRibCount = report.connectorRibCount;
  group.userData.uploadedJetwayA1TerminalRelocationX = relocationX;
  group.userData.uploadedJetwayA1TerminalRelocationZ = relocationZ;
  group.userData.uploadedJetwayA1RelocationX = relocationX;
  group.userData.uploadedJetwayA1RelocationZ = relocationZ;
  group.userData.uploadedJetwayA1RelocationDistanceMeters = relocationDistanceMeters;
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
  group.userData.uploadedJetwayA1FinalEndpointEvidenceAuthority = "photo-registered-exact-rotunda-wall-cab-v2";
  group.userData.uploadedJetwayA1SourceLockedRotunda = true;
  group.userData.uploadedJetwayA1TerminalSideIndependentFromTunnelAxis = true;
  group.userData.uploadedJetwayA1PassengerPassageCrossSectionBlocked = false;
  group.userData.uploadedJetwayA1ApronFacingOpenAreaMeters = 0;
  group.userData.uploadedJetwayA1RawSourceToWallMeters = wallDistanceFromSourceRecord;
  group.userData.uploadedJetwayA1SourceYawPreserved = true;

  anchor.userData.sourcePoseAuthority = SOURCE_YAW_AUTHORITY;
  anchor.userData.sourcePoseError = rotundaRegistrationErrorMeters;
  anchor.userData.sourceYawErrorRadians = yawErrorRadians;
  anchor.userData.sourceLockedRotunda = true;
  anchor.userData.sourceYawPreserved = true;
  anchor.userData.terminalCornerAngleDegrees = cornerAngleDegrees;
  anchor.userData.photoRegisteredRelocationDistanceMeters = relocationDistanceMeters;

  return report;
}

export {
  SOURCE_REGISTERED_A1_ELBOW_AUTHORITY,
  SOURCE_YAW_AUTHORITY as SOURCE_REGISTERED_A1_YAW_AUTHORITY,
  CONNECTOR_AUTHORITY as SOURCE_REGISTERED_A1_CONNECTOR_AUTHORITY,
};
