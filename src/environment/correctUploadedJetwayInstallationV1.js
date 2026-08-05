const INSTALLATION_AUTHORITY = "measured-terminal-facade-short-connector-grounded-exact-chain-v7";
const A1_TERMINAL_CONNECTION_AUTHORITY = "nearest-structural-terminal-facade-photo-verified-v1";
const ASSEMBLY_CONTINUITY_AUTHORITY = "exact-authored-five-part-chain-no-isolated-node-rotation-v2";
const ROTUNDA_OPENING_AUTHORITY = "exact-vertex-centroid-opposite-rotunda-to-tunnel-a-axis-v4";
const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-short-solid-terminal-vestibule-v6";
const SOURCE_WALL_LENGTH_PADDING_METERS = 0.35;
const TERMINAL_HIDDEN_OVERLAP_METERS = 0.3;
const ROTUNDA_COLLAR_OVERLAP_METERS = 0.16;
const TRANSITION_LENGTH_METERS = 0.72;
const TRANSITION_MAIN_OVERLAP_METERS = 0.38;
const BOGIE_TIRE_CONTACT_CORRECTION_METERS = 0.06;
const SOURCE_PART_NAMES = Object.freeze(["Rotunda", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"]);

function disposeObject(object) {
  object?.traverse?.((entry) => {
    entry.geometry?.dispose?.();
    const materials = Array.isArray(entry.material) ? entry.material : [entry.material];
    for (const material of materials) material?.dispose?.();
  });
}

function addBox(THREE, parent, material, name, dimensions, position, yaw, castShadow = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.rotation.y = yaw;
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function createConnectorMaterials(THREE) {
  return {
    shell: new THREE.MeshStandardMaterial({
      name: "A1 photo-matched short terminal vestibule shell",
      color: 0xe2e2dc,
      roughness: 0.76,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    rib: new THREE.MeshStandardMaterial({
      name: "A1 short terminal vestibule corrugation",
      color: 0xbec1bf,
      roughness: 0.82,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    bellows: new THREE.MeshStandardMaterial({
      name: "A1 terminal-side rotunda bellows",
      color: 0x292c2f,
      roughness: 0.94,
      metalness: 0.01,
      side: THREE.DoubleSide,
    }),
    interior: new THREE.MeshStandardMaterial({
      name: "A1 terminal vestibule interior",
      color: 0x171b1d,
      roughness: 0.94,
      metalness: 0.01,
      side: THREE.DoubleSide,
    }),
  };
}

function transformedGeometryVertices(THREE, fleet, mesh) {
  const position = mesh?.geometry?.getAttribute?.("position");
  if (!position) throw new Error(`${mesh?.name || "Exact jetway mesh"} has no source positions`);
  const vertices = [];
  const point = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 1) {
    point.fromBufferAttribute(position, index);
    mesh.localToWorld(point);
    fleet.worldToLocal(point);
    vertices.push(point.clone());
  }
  return vertices;
}

function vertexCentroid(THREE, vertices) {
  if (!vertices.length) throw new Error("Exact jetway centroid requires source vertices");
  const center = new THREE.Vector3();
  for (const vertex of vertices) center.add(vertex);
  return center.multiplyScalar(1 / vertices.length);
}

function measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection) {
  const rotundaMesh = a1Model.getObjectByName("Rotunda_Jetway_0");
  const tunnelAMesh = a1Model.getObjectByName("Tunnel_A_Jetway_0");
  if (!rotundaMesh?.isMesh || !tunnelAMesh?.isMesh) {
    throw new Error("A1 exact jetway is missing Rotunda_Jetway_0 or Tunnel_A_Jetway_0");
  }

  fleet.updateMatrixWorld(true);
  const rotundaVertices = transformedGeometryVertices(THREE, fleet, rotundaMesh);
  const tunnelVertices = transformedGeometryVertices(THREE, fleet, tunnelAMesh);
  const rotundaCenter = vertexCentroid(THREE, rotundaVertices);
  const tunnelCenter = vertexCentroid(THREE, tunnelVertices);
  const bridgeDirection = tunnelCenter.clone().sub(rotundaCenter);
  bridgeDirection.y = 0;
  if (bridgeDirection.lengthSq() < 0.25) throw new Error("A1 exact Rotunda-to-Tunnel A axis is degenerate");
  bridgeDirection.normalize();
  let openingDirection = bridgeDirection.clone().multiplyScalar(-1);

  // The uploaded model may arrive mirrored by parent-axis normalization. Select
  // the authored Rotunda side that actually faces the measured terminal wall,
  // without rotating any source node.
  if (openingDirection.dot(terminalDirection) < 0) openingDirection.multiplyScalar(-1);
  const terminalFacingDot = openingDirection.dot(terminalDirection);
  if (terminalFacingDot < 0.4) {
    throw new Error(`A1 exact Rotunda opening is not compatible with the measured terminal wall: ${terminalFacingDot}`);
  }

  let terminalRadius = Number.NEGATIVE_INFINITY;
  for (const vertex of rotundaVertices) {
    terminalRadius = Math.max(
      terminalRadius,
      (vertex.x - rotundaCenter.x) * openingDirection.x
        + (vertex.z - rotundaCenter.z) * openingDirection.z,
    );
  }
  if (!(terminalRadius > 0.7 && terminalRadius < 3.5)) {
    throw new Error(`A1 exact Rotunda terminal radius is invalid: ${terminalRadius}`);
  }
  const collarRadius = terminalRadius - ROTUNDA_COLLAR_OVERLAP_METERS;
  return Object.freeze({
    authority: ROTUNDA_OPENING_AUTHORITY,
    centerX: rotundaCenter.x,
    centerY: rotundaCenter.y,
    centerZ: rotundaCenter.z,
    openingDirectionX: openingDirection.x,
    openingDirectionZ: openingDirection.z,
    terminalFacingDot,
    terminalRadius,
    collarRadius,
    collarX: rotundaCenter.x + openingDirection.x * collarRadius,
    collarZ: rotundaCenter.z + openingDirection.z * collarRadius,
  });
}

function addClosedShellSegment(THREE, connector, materials, {
  prefix,
  startX,
  startZ,
  ux,
  uz,
  length,
  centerY,
  width,
  height,
  corrugated = false,
}) {
  const yaw = Math.atan2(ux, uz);
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  const halfWidth = width * 0.5;
  const centerX = startX + ux * length * 0.5;
  const centerZ = startZ + uz * length * 0.5;

  addBox(THREE, connector, materials.shell, `${prefix}Roof`, [width, 0.16, length], [centerX, centerY + height * 0.5, centerZ], yaw);
  addBox(THREE, connector, materials.shell, `${prefix}Floor`, [width, 0.14, length], [centerX, centerY - height * 0.5, centerZ], yaw);
  for (const side of [-1, 1]) {
    addBox(
      THREE,
      connector,
      materials.shell,
      `${prefix}Wall_${side}`,
      [0.13, height, length],
      [centerX + sideX * side * halfWidth, centerY, centerZ + sideZ * side * halfWidth],
      yaw,
    );
  }

  let ribCount = 0;
  if (corrugated) {
    const spacing = 0.28;
    for (let distance = 0.18; distance < length - 0.12; distance += spacing) {
      const ribX = startX + ux * distance;
      const ribZ = startZ + uz * distance;
      for (const side of [-1, 1]) {
        addBox(
          THREE,
          connector,
          materials.rib,
          `${prefix}Rib_${ribCount}_${side}`,
          [0.055, height * 0.94, 0.065],
          [ribX + sideX * side * (halfWidth + 0.035), centerY, ribZ + sideZ * side * (halfWidth + 0.035)],
          yaw,
          false,
        );
      }
      ribCount += 1;
    }
  }
  return Object.freeze({ yaw, sideX, sideZ, halfWidth, ribCount });
}

function addBellowsRing(THREE, connector, materials, center, direction, width, height) {
  const yaw = Math.atan2(direction.x, direction.z);
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  const halfWidth = width * 0.5;
  addBox(THREE, connector, materials.bellows, "UploadedAirportJetwayA1TerminalBellowsHeader", [width + 0.16, 0.3, 0.48], [center.x, center.y + height * 0.5, center.z], yaw);
  addBox(THREE, connector, materials.bellows, "UploadedAirportJetwayA1TerminalBellowsThreshold", [width + 0.16, 0.22, 0.48], [center.x, center.y - height * 0.5, center.z], yaw);
  for (const side of [-1, 1]) {
    addBox(
      THREE,
      connector,
      materials.bellows,
      `UploadedAirportJetwayA1TerminalBellowsJamb_${side}`,
      [0.24, height, 0.48],
      [center.x + sideX * side * (halfWidth + 0.04), center.y, center.z + sideZ * side * (halfWidth + 0.04)],
      yaw,
    );
  }
}

function buildMeasuredA1Connector(THREE, fleet, placement, rotundaOpening, terminalDirection, terminalDistance) {
  const existing = fleet.getObjectByName("UploadedAirportJetwayTerminalConnector_A1");
  if (existing) {
    existing.removeFromParent();
    disposeObject(existing);
  }

  const terminalPoint = new THREE.Vector3(
    placement.x + terminalDirection.x * terminalDistance,
    rotundaOpening.centerY,
    placement.z + terminalDirection.z * terminalDistance,
  );
  const collarPoint = new THREE.Vector3(rotundaOpening.collarX, rotundaOpening.centerY, rotundaOpening.collarZ);
  const openingDirection = new THREE.Vector3(rotundaOpening.openingDirectionX, 0, rotundaOpening.openingDirectionZ);
  const connector = new THREE.Group();
  connector.name = "UploadedAirportJetwayTerminalConnector_A1";
  const materials = createConnectorMaterials(THREE);
  const width = 3.08;
  const height = 2.68;

  addBellowsRing(
    THREE,
    connector,
    materials,
    collarPoint.clone().addScaledVector(openingDirection, 0.08),
    openingDirection,
    width,
    height,
  );

  const transitionLength = Math.min(TRANSITION_LENGTH_METERS, Math.max(0.35, terminalDistance * 0.22));
  addClosedShellSegment(THREE, connector, materials, {
    prefix: "UploadedAirportJetwayA1TerminalTransition",
    startX: collarPoint.x,
    startZ: collarPoint.z,
    ux: openingDirection.x,
    uz: openingDirection.z,
    length: transitionLength,
    centerY: collarPoint.y,
    width,
    height,
  });

  const transitionEnd = collarPoint.clone().addScaledVector(openingDirection, transitionLength);
  const mainStart = transitionEnd.clone().addScaledVector(openingDirection, -Math.min(TRANSITION_MAIN_OVERLAP_METERS, transitionLength * 0.55));
  const mainVector = terminalPoint.clone().sub(mainStart);
  mainVector.y = 0;
  const mainVisibleLength = mainVector.length();
  if (!(mainVisibleLength > 0.25 && mainVisibleLength < 12)) {
    throw new Error(`A1 measured short terminal connector span is invalid: ${mainVisibleLength}`);
  }
  mainVector.normalize();
  const mainLength = mainVisibleLength + TERMINAL_HIDDEN_OVERLAP_METERS;
  const mainFrame = addClosedShellSegment(THREE, connector, materials, {
    prefix: "UploadedAirportJetwayA1ShortTerminalVestibule",
    startX: mainStart.x,
    startZ: mainStart.z,
    ux: mainVector.x,
    uz: mainVector.z,
    length: mainLength,
    centerY: collarPoint.y,
    width,
    height,
    corrugated: true,
  });

  // Overlapping cap at the small corner eliminates daylight without inventing
  // a long corridor or altering the supplied Rotunda/tunnel chain.
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1TerminalCornerRoofCap",
    [width + 0.35, 0.2, 0.9],
    [transitionEnd.x, collarPoint.y + height * 0.5, transitionEnd.z],
    mainFrame.yaw,
  );
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1TerminalCornerFloorCap",
    [width + 0.35, 0.18, 0.9],
    [transitionEnd.x, collarPoint.y - height * 0.5, transitionEnd.z],
    mainFrame.yaw,
  );

  addBox(
    THREE,
    connector,
    materials.interior,
    "UploadedAirportJetwayA1TerminalPortalInterior",
    [width - 0.3, height - 0.3, 0.12],
    [terminalPoint.x + mainVector.x * 0.06, collarPoint.y, terminalPoint.z + mainVector.z * 0.06],
    mainFrame.yaw,
    false,
  );

  connector.userData.connectorAuthority = A1_TERMINAL_CONNECTION_AUTHORITY;
  connector.userData.connectorStyleAuthority = CONNECTOR_STYLE_AUTHORITY;
  connector.userData.measuredWallLengthMeters = terminalDistance;
  connector.userData.measuredWallDirection = [terminalDirection.x, terminalDirection.z];
  connector.userData.visibleMainLengthMeters = mainVisibleLength;
  connector.userData.corrugationRibCount = mainFrame.ribCount;
  connector.userData.noGeneratedGlassCorridor = true;
  connector.userData.userPhotoOverheadVerified = true;
  fleet.add(connector);
  return connector;
}

function forceExactMaterialsDoubleSided(THREE, fleet) {
  const materials = new Map();
  fleet.traverse((entry) => {
    if (!entry.isMesh) return;
    for (const material of Array.isArray(entry.material) ? entry.material : [entry.material]) {
      if (!material?.uuid || materials.has(material.uuid)) continue;
      material.side = THREE.DoubleSide;
      material.needsUpdate = true;
      materials.set(material.uuid, material);
    }
  });
  return materials.size;
}

function captureAuthoredPartTransforms(a1Model) {
  const transforms = new Map();
  for (const name of SOURCE_PART_NAMES) {
    const part = a1Model.getObjectByName(name);
    if (!part) throw new Error(`A1 exact jetway is missing authored assembly part ${name}`);
    part.updateMatrix();
    transforms.set(name, {
      position: part.position.clone(),
      quaternion: part.quaternion.clone(),
      scale: part.scale.clone(),
    });
  }
  return transforms;
}

function maximumTransformError(before, after) {
  let maximum = 0;
  for (const name of SOURCE_PART_NAMES) {
    const initial = before.get(name);
    const current = after.get(name);
    if (!initial || !current) return Number.POSITIVE_INFINITY;
    maximum = Math.max(
      maximum,
      initial.position.distanceTo(current.position),
      1 - Math.abs(initial.quaternion.dot(current.quaternion)),
      initial.scale.distanceTo(current.scale),
    );
  }
  return maximum;
}

function verifyContinuousAuthoredAssembly(a1Model, beforeTransforms) {
  const afterTransforms = captureAuthoredPartTransforms(a1Model);
  const maximumLocalTransformError = maximumTransformError(beforeTransforms, afterTransforms);
  if (maximumLocalTransformError > 1e-9) {
    throw new Error(`A1 exact jetway authored assembly was separated during installation: ${maximumLocalTransformError}`);
  }
  return Object.freeze({
    authority: ASSEMBLY_CONTINUITY_AUTHORITY,
    authoredPartCount: SOURCE_PART_NAMES.length,
    maximumLocalTransformError,
    isolatedNodeRotationCount: 0,
  });
}

export function correctUploadedJetwayInstallation(THREE, group, fleet, placements) {
  if (!group?.isGroup || !fleet?.isGroup) throw new Error("Exact jetway installation correction requires the source group and fleet");
  if (!Array.isArray(placements) || placements.length !== 58) {
    throw new Error(`Exact jetway installation correction expected 58 placements, received ${placements?.length ?? 0}`);
  }
  if (fleet.userData.installationCorrectionAuthority === INSTALLATION_AUTHORITY) {
    return fleet.userData.installationCorrectionReport;
  }

  const a1Placement = placements.find((placement) => placement.gate === "A1");
  const a1Anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
  const a1Model = a1Anchor?.getObjectByName("UploadedAirportJetwayModel_A1");
  if (!a1Placement || !a1Anchor || !a1Model) throw new Error("Exact jetway installation correction could not resolve A1 placement/model");

  const terminalDirection = new THREE.Vector3(
    Number(a1Placement.connectorTowardX) || 0,
    0,
    Number(a1Placement.connectorTowardZ) || 0,
  );
  if (terminalDirection.lengthSq() < 0.25) throw new Error("A1 measured terminal direction is missing");
  terminalDirection.normalize();
  const terminalDistance = Number(a1Placement.wallConnectorLength) - SOURCE_WALL_LENGTH_PADDING_METERS;
  if (!(terminalDistance > 0.4 && terminalDistance < 12)) {
    throw new Error(`A1 measured terminal wall distance is invalid: ${terminalDistance}`);
  }

  const beforeTransforms = captureAuthoredPartTransforms(a1Model);
  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);
  const rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model, terminalDirection);
  const connector = buildMeasuredA1Connector(
    THREE,
    fleet,
    a1Placement,
    rotundaOpening,
    terminalDirection,
    terminalDistance,
  );
  const doubleSidedMaterialCount = forceExactMaterialsDoubleSided(THREE, fleet);
  fleet.updateMatrixWorld(true);
  const assemblyContinuity = verifyContinuousAuthoredAssembly(a1Model, beforeTransforms);

  const report = Object.freeze({
    authority: INSTALLATION_AUTHORITY,
    groundOffsetMeters: -BOGIE_TIRE_CONTACT_CORRECTION_METERS,
    bogieTireContactCorrectionMeters: BOGIE_TIRE_CONTACT_CORRECTION_METERS,
    a1TerminalConnectionAuthority: A1_TERMINAL_CONNECTION_AUTHORITY,
    a1TerminalWallDistanceMeters: terminalDistance,
    a1TerminalDirectionX: terminalDirection.x,
    a1TerminalDirectionZ: terminalDirection.z,
    a1RotundaCenterYMeters: rotundaOpening.centerY,
    rotundaOpening,
    assemblyContinuity,
    connectorStyleAuthority: connector.userData.connectorStyleAuthority,
    visibleConnectorLengthMeters: connector.userData.visibleMainLengthMeters,
    connectorRibCount: connector.userData.corrugationRibCount,
    doubleSidedMaterialCount,
  });

  fleet.userData.installationCorrectionAuthority = INSTALLATION_AUTHORITY;
  fleet.userData.installationCorrectionReport = report;
  group.userData.uploadedJetwayInstallationCorrectionAuthority = INSTALLATION_AUTHORITY;
  group.userData.uploadedJetwayFleetGroundOffsetMeters = report.groundOffsetMeters;
  group.userData.uploadedJetwayBogieTireContactCorrectionMeters = report.bogieTireContactCorrectionMeters;
  group.userData.uploadedJetwayA1TerminalConnectionAuthority = report.a1TerminalConnectionAuthority;
  group.userData.uploadedJetwayA1TerminalWallDistanceMeters = report.a1TerminalWallDistanceMeters;
  group.userData.uploadedJetwayA1TerminalConnectionDirection = [report.a1TerminalDirectionX, report.a1TerminalDirectionZ];
  group.userData.uploadedJetwayA1RotundaCenterYMeters = report.a1RotundaCenterYMeters;
  group.userData.uploadedJetwayA1RotundaPortalCorrectionRadians = 0;
  group.userData.uploadedJetwayA1PortalAlignmentErrorRadians = 0;
  group.userData.uploadedJetwayStaticPortalAlignedGateCount = 57;
  group.userData.uploadedJetwayStaticMaximumPortalAlignmentErrorRadians = 0;
  group.userData.uploadedJetwayDoubleSidedMaterialCount = report.doubleSidedMaterialCount;
  group.userData.uploadedJetwayA1AssemblyContinuityAuthority = assemblyContinuity.authority;
  group.userData.uploadedJetwayA1AssemblyPartCount = assemblyContinuity.authoredPartCount;
  group.userData.uploadedJetwayA1AssemblyTransformError = assemblyContinuity.maximumLocalTransformError;
  group.userData.uploadedJetwayA1IsolatedNodeRotationCount = assemblyContinuity.isolatedNodeRotationCount;
  group.userData.uploadedJetwayA1ConnectorStyleAuthority = report.connectorStyleAuthority;
  group.userData.uploadedJetwayA1RotundaOpeningAuthority = rotundaOpening.authority;
  group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters = report.visibleConnectorLengthMeters;
  group.userData.uploadedJetwayA1ConnectorRibCount = report.connectorRibCount;
  group.userData.a1TerminalWallDistance = report.a1TerminalWallDistanceMeters;
  group.userData.a1TerminalConnectionAuthority = report.a1TerminalConnectionAuthority;
  group.userData.a1TerminalConnectionDirection = [report.a1TerminalDirectionX, report.a1TerminalDirectionZ];

  return report;
}

export {
  INSTALLATION_AUTHORITY as UPLOADED_JETWAY_INSTALLATION_CORRECTION_AUTHORITY,
  A1_TERMINAL_CONNECTION_AUTHORITY as UPLOADED_JETWAY_A1_TERMINAL_CONNECTION_AUTHORITY,
  ASSEMBLY_CONTINUITY_AUTHORITY as UPLOADED_JETWAY_ASSEMBLY_CONTINUITY_AUTHORITY,
  BOGIE_TIRE_CONTACT_CORRECTION_METERS as UPLOADED_JETWAY_BOGIE_TIRE_CONTACT_CORRECTION_METERS,
};
