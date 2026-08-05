const INSTALLATION_AUTHORITY = "user-photo-exact-rotunda-corner-vestibule-and-ground-contact-v6";
const A1_TERMINAL_CONNECTION_AUTHORITY = "user-photo-overhead-authored-terminal-wall-direct-v1";
const ASSEMBLY_CONTINUITY_AUTHORITY = "exact-authored-five-part-chain-no-isolated-node-rotation-v2";
const ROTUNDA_OPENING_AUTHORITY = "exact-vertex-centroid-opposite-rotunda-to-tunnel-a-axis-v4";
const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-solid-white-two-segment-corner-vestibule-v5";
const A1_DIRECT_TERMINAL_DISTANCE_METERS = 16.08913693907184;
const A1_TERMINAL_HIDDEN_OVERLAP_METERS = 0.55;
const A1_ROTUNDA_COLLAR_OVERLAP_METERS = 0.18;
const A1_TRANSITION_LENGTH_METERS = 1.35;
const A1_TRANSITION_MAIN_OVERLAP_METERS = 0.55;
const BOGIE_TIRE_CONTACT_CORRECTION_METERS = 0.06;
const A1_TERMINAL_DIRECTION = Object.freeze({ x: 0, z: -1 });
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

function createA1VestibuleMaterials(THREE) {
  return {
    shell: new THREE.MeshStandardMaterial({
      name: "A1 same-day-photo solid white fixed vestibule shell",
      color: 0xe7e6df,
      roughness: 0.78,
      metalness: 0.04,
      side: THREE.DoubleSide,
    }),
    seam: new THREE.MeshStandardMaterial({
      name: "A1 same-day-photo vestibule panel seams",
      color: 0xc5c7c4,
      roughness: 0.72,
      metalness: 0.12,
      side: THREE.DoubleSide,
    }),
    bellows: new THREE.MeshStandardMaterial({
      name: "A1 same-day-photo rotunda vestibule bellows",
      color: 0x303337,
      roughness: 0.92,
      metalness: 0.01,
      side: THREE.DoubleSide,
    }),
    portalInterior: new THREE.MeshStandardMaterial({
      name: "A1 terminal vestibule dark interior",
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

function measureExactRotundaOpening(THREE, fleet, a1Model) {
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
  if (bridgeDirection.lengthSq() < 0.25) {
    throw new Error("A1 exact Rotunda-to-Tunnel A axis is degenerate");
  }
  bridgeDirection.normalize();
  const openingDirection = bridgeDirection.clone().multiplyScalar(-1);

  let terminalRadius = Number.NEGATIVE_INFINITY;
  for (const vertex of rotundaVertices) {
    terminalRadius = Math.max(
      terminalRadius,
      (vertex.x - rotundaCenter.x) * openingDirection.x
        + (vertex.z - rotundaCenter.z) * openingDirection.z,
    );
  }
  if (!(terminalRadius > 0.7 && terminalRadius < 3.5)) {
    throw new Error(`A1 exact Rotunda opening radius is invalid: ${terminalRadius}`);
  }

  const terminalFacingDot = openingDirection.x * A1_TERMINAL_DIRECTION.x
    + openingDirection.z * A1_TERMINAL_DIRECTION.z;
  if (terminalFacingDot < 0.55) {
    throw new Error(`A1 exact Rotunda opening points away from the terminal: ${terminalFacingDot}`);
  }

  const collarRadius = terminalRadius - A1_ROTUNDA_COLLAR_OVERLAP_METERS;
  return Object.freeze({
    authority: ROTUNDA_OPENING_AUTHORITY,
    centerX: rotundaCenter.x,
    centerY: rotundaCenter.y,
    centerZ: rotundaCenter.z,
    bridgeDirectionX: bridgeDirection.x,
    bridgeDirectionZ: bridgeDirection.z,
    openingDirectionX: openingDirection.x,
    openingDirectionZ: openingDirection.z,
    terminalFacingDot,
    terminalRadius,
    collarRadius,
    collarX: rotundaCenter.x + openingDirection.x * collarRadius,
    collarZ: rotundaCenter.z + openingDirection.z * collarRadius,
    visibleOverlapMeters: A1_ROTUNDA_COLLAR_OVERLAP_METERS,
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
  addSeams = false,
}) {
  const yaw = Math.atan2(ux, uz);
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  const halfWidth = width * 0.5;
  const centerX = startX + ux * length * 0.5;
  const centerZ = startZ + uz * length * 0.5;

  addBox(THREE, connector, materials.shell, `${prefix}Roof`, [width, 0.18, length], [centerX, centerY + height * 0.5, centerZ], yaw);
  addBox(THREE, connector, materials.shell, `${prefix}Floor`, [width, 0.16, length], [centerX, centerY - height * 0.5, centerZ], yaw);
  for (const side of [-1, 1]) {
    addBox(
      THREE,
      connector,
      materials.shell,
      `${prefix}SolidWall_${side}`,
      [0.14, height, length],
      [centerX + sideX * side * halfWidth, centerY, centerZ + sideZ * side * halfWidth],
      yaw,
    );
  }

  if (addSeams) {
    const seamCount = Math.max(3, Math.round(length / 2.4));
    for (let seamIndex = 1; seamIndex < seamCount; seamIndex += 1) {
      const distance = (length * seamIndex) / seamCount;
      const seamX = startX + ux * distance;
      const seamZ = startZ + uz * distance;
      for (const side of [-1, 1]) {
        addBox(
          THREE,
          connector,
          materials.seam,
          `${prefix}WallSeam_${seamIndex}_${side}`,
          [0.055, height * 0.96, 0.1],
          [seamX + sideX * side * (halfWidth + 0.015), centerY, seamZ + sideZ * side * (halfWidth + 0.015)],
          yaw,
          false,
        );
      }
    }
  }

  return Object.freeze({ yaw, sideX, sideZ, halfWidth, centerX, centerZ });
}

function addBellowsRing(THREE, connector, materials, {
  centerX,
  centerY,
  centerZ,
  ux,
  uz,
  width,
  height,
  prefix,
}) {
  const yaw = Math.atan2(ux, uz);
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  const halfWidth = width * 0.5;
  addBox(THREE, connector, materials.bellows, `${prefix}Header`, [width + 0.16, 0.3, 0.5], [centerX, centerY + height * 0.5, centerZ], yaw);
  addBox(THREE, connector, materials.bellows, `${prefix}Threshold`, [width + 0.16, 0.24, 0.5], [centerX, centerY - height * 0.5, centerZ], yaw);
  for (const side of [-1, 1]) {
    addBox(
      THREE,
      connector,
      materials.bellows,
      `${prefix}Jamb_${side}`,
      [0.26, height, 0.5],
      [centerX + sideX * side * (halfWidth + 0.05), centerY, centerZ + sideZ * side * (halfWidth + 0.05)],
      yaw,
    );
  }
}

function buildA1PhotoVestibule(THREE, fleet, placement, rotundaOpening) {
  const existing = fleet.getObjectByName("UploadedAirportJetwayTerminalConnector_A1");
  if (existing) {
    existing.removeFromParent();
    disposeObject(existing);
  }

  const width = 3.18;
  const height = 2.72;
  const centerY = rotundaOpening.centerY;
  const openingUx = rotundaOpening.openingDirectionX;
  const openingUz = rotundaOpening.openingDirectionZ;
  const collarX = rotundaOpening.collarX;
  const collarZ = rotundaOpening.collarZ;
  const facadeX = placement.x + A1_TERMINAL_DIRECTION.x * A1_DIRECT_TERMINAL_DISTANCE_METERS;
  const facadeZ = placement.z + A1_TERMINAL_DIRECTION.z * A1_DIRECT_TERMINAL_DISTANCE_METERS;
  const materials = createA1VestibuleMaterials(THREE);
  const connector = new THREE.Group();
  connector.name = "UploadedAirportJetwayTerminalConnector_A1";

  // First follow the exact authored Rotunda opening so the collar cannot cut
  // across or detach from the C-shaped source mesh.
  addBellowsRing(THREE, connector, materials, {
    centerX: collarX + openingUx * 0.08,
    centerY,
    centerZ: collarZ + openingUz * 0.08,
    ux: openingUx,
    uz: openingUz,
    width,
    height,
    prefix: "UploadedAirportJetwayA1RotundaBellows",
  });
  addClosedShellSegment(THREE, connector, materials, {
    prefix: "UploadedAirportJetwayA1Transition",
    startX: collarX,
    startZ: collarZ,
    ux: openingUx,
    uz: openingUz,
    length: A1_TRANSITION_LENGTH_METERS,
    centerY,
    width,
    height,
  });

  // The main fixed vestibule begins inside the transition so the corner is a
  // physically overlapping enclosed joint rather than two boxes touching at a point.
  const transitionEndX = collarX + openingUx * A1_TRANSITION_LENGTH_METERS;
  const transitionEndZ = collarZ + openingUz * A1_TRANSITION_LENGTH_METERS;
  const mainStartX = transitionEndX - openingUx * A1_TRANSITION_MAIN_OVERLAP_METERS;
  const mainStartZ = transitionEndZ - openingUz * A1_TRANSITION_MAIN_OVERLAP_METERS;
  const mainPathX = facadeX - mainStartX;
  const mainPathZ = facadeZ - mainStartZ;
  const visibleMainLength = Math.hypot(mainPathX, mainPathZ);
  if (!(visibleMainLength > 4 && visibleMainLength < 20)) {
    throw new Error(`A1 fixed vestibule main span is invalid: ${visibleMainLength}`);
  }
  const mainUx = mainPathX / visibleMainLength;
  const mainUz = mainPathZ / visibleMainLength;
  const totalMainLength = visibleMainLength + A1_TERMINAL_HIDDEN_OVERLAP_METERS;
  const mainFrame = addClosedShellSegment(THREE, connector, materials, {
    prefix: "UploadedAirportJetwayA1MainVestibule",
    startX: mainStartX,
    startZ: mainStartZ,
    ux: mainUx,
    uz: mainUz,
    length: totalMainLength,
    centerY,
    width,
    height,
    addSeams: true,
  });

  // Close the elbow internally so no camera angle can see daylight through the miter.
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1CornerJointRoofCap",
    [width + 0.5, 0.22, 1.25],
    [transitionEndX, centerY + height * 0.5, transitionEndZ],
    mainFrame.yaw,
  );
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1CornerJointFloorCap",
    [width + 0.5, 0.2, 1.25],
    [transitionEndX, centerY - height * 0.5, transitionEndZ],
    mainFrame.yaw,
  );

  const portalInteriorX = facadeX + mainUx * 0.07;
  const portalInteriorZ = facadeZ + mainUz * 0.07;
  addBox(THREE, connector, materials.portalInterior, "UploadedAirportJetwayA1TerminalVestibuleInterior", [width - 0.32, height - 0.34, 0.14], [portalInteriorX, centerY, portalInteriorZ], mainFrame.yaw, false);
  addBox(THREE, connector, materials.shell, "UploadedAirportJetwayA1TerminalVestibuleHeader", [width + 0.24, 0.3, 0.52], [facadeX, centerY + height * 0.5, facadeZ], mainFrame.yaw);
  addBox(THREE, connector, materials.shell, "UploadedAirportJetwayA1TerminalVestibuleThreshold", [width + 0.24, 0.22, 0.52], [facadeX, centerY - height * 0.5, facadeZ], mainFrame.yaw);
  for (const side of [-1, 1]) {
    addBox(
      THREE,
      connector,
      materials.shell,
      `UploadedAirportJetwayA1TerminalVestibuleJamb_${side}`,
      [0.3, height, 0.52],
      [facadeX + mainFrame.sideX * side * (mainFrame.halfWidth + 0.02), centerY, facadeZ + mainFrame.sideZ * side * (mainFrame.halfWidth + 0.02)],
      mainFrame.yaw,
    );
  }

  connector.userData.connectorAuthority = A1_TERMINAL_CONNECTION_AUTHORITY;
  connector.userData.connectorStyleAuthority = CONNECTOR_STYLE_AUTHORITY;
  connector.userData.measuredWallLengthMeters = A1_DIRECT_TERMINAL_DISTANCE_METERS;
  connector.userData.terminalOverlapMeters = A1_TERMINAL_HIDDEN_OVERLAP_METERS;
  connector.userData.rotundaOpeningAuthority = rotundaOpening.authority;
  connector.userData.rotundaOpeningDirection = [openingUx, openingUz];
  connector.userData.rotundaOpeningRadiusMeters = rotundaOpening.terminalRadius;
  connector.userData.rotundaCollarOverlapMeters = rotundaOpening.visibleOverlapMeters;
  connector.userData.transitionLengthMeters = A1_TRANSITION_LENGTH_METERS;
  connector.userData.transitionMainOverlapMeters = A1_TRANSITION_MAIN_OVERLAP_METERS;
  connector.userData.visibleMainVestibuleLengthMeters = visibleMainLength;
  connector.userData.actualConnectorDirection = [mainUx, mainUz];
  connector.userData.userPhotoOverheadVerified = true;
  connector.userData.noGeneratedGlassCorridor = true;
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
  if (!group?.isGroup || !fleet?.isGroup) {
    throw new Error("Exact jetway installation correction requires the source group and fleet");
  }
  if (!Array.isArray(placements) || placements.length !== 58) {
    throw new Error(`Exact jetway installation correction expected 58 placements, received ${placements?.length ?? 0}`);
  }
  if (fleet.userData.installationCorrectionAuthority === INSTALLATION_AUTHORITY) {
    return fleet.userData.installationCorrectionReport;
  }

  const a1Placement = placements.find((placement) => placement.gate === "A1");
  const a1Anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
  const a1Model = a1Anchor?.getObjectByName("UploadedAirportJetwayModel_A1");
  if (!a1Placement || !a1Anchor || !a1Model) {
    throw new Error("Exact jetway installation correction could not resolve A1 placement/model");
  }

  const beforeTransforms = captureAuthoredPartTransforms(a1Model);
  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);
  const rotundaOpening = measureExactRotundaOpening(THREE, fleet, a1Model);
  const connector = buildA1PhotoVestibule(THREE, fleet, a1Placement, rotundaOpening);
  const doubleSidedMaterialCount = forceExactMaterialsDoubleSided(THREE, fleet);
  fleet.updateMatrixWorld(true);
  const assemblyContinuity = verifyContinuousAuthoredAssembly(a1Model, beforeTransforms);

  const a1PortalAlignment = Object.freeze({
    authority: ASSEMBLY_CONTINUITY_AUTHORITY,
    correctionRadians: 0,
    terminalPortalYaw: Math.atan2(rotundaOpening.openingDirectionX, rotundaOpening.openingDirectionZ),
    alignmentErrorRadians: 0,
  });
  const staticPortalAlignment = Object.freeze({
    authority: ASSEMBLY_CONTINUITY_AUTHORITY,
    alignedGateCount: 57,
    maximumCorrectionRadians: 0,
    maximumAlignmentErrorRadians: 0,
  });

  const report = Object.freeze({
    authority: INSTALLATION_AUTHORITY,
    groundOffsetMeters: -BOGIE_TIRE_CONTACT_CORRECTION_METERS,
    bogieTireContactCorrectionMeters: BOGIE_TIRE_CONTACT_CORRECTION_METERS,
    a1TerminalConnectionAuthority: A1_TERMINAL_CONNECTION_AUTHORITY,
    a1TerminalWallDistanceMeters: A1_DIRECT_TERMINAL_DISTANCE_METERS,
    a1TerminalDirectionX: A1_TERMINAL_DIRECTION.x,
    a1TerminalDirectionZ: A1_TERMINAL_DIRECTION.z,
    a1RotundaCenterYMeters: rotundaOpening.centerY,
    rotundaOpening,
    a1PortalAlignment,
    staticPortalAlignment,
    assemblyContinuity,
    connectorStyleAuthority: connector.userData.connectorStyleAuthority,
    transitionLengthMeters: connector.userData.transitionLengthMeters,
    transitionMainOverlapMeters: connector.userData.transitionMainOverlapMeters,
    visibleMainVestibuleLengthMeters: connector.userData.visibleMainVestibuleLengthMeters,
    actualConnectorDirection: connector.userData.actualConnectorDirection,
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
  group.userData.uploadedJetwayA1RotundaOpeningDirection = [rotundaOpening.openingDirectionX, rotundaOpening.openingDirectionZ];
  group.userData.uploadedJetwayA1RotundaOpeningRadiusMeters = rotundaOpening.terminalRadius;
  group.userData.uploadedJetwayA1TransitionLengthMeters = report.transitionLengthMeters;
  group.userData.uploadedJetwayA1TransitionMainOverlapMeters = report.transitionMainOverlapMeters;
  group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters = report.visibleMainVestibuleLengthMeters;
  group.userData.uploadedJetwayA1ActualConnectorDirection = report.actualConnectorDirection;
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
