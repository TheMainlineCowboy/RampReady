const STATIC_SOLID_VESTIBULE_AUTHORITY = "57-static-source-measured-real-wall-fixed-terminal-legs-v3";
const STATIC_CORRIDOR_DETAIL_AUTHORITY = "57-static-compact-panelled-real-wall-fixed-terminal-legs-v2";
const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 0.25;
const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.25;
const TERMINAL_HIDDEN_OVERLAP_METERS = 0.30;
const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;
const WIDTH_METERS = 3.02;
const HEIGHT_METERS = 2.62;
const PANEL_SPACING_METERS = 0.72;

function normalizedTerminalDirection(placement) {
  const x = Number(placement.connectorTowardX);
  const z = Number(placement.connectorTowardZ);
  const magnitude = Math.hypot(x, z);
  if (!(magnitude > 0.95 && magnitude < 1.05)) {
    throw new Error(`Static ${placement.gate} terminal direction is invalid: ${x},${z}`);
  }
  return { x: x / magnitude, z: z / magnitude };
}

function buildShellTransforms(placement) {
  const rotundaX = Number(placement.x);
  const rotundaZ = Number(placement.z);
  const centerY = Number(placement.rotundaY) || 4.1;
  const wallDistance = Number(placement.wallConnectorLength);
  const clearRotundaRadius = Number(placement.staticAuthoredRotundaRadiusMeters);
  const visibleTerminalLegMeters = Number(placement.staticVisibleTerminalLegMeters);
  const terminalWallOverlapMeters = Number(placement.staticTerminalWallOverlapMeters) || 0;
  if (![rotundaX, rotundaZ, centerY, wallDistance, clearRotundaRadius, visibleTerminalLegMeters, terminalWallOverlapMeters].every(Number.isFinite)) {
    throw new Error(`Static ${placement.gate} fixed terminal connector placement is incomplete`);
  }
  if (!(clearRotundaRadius > 0.7 && clearRotundaRadius < 3.5)) {
    throw new Error(`Static ${placement.gate} authored Rotunda radius is invalid: ${clearRotundaRadius}`);
  }
  if (!(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS)) {
    throw new Error(`Static ${placement.gate} compact visible vestibule is invalid: ${visibleTerminalLegMeters}`);
  }
  if (!(terminalWallOverlapMeters >= 0 && terminalWallOverlapMeters < clearRotundaRadius)) {
    throw new Error(`Static ${placement.gate} terminal wall/Rotunda overlap is invalid: ${terminalWallOverlapMeters}`);
  }
  const expectedCenterToWall = clearRotundaRadius + visibleTerminalLegMeters - terminalWallOverlapMeters;
  if (Math.abs(wallDistance - expectedCenterToWall) > 0.02) {
    throw new Error(`Static ${placement.gate} wall/Rotunda registration is inconsistent: ${wallDistance} vs ${expectedCenterToWall}`);
  }

  const direction = normalizedTerminalDirection(placement);
  const yaw = Math.atan2(direction.x, direction.z);
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  const shellStartDistance = clearRotundaRadius - ROTUNDA_SHELL_OVERLAP_METERS;
  const shellLength = visibleTerminalLegMeters + TERMINAL_HIDDEN_OVERLAP_METERS + ROTUNDA_SHELL_OVERLAP_METERS;
  const maximumAllowedShellLength = MAXIMUM_VISIBLE_TERMINAL_LEG_METERS
    + TERMINAL_HIDDEN_OVERLAP_METERS + ROTUNDA_SHELL_OVERLAP_METERS;
  if (!(shellLength > 0.2 && shellLength <= maximumAllowedShellLength + 1e-6)) {
    throw new Error(`Static ${placement.gate} compact terminal connector exceeds the hard visual envelope: ${shellLength}`);
  }
  const shellCenterDistance = shellStartDistance + shellLength * 0.5;
  const centerX = rotundaX + direction.x * shellCenterDistance;
  const centerZ = rotundaZ + direction.z * shellCenterDistance;
  const halfWidth = WIDTH_METERS * 0.5;
  const floorY = centerY - HEIGHT_METERS * 0.5;

  const transforms = [];
  const push = (position, scale) => transforms.push({ position, yaw, scale });

  // This geometry is only the short fixed sleeve between the supplied Rotunda
  // and the real terminal facade. It must never become a substitute jetway.
  push([centerX, centerY + HEIGHT_METERS * 0.5, centerZ], [WIDTH_METERS, 0.16, shellLength]);
  push([centerX, floorY, centerZ], [WIDTH_METERS, 0.14, shellLength]);
  for (const side of [-1, 1]) {
    push(
      [centerX + sideX * side * halfWidth, centerY, centerZ + sideZ * side * halfWidth],
      [0.13, HEIGHT_METERS, shellLength],
    );
  }

  let panelRibCount = 0;
  for (let along = 0.34; along < shellLength - 0.20; along += PANEL_SPACING_METERS) {
    const stationDistance = shellStartDistance + along;
    const ribX = rotundaX + direction.x * stationDistance;
    const ribZ = rotundaZ + direction.z * stationDistance;
    for (const side of [-1, 1]) {
      push(
        [ribX + sideX * side * (halfWidth + 0.018), centerY, ribZ + sideZ * side * (halfWidth + 0.018)],
        [0.035, HEIGHT_METERS * 0.92, 0.04],
      );
    }
    push(
      [ribX, centerY + HEIGHT_METERS * 0.5 + 0.012, ribZ],
      [WIDTH_METERS + 0.05, 0.035, 0.04],
    );
    panelRibCount += 1;
  }

  return {
    transforms,
    visibleTerminalLegMeters,
    terminalWallOverlapMeters,
    wallDistance,
    panelRibCount,
  };
}

function buildInstancedShellBatch(THREE, material, transforms) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const batch = new THREE.InstancedMesh(geometry, material, transforms.length);
  batch.name = "UploadedAirportJetwayStaticSourceMeasuredTerminalConnectors";
  batch.instanceMatrix.setUsage(THREE.StaticDrawUsage);
  batch.castShadow = true;
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

export function addStaticSolidTerminalVestibules(THREE, fleet, placements) {
  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  if (staticPlacements.length !== 57) {
    throw new Error(`Static compact terminal connectors expected 57 gates, received ${staticPlacements.length}`);
  }

  const measured = staticPlacements.map(buildShellTransforms);
  const transforms = measured.flatMap((entry) => entry.transforms);
  const visibleLengths = measured.map((entry) => entry.visibleTerminalLegMeters);
  const wallOverlaps = measured.map((entry) => entry.terminalWallOverlapMeters);
  const wallDistances = measured.map((entry) => entry.wallDistance);
  const panelRibCount = measured.reduce((total, entry) => total + entry.panelRibCount, 0);
  const material = new THREE.MeshStandardMaterial({
    name: "Terminal 4 compact real-wall fixed terminal connector shell",
    color: 0xe1e2df,
    roughness: 0.78,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const group = new THREE.Group();
  group.name = "UploadedAirportJetwayStaticTerminalConnectorBatches";
  group.userData.connectorAuthority = STATIC_SOLID_VESTIBULE_AUTHORITY;
  group.userData.batchAuthority = STATIC_SOLID_VESTIBULE_AUTHORITY;
  group.userData.detailAuthority = STATIC_CORRIDOR_DETAIL_AUTHORITY;
  group.userData.staticGateCount = 57;
  group.userData.minimumVisibleTerminalLegMeters = Math.min(...visibleLengths);
  group.userData.maximumVisibleTerminalLegMeters = Math.max(...visibleLengths);
  group.userData.minimumTerminalWallRotundaOverlapMeters = Math.min(...wallOverlaps);
  group.userData.maximumTerminalWallRotundaOverlapMeters = Math.max(...wallOverlaps);
  group.userData.minimumRotundaCenterToWallMeters = Math.min(...wallDistances);
  group.userData.maximumRotundaCenterToWallMeters = Math.max(...wallDistances);
  group.userData.terminalHiddenOverlapMeters = TERMINAL_HIDDEN_OVERLAP_METERS;
  group.userData.rotundaShellOverlapMeters = ROTUNDA_SHELL_OVERLAP_METERS;
  group.userData.perGateMeasuredTerminalVestibules = true;
  group.userData.sourceMeasuredRealWallConnectors = true;
  group.userData.panelRibCount = panelRibCount;
  group.userData.supportStationCount = 0;
  group.userData.groundSupportedFixedCorridors = false;
  group.userData.compactRealWallSleevesOnly = true;
  group.add(buildInstancedShellBatch(THREE, material, transforms));
  group.userData.batchCount = group.children.length;
  group.userData.instanceCount = transforms.length;
  fleet.add(group);
  return {
    group,
    staticGateCount: 57,
    batchCount: group.children.length,
    instanceCount: transforms.length,
    authority: STATIC_SOLID_VESTIBULE_AUTHORITY,
    detailAuthority: STATIC_CORRIDOR_DETAIL_AUTHORITY,
    minimumVisibleTerminalLegMeters: group.userData.minimumVisibleTerminalLegMeters,
    maximumVisibleTerminalLegMeters: group.userData.maximumVisibleTerminalLegMeters,
    maximumTerminalWallRotundaOverlapMeters: group.userData.maximumTerminalWallRotundaOverlapMeters,
    panelRibCount,
    supportStationCount: 0,
  };
}

export { STATIC_SOLID_VESTIBULE_AUTHORITY, STATIC_CORRIDOR_DETAIL_AUTHORITY };