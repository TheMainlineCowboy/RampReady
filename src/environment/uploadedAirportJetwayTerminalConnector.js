const CONNECTOR_AUTHORITY = "measured-authored-terminal-wall-to-uploaded-rotunda-v5-facade-plane-portal-static-instanced";
const STATIC_CONNECTOR_BATCH_AUTHORITY = "57-static-terminal-connectors-three-instanced-box-batches-v1";
const STATIC_VISIBLE_TERMINAL_LEG_METERS = 2.4;
const STATIC_ROTUNDA_OVERLAP_METERS = 0.12;
const STATIC_TERMINAL_OVERLAP_METERS = 0.18;

function createConnectorMaterials(THREE) {
  const shell = new THREE.MeshStandardMaterial({
    name: "Uploaded airport jetway fixed terminal connector shell",
    color: 0xe1e2df,
    roughness: 0.78,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const frame = new THREE.MeshStandardMaterial({
    name: "Uploaded airport jetway fixed connector frame",
    color: 0xc7cac7,
    roughness: 0.82,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });
  // Keep the existing three-batch runtime contract, but the photo-accurate
  // Terminal 4 vestibule is opaque solid white rather than a glazed corridor.
  const glass = new THREE.MeshStandardMaterial({
    name: "Uploaded airport jetway fixed connector opaque upper wall",
    color: 0xe1e2df,
    roughness: 0.78,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const portalInterior = new THREE.MeshStandardMaterial({
    name: "Uploaded airport jetway terminal portal interior",
    color: 0x151c1f,
    roughness: 0.9,
    metalness: 0.02,
    side: THREE.DoubleSide,
  });
  return { shell, frame, glass, portalInterior };
}

function measureConnector(placement) {
  const measuredLength = Math.max(1.25, Math.min(18, Number(placement.wallConnectorLength) || 1.25));
  const towardX = Number(placement.connectorTowardX) || 0;
  const towardZ = Number(placement.connectorTowardZ) || 0;
  const magnitude = Math.hypot(towardX, towardZ) || 1;
  const ux = towardX / magnitude;
  const uz = towardZ / magnitude;

  let terminalOverlap;
  let length;
  let startDistance;
  if (placement.gate === "A1") {
    // A1 is subsequently replaced by the dedicated fixed-wall Rotunda elbow;
    // preserve the legacy dimensions here so preparation order stays stable.
    terminalOverlap = 1.45;
    length = Math.max(1.8, Math.min(19.5, measuredLength + terminalOverlap));
    startDistance = 0;
  } else {
    // Registered static placements report wallConnectorLength from the exact
    // authored Rotunda center to the real terminal wall. Do not start a new
    // corridor at that center: it buries the supplied Rotunda. Begin at the
    // Rotunda perimeter, overlap it by only 12 cm, keep exactly 2.4 m visible,
    // and hide only 18 cm in the terminal facade.
    const inferredRotundaRadius = Math.max(0, measuredLength - STATIC_VISIBLE_TERMINAL_LEG_METERS);
    terminalOverlap = STATIC_TERMINAL_OVERLAP_METERS;
    startDistance = Math.max(0, inferredRotundaRadius - STATIC_ROTUNDA_OVERLAP_METERS);
    length = STATIC_VISIBLE_TERMINAL_LEG_METERS + STATIC_ROTUNDA_OVERLAP_METERS + STATIC_TERMINAL_OVERLAP_METERS;
  }

  const centerDistance = startDistance + length * 0.5;
  const centerX = placement.x + ux * centerDistance;
  const centerZ = placement.z + uz * centerDistance;
  const centerY = Number(placement.rotundaY) || 4.1;
  const yaw = Math.atan2(ux, uz);
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  return {
    measuredLength,
    terminalOverlap,
    length,
    startDistance,
    ux,
    uz,
    centerX,
    centerY,
    centerZ,
    yaw,
    sideX,
    sideZ,
    span: length,
    halfWidth: 1.31,
  };
}

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

function pushTransform(target, position, yaw, scale) {
  target.push({ position, yaw, scale });
}

function addBaseConnectorTransforms(placement, targets) {
  const frame = measureConnector(placement);
  const { centerX, centerY, centerZ, yaw, sideX, sideZ, span, halfWidth, length, ux, uz } = frame;

  pushTransform(targets.shell, [centerX, centerY + 1.19, centerZ], yaw, [2.68, 0.18, span]);
  pushTransform(targets.frame, [centerX, centerY - 1.17, centerZ], yaw, [2.58, 0.16, span]);

  for (const side of [-1, 1]) {
    const sideOffsetX = sideX * side * halfWidth;
    const sideOffsetZ = sideZ * side * halfWidth;
    pushTransform(
      targets.shell,
      [centerX + sideOffsetX, centerY - 0.66, centerZ + sideOffsetZ],
      yaw,
      [0.12, 0.88, span],
    );
    pushTransform(
      targets.glass,
      [centerX + sideOffsetX * 1.008, centerY + 0.31, centerZ + sideOffsetZ * 1.008],
      yaw,
      [0.035, 1.0, length],
    );
    pushTransform(
      targets.frame,
      [centerX + sideOffsetX, centerY + 0.86, centerZ + sideOffsetZ],
      yaw,
      [0.12, 0.18, span],
    );
  }

  // The two ends remain physically open for passenger passage, but the static
  // vestibule starts inside the supplied Rotunda and ends inside the real wall,
  // so neither open cross-section is exposed to the apron.
  for (const end of [-1, 1]) {
    const alongX = ux * end * length * 0.5;
    const alongZ = uz * end * length * 0.5;
    for (const side of [-1, 1]) {
      pushTransform(
        targets.frame,
        [
          centerX + alongX + sideX * side * halfWidth,
          centerY,
          centerZ + alongZ + sideZ * side * halfWidth,
        ],
        yaw,
        [0.14, 2.25, 0.14],
      );
    }
  }

  return frame;
}

function buildInstancedBatch(THREE, name, material, transforms) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const batch = new THREE.InstancedMesh(geometry, material, transforms.length);
  batch.name = name;
  batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  batch.castShadow = false;
  batch.receiveShadow = true;
  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const rotation = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  const euler = new THREE.Euler();
  transforms.forEach((transform, index) => {
    position.fromArray(transform.position);
    euler.set(0, transform.yaw, 0);
    rotation.setFromEuler(euler);
    scale.fromArray(transform.scale);
    matrix.compose(position, rotation, scale);
    batch.setMatrixAt(index, matrix);
  });
  batch.instanceMatrix.needsUpdate = true;
  batch.computeBoundingBox();
  batch.computeBoundingSphere();
  return batch;
}

export function addUploadedAirportJetwayStaticTerminalConnectors(THREE, fleet, placements) {
  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  const transforms = { shell: [], frame: [], glass: [] };
  for (const placement of staticPlacements) addBaseConnectorTransforms(placement, transforms);
  const materials = createConnectorMaterials(THREE);
  const group = new THREE.Group();
  group.name = "UploadedAirportJetwayStaticTerminalConnectorBatches";
  group.userData.connectorAuthority = CONNECTOR_AUTHORITY;
  group.userData.batchAuthority = STATIC_CONNECTOR_BATCH_AUTHORITY;
  group.userData.staticGateCount = staticPlacements.length;
  group.userData.visibleTerminalLegMeters = STATIC_VISIBLE_TERMINAL_LEG_METERS;
  group.userData.rotundaOverlapMeters = STATIC_ROTUNDA_OVERLAP_METERS;
  group.userData.terminalOverlapMeters = STATIC_TERMINAL_OVERLAP_METERS;
  group.userData.solidOpaqueTerminalVestibule = true;
  group.add(
    buildInstancedBatch(THREE, "UploadedAirportJetwayStaticConnectorShells", materials.shell, transforms.shell),
    buildInstancedBatch(THREE, "UploadedAirportJetwayStaticConnectorFrames", materials.frame, transforms.frame),
    buildInstancedBatch(THREE, "UploadedAirportJetwayStaticConnectorGlass", materials.glass, transforms.glass),
  );
  group.userData.batchCount = group.children.length;
  group.userData.instanceCount = transforms.shell.length + transforms.frame.length + transforms.glass.length;
  fleet.add(group);
  return {
    group,
    staticGateCount: staticPlacements.length,
    batchCount: group.children.length,
    instanceCount: group.userData.instanceCount,
    authority: STATIC_CONNECTOR_BATCH_AUTHORITY,
  };
}

export function addUploadedAirportJetwayTerminalConnector(THREE, fleet, placement) {
  const frame = measureConnector(placement);
  const connector = new THREE.Group();
  connector.name = `UploadedAirportJetwayTerminalConnector_${placement.gate}`;
  connector.userData.connectorAuthority = CONNECTOR_AUTHORITY;
  connector.userData.connectorLengthMeters = frame.length;
  connector.userData.measuredWallLengthMeters = frame.measuredLength;
  connector.userData.terminalOverlapMeters = frame.terminalOverlap;

  const materials = createConnectorMaterials(THREE);
  const castDynamicShadow = placement.gate === "A1";
  const transforms = { shell: [], frame: [], glass: [] };
  addBaseConnectorTransforms(placement, transforms);
  let shellIndex = 0;
  let frameIndex = 0;
  let glassIndex = 0;
  for (const transform of transforms.shell) {
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(...transform.scale),
      materials.shell,
      `UploadedAirportJetwayTerminalConnectorShell_${placement.gate}_${shellIndex++}`,
      transform.position,
      transform.yaw,
      castDynamicShadow,
    );
  }
  for (const transform of transforms.frame) {
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(...transform.scale),
      materials.frame,
      `UploadedAirportJetwayTerminalConnectorFrame_${placement.gate}_${frameIndex++}`,
      transform.position,
      transform.yaw,
      castDynamicShadow,
    );
  }
  for (const transform of transforms.glass) {
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(...transform.scale),
      materials.glass,
      `UploadedAirportJetwayTerminalConnectorGlass_${placement.gate}_${glassIndex++}`,
      transform.position,
      transform.yaw,
      false,
    );
  }

  if (placement.gate === "A1") {
    const { centerX, centerY, centerZ, yaw, sideX, sideZ, length, ux, uz } = frame;
    for (const fraction of [0.24, 0.5, 0.76]) {
      const alongX = ux * (fraction - 0.5) * length;
      const alongZ = uz * (fraction - 0.5) * length;
      for (const side of [-1, 1]) {
        addBox(
          THREE,
          connector,
          new THREE.BoxGeometry(0.09, 2.1, 0.09),
          materials.frame,
          `UploadedAirportJetwayTerminalConnectorMullion_A1_${fraction}_${side}`,
          [
            centerX + alongX + sideX * side * frame.halfWidth,
            centerY + 0.03,
            centerZ + alongZ + sideZ * side * frame.halfWidth,
          ],
          yaw,
          true,
        );
      }
    }

    // The legacy A1 connector is removed by the dedicated fixed-wall Rotunda
    // elbow later in the preparation stack. Keep its portal metadata intact so
    // earlier migration checks remain deterministic.
    const facadeDistance = Math.max(0.8, frame.measuredLength - 0.08);
    const facadeX = placement.x + ux * facadeDistance;
    const facadeZ = placement.z + uz * facadeDistance;
    const interiorX = facadeX + ux * 0.09;
    const interiorZ = facadeZ + uz * 0.09;

    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(2.44, 2.08, 0.12),
      materials.portalInterior,
      "UploadedAirportJetwayTerminalPortalInterior_A1",
      [interiorX, centerY - 0.02, interiorZ],
      yaw,
      false,
    );
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(3.16, 0.28, 0.5),
      materials.shell,
      "UploadedAirportJetwayTerminalPortalOuterHeader_A1",
      [facadeX, centerY + 1.2, facadeZ],
      yaw,
      true,
    );
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(3.1, 0.18, 0.54),
      materials.shell,
      "UploadedAirportJetwayTerminalPortalOuterThreshold_A1",
      [facadeX, centerY - 1.17, facadeZ],
      yaw,
      true,
    );
    for (const side of [-1, 1]) {
      addBox(
        THREE,
        connector,
        new THREE.BoxGeometry(0.28, 2.48, 0.52),
        materials.shell,
        `UploadedAirportJetwayTerminalPortalOuterJamb_A1_${side}`,
        [
          facadeX + sideX * side * 1.44,
          centerY,
          facadeZ + sideZ * side * 1.44,
        ],
        yaw,
        true,
      );
      addBox(
        THREE,
        connector,
        new THREE.BoxGeometry(0.12, 2.16, 0.58),
        materials.frame,
        `UploadedAirportJetwayTerminalPortalInnerJamb_A1_${side}`,
        [
          facadeX + sideX * side * 1.27,
          centerY - 0.02,
          facadeZ + sideZ * side * 1.27,
        ],
        yaw,
        true,
      );
    }
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(2.66, 0.12, 0.58),
      materials.frame,
      "UploadedAirportJetwayTerminalPortalInnerHeader_A1",
      [facadeX, centerY + 1.06, facadeZ],
      yaw,
      true,
    );
    addBox(
      THREE,
      connector,
      new THREE.BoxGeometry(2.64, 0.1, 0.58),
      materials.frame,
      "UploadedAirportJetwayTerminalPortalInnerThreshold_A1",
      [facadeX, centerY - 1.08, facadeZ],
      yaw,
      true,
    );

    connector.userData.a1TerminalPortalFrame = "facade-plane-dark-reveal-with-hidden-deep-overlap-v4";
    connector.userData.a1FacadePortalDistanceMeters = facadeDistance;
    connector.userData.a1HiddenOverlapMeters = frame.terminalOverlap;
  }

  fleet.add(connector);
  return connector;
}

export {
  CONNECTOR_AUTHORITY as UPLOADED_JETWAY_CONNECTOR_AUTHORITY,
  STATIC_CONNECTOR_BATCH_AUTHORITY as UPLOADED_JETWAY_STATIC_CONNECTOR_BATCH_AUTHORITY,
};
