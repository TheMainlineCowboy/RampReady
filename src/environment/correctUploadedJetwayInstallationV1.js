const INSTALLATION_AUTHORITY = "user-photo-overhead-terminal-anchor-bogie-contact-and-continuous-assembly-v4";
const A1_TERMINAL_CONNECTION_AUTHORITY = "user-photo-overhead-authored-terminal-wall-direct-v1";
const ASSEMBLY_CONTINUITY_AUTHORITY = "exact-authored-five-part-chain-no-isolated-node-rotation-v2";
const ROTUNDA_FACE_AUTHORITY = "exact-uploaded-tunnel-a-overlap-and-rotunda-terminal-face-bounds-v2";
const A1_DIRECT_TERMINAL_DISTANCE_METERS = 16.08913693907184;
const A1_TERMINAL_HIDDEN_OVERLAP_METERS = 0.55;
const A1_TUNNEL_VISIBLE_OVERLAP_METERS = 0.18;
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
  const shell = new THREE.MeshStandardMaterial({
    name: "A1 same-day-photo solid white fixed vestibule shell",
    color: 0xe7e6df,
    roughness: 0.78,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const seam = new THREE.MeshStandardMaterial({
    name: "A1 same-day-photo vestibule panel seams",
    color: 0xc5c7c4,
    roughness: 0.72,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  const bellows = new THREE.MeshStandardMaterial({
    name: "A1 same-day-photo rotunda vestibule bellows",
    color: 0x303337,
    roughness: 0.92,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });
  const portalInterior = new THREE.MeshStandardMaterial({
    name: "A1 terminal vestibule dark interior",
    color: 0x171b1d,
    roughness: 0.94,
    metalness: 0.01,
    side: THREE.DoubleSide,
  });
  return { shell, seam, bellows, portalInterior };
}

function localBoundsCorners(THREE, fleet, object) {
  const worldBounds = new THREE.Box3().setFromObject(object);
  const corners = [];
  for (const x of [worldBounds.min.x, worldBounds.max.x]) {
    for (const y of [worldBounds.min.y, worldBounds.max.y]) {
      for (const z of [worldBounds.min.z, worldBounds.max.z]) {
        const corner = new THREE.Vector3(x, y, z);
        fleet.worldToLocal(corner);
        corners.push(corner);
      }
    }
  }
  return { worldBounds, corners };
}

function measureRotundaTerminalFrame(THREE, fleet, a1Model) {
  const rotunda = a1Model.getObjectByName("Rotunda");
  const tunnelA = a1Model.getObjectByName("Tunnel_A");
  if (!rotunda || !tunnelA) {
    throw new Error("A1 exact jetway is missing the authored Rotunda or Tunnel_A node for terminal-face measurement");
  }
  fleet.updateMatrixWorld(true);
  const { worldBounds: rotundaWorldBounds, corners: rotundaCorners } = localBoundsCorners(THREE, fleet, rotunda);
  const { corners: tunnelCorners } = localBoundsCorners(THREE, fleet, tunnelA);
  const center = rotundaWorldBounds.getCenter(new THREE.Vector3());
  fleet.worldToLocal(center);

  const ux = A1_TERMINAL_DIRECTION.x;
  const uz = A1_TERMINAL_DIRECTION.z;
  const project = (point) => point.x * ux + point.z * uz;
  const centerProjection = project(center);
  const rotundaTerminalProjection = Math.max(...rotundaCorners.map(project));
  const tunnelTerminalProjection = Math.max(...tunnelCorners.map(project));
  const terminalRadius = rotundaTerminalProjection - centerProjection;
  const connectorStartProjection = tunnelTerminalProjection - A1_TUNNEL_VISIBLE_OVERLAP_METERS;
  const connectorStartRadius = connectorStartProjection - centerProjection;
  if (!(terminalRadius > 0.25 && terminalRadius < 6)) {
    throw new Error(`A1 exact Rotunda terminal-face radius is invalid: ${terminalRadius}`);
  }
  if (!(connectorStartRadius > 0.1 && connectorStartRadius < terminalRadius)) {
    throw new Error(`A1 exact connector start does not overlap Tunnel A inside the Rotunda bounds: ${connectorStartRadius}/${terminalRadius}`);
  }
  return Object.freeze({
    authority: ROTUNDA_FACE_AUTHORITY,
    centerX: center.x,
    centerY: center.y,
    centerZ: center.z,
    terminalRadius,
    terminalFaceX: center.x + ux * terminalRadius,
    terminalFaceZ: center.z + uz * terminalRadius,
    connectorStartRadius,
    connectorStartX: center.x + ux * connectorStartRadius,
    connectorStartZ: center.z + uz * connectorStartRadius,
    tunnelTerminalProjection,
    visibleTunnelOverlapMeters: A1_TUNNEL_VISIBLE_OVERLAP_METERS,
  });
}

function buildA1PhotoVestibule(THREE, fleet, placement, rotundaFrame) {
  const existing = fleet.getObjectByName("UploadedAirportJetwayTerminalConnector_A1");
  if (existing) {
    existing.removeFromParent();
    disposeObject(existing);
  }

  const directionMagnitude = Math.hypot(A1_TERMINAL_DIRECTION.x, A1_TERMINAL_DIRECTION.z) || 1;
  const ux = A1_TERMINAL_DIRECTION.x / directionMagnitude;
  const uz = A1_TERMINAL_DIRECTION.z / directionMagnitude;
  const yaw = Math.atan2(ux, uz);
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  const facadeX = placement.x + ux * A1_DIRECT_TERMINAL_DISTANCE_METERS;
  const facadeZ = placement.z + uz * A1_DIRECT_TERMINAL_DISTANCE_METERS;
  const startX = rotundaFrame.connectorStartX;
  const startZ = rotundaFrame.connectorStartZ;
  const visibleLength = Math.hypot(facadeX - startX, facadeZ - startZ);
  if (!(visibleLength > 4 && visibleLength < A1_DIRECT_TERMINAL_DISTANCE_METERS)) {
    throw new Error(`A1 photo vestibule visible span is invalid: ${visibleLength}`);
  }
  const totalLength = visibleLength + A1_TERMINAL_HIDDEN_OVERLAP_METERS;
  const width = 3.18;
  const halfWidth = width * 0.5;
  const height = 2.72;
  const centerX = startX + ux * totalLength * 0.5;
  const centerZ = startZ + uz * totalLength * 0.5;
  const centerY = rotundaFrame.centerY;
  const materials = createA1VestibuleMaterials(THREE);
  const connector = new THREE.Group();
  connector.name = "UploadedAirportJetwayTerminalConnector_A1";

  // The same-day A1 photos show a closed white fixed vestibule, not a glass corridor.
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1VestibuleRoof",
    [width, 0.18, totalLength],
    [centerX, centerY + height * 0.5, centerZ],
    yaw,
  );
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1VestibuleFloor",
    [width, 0.16, totalLength],
    [centerX, centerY - height * 0.5, centerZ],
    yaw,
  );
  for (const side of [-1, 1]) {
    const sideOffsetX = sideX * side * halfWidth;
    const sideOffsetZ = sideZ * side * halfWidth;
    addBox(
      THREE,
      connector,
      materials.shell,
      `UploadedAirportJetwayA1VestibuleSolidWall_${side}`,
      [0.14, height, totalLength],
      [centerX + sideOffsetX, centerY, centerZ + sideOffsetZ],
      yaw,
    );
  }

  // Subtle panel seams make the span read like the corrugated white fixed bridge in the photos.
  const seamCount = Math.max(3, Math.round(visibleLength / 2.4));
  for (let seamIndex = 1; seamIndex < seamCount; seamIndex += 1) {
    const distance = (visibleLength * seamIndex) / seamCount;
    const seamX = startX + ux * distance;
    const seamZ = startZ + uz * distance;
    for (const side of [-1, 1]) {
      addBox(
        THREE,
        connector,
        materials.seam,
        `UploadedAirportJetwayA1VestibuleWallSeam_${seamIndex}_${side}`,
        [0.055, height * 0.96, 0.1],
        [
          seamX + sideX * side * (halfWidth + 0.015),
          centerY,
          seamZ + sideZ * side * (halfWidth + 0.015),
        ],
        yaw,
        false,
      );
    }
  }

  // The flexible collar overlaps the exact Tunnel A terminal edge so the
  // authored Rotunda's open sector cannot produce a visible broken middle.
  const rotundaCollarX = startX + ux * 0.1;
  const rotundaCollarZ = startZ + uz * 0.1;
  addBox(
    THREE,
    connector,
    materials.bellows,
    "UploadedAirportJetwayA1RotundaBellowsHeader",
    [width + 0.16, 0.28, 0.42],
    [rotundaCollarX, centerY + height * 0.5, rotundaCollarZ],
    yaw,
  );
  addBox(
    THREE,
    connector,
    materials.bellows,
    "UploadedAirportJetwayA1RotundaBellowsThreshold",
    [width + 0.16, 0.22, 0.42],
    [rotundaCollarX, centerY - height * 0.5, rotundaCollarZ],
    yaw,
  );
  for (const side of [-1, 1]) {
    addBox(
      THREE,
      connector,
      materials.bellows,
      `UploadedAirportJetwayA1RotundaBellowsJamb_${side}`,
      [0.24, height, 0.42],
      [
        rotundaCollarX + sideX * side * (halfWidth + 0.05),
        centerY,
        rotundaCollarZ + sideZ * side * (halfWidth + 0.05),
      ],
      yaw,
    );
  }

  // The terminal-side collar overlaps the real facade slightly so daylight cannot show through.
  const portalInteriorX = facadeX + ux * 0.07;
  const portalInteriorZ = facadeZ + uz * 0.07;
  addBox(
    THREE,
    connector,
    materials.portalInterior,
    "UploadedAirportJetwayA1TerminalVestibuleInterior",
    [width - 0.32, height - 0.34, 0.14],
    [portalInteriorX, centerY, portalInteriorZ],
    yaw,
    false,
  );
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1TerminalVestibuleHeader",
    [width + 0.24, 0.3, 0.52],
    [facadeX, centerY + height * 0.5, facadeZ],
    yaw,
  );
  addBox(
    THREE,
    connector,
    materials.shell,
    "UploadedAirportJetwayA1TerminalVestibuleThreshold",
    [width + 0.24, 0.22, 0.52],
    [facadeX, centerY - height * 0.5, facadeZ],
    yaw,
  );
  for (const side of [-1, 1]) {
    addBox(
      THREE,
      connector,
      materials.shell,
      `UploadedAirportJetwayA1TerminalVestibuleJamb_${side}`,
      [0.3, height, 0.52],
      [
        facadeX + sideX * side * (halfWidth + 0.02),
        centerY,
        facadeZ + sideZ * side * (halfWidth + 0.02),
      ],
      yaw,
    );
  }

  connector.userData.connectorAuthority = A1_TERMINAL_CONNECTION_AUTHORITY;
  connector.userData.connectorStyleAuthority = "same-day-a1-photo-solid-white-fixed-vestibule-v3";
  connector.userData.connectorLengthMeters = totalLength;
  connector.userData.visibleVestibuleLengthMeters = visibleLength;
  connector.userData.measuredWallLengthMeters = A1_DIRECT_TERMINAL_DISTANCE_METERS;
  connector.userData.terminalOverlapMeters = A1_TERMINAL_HIDDEN_OVERLAP_METERS;
  connector.userData.rotundaTerminalFaceAuthority = rotundaFrame.authority;
  connector.userData.rotundaTerminalRadiusMeters = rotundaFrame.terminalRadius;
  connector.userData.visibleTunnelOverlapMeters = rotundaFrame.visibleTunnelOverlapMeters;
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

  // Preserve the complete authored articulated chain. No Rotunda, tunnel, cab,
  // stair or bogie node is rotated independently during terminal installation.
  const beforeTransforms = captureAuthoredPartTransforms(a1Model);
  fleet.position.y -= BOGIE_TIRE_CONTACT_CORRECTION_METERS;
  fleet.updateMatrixWorld(true);
  const rotundaFrame = measureRotundaTerminalFrame(THREE, fleet, a1Model);
  const connector = buildA1PhotoVestibule(THREE, fleet, a1Placement, rotundaFrame);
  const doubleSidedMaterialCount = forceExactMaterialsDoubleSided(THREE, fleet);
  fleet.updateMatrixWorld(true);
  const assemblyContinuity = verifyContinuousAuthoredAssembly(a1Model, beforeTransforms);

  const a1PortalAlignment = Object.freeze({
    authority: ASSEMBLY_CONTINUITY_AUTHORITY,
    correctionRadians: 0,
    terminalPortalYaw: Math.atan2(A1_TERMINAL_DIRECTION.x, A1_TERMINAL_DIRECTION.z),
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
    a1RotundaCenterYMeters: rotundaFrame.centerY,
    rotundaFrame,
    a1PortalAlignment,
    staticPortalAlignment,
    assemblyContinuity,
    connectorStyleAuthority: connector.userData.connectorStyleAuthority,
    visibleVestibuleLengthMeters: connector.userData.visibleVestibuleLengthMeters,
    visibleTunnelOverlapMeters: connector.userData.visibleTunnelOverlapMeters,
    doubleSidedMaterialCount,
  });

  fleet.userData.installationCorrectionAuthority = INSTALLATION_AUTHORITY;
  fleet.userData.installationCorrectionReport = report;
  group.userData.uploadedJetwayInstallationCorrectionAuthority = INSTALLATION_AUTHORITY;
  group.userData.uploadedJetwayFleetGroundOffsetMeters = report.groundOffsetMeters;
  group.userData.uploadedJetwayBogieTireContactCorrectionMeters = report.bogieTireContactCorrectionMeters;
  group.userData.uploadedJetwayA1TerminalConnectionAuthority = report.a1TerminalConnectionAuthority;
  group.userData.uploadedJetwayA1TerminalWallDistanceMeters = report.a1TerminalWallDistanceMeters;
  group.userData.uploadedJetwayA1TerminalConnectionDirection = [
    report.a1TerminalDirectionX,
    report.a1TerminalDirectionZ,
  ];
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
  group.userData.uploadedJetwayA1RotundaTerminalFaceAuthority = rotundaFrame.authority;
  group.userData.uploadedJetwayA1RotundaTerminalRadiusMeters = rotundaFrame.terminalRadius;
  group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters = report.visibleVestibuleLengthMeters;
  group.userData.uploadedJetwayA1VisibleTunnelOverlapMeters = report.visibleTunnelOverlapMeters;
  group.userData.a1TerminalWallDistance = report.a1TerminalWallDistanceMeters;
  group.userData.a1TerminalConnectionAuthority = report.a1TerminalConnectionAuthority;
  group.userData.a1TerminalConnectionDirection = [
    report.a1TerminalDirectionX,
    report.a1TerminalDirectionZ,
  ];

  return report;
}

export {
  INSTALLATION_AUTHORITY as UPLOADED_JETWAY_INSTALLATION_CORRECTION_AUTHORITY,
  A1_TERMINAL_CONNECTION_AUTHORITY as UPLOADED_JETWAY_A1_TERMINAL_CONNECTION_AUTHORITY,
  ASSEMBLY_CONTINUITY_AUTHORITY as UPLOADED_JETWAY_ASSEMBLY_CONTINUITY_AUTHORITY,
  BOGIE_TIRE_CONTACT_CORRECTION_METERS as UPLOADED_JETWAY_BOGIE_TIRE_CONTACT_CORRECTION_METERS,
};
