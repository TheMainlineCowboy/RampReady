const STATIC_SOLID_VESTIBULE_AUTHORITY = "57-static-short-solid-white-terminal-vestibules-v4-registered-facade-authoritative";
const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.2;
const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.6;
const TERMINAL_HIDDEN_OVERLAP_METERS = 0.70;
const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;
const MAXIMUM_TERMINAL_DIRECTION_SKEW_RADIANS = Math.PI / 12;
const WIDTH_METERS = 3.02;
const HEIGHT_METERS = 2.62;

function normalizedTerminalDirection(placement) {
  const x = Number(placement.connectorTowardX);
  const z = Number(placement.connectorTowardZ);
  const magnitude = Math.hypot(x, z);
  if (!(magnitude > 0.95 && magnitude < 1.05)) {
    throw new Error(`Static ${placement.gate} terminal direction is invalid: ${x},${z}`);
  }
  return { x: x / magnitude, z: z / magnitude };
}

function physicalRotundaFromAuthoredOffset(placement) {
  const modelRootX = Number(placement.staticModelRootX ?? placement.x);
  const modelRootZ = Number(placement.staticModelRootZ ?? placement.z);
  const yaw = Number(placement.yaw);
  const authoredOffsetX = Number(placement.staticAuthoredRotundaOffsetX);
  const authoredOffsetZ = Number(placement.staticAuthoredRotundaOffsetZ);
  if (![modelRootX, modelRootZ, yaw, authoredOffsetX, authoredOffsetZ].every(Number.isFinite)) {
    throw new Error(`Static ${placement.gate} authored Rotunda/root evidence is incomplete`);
  }
  const cos = Math.cos(yaw);
  const sin = Math.sin(yaw);
  const rotatedOffsetX = authoredOffsetX * cos + authoredOffsetZ * sin;
  const rotatedOffsetZ = -authoredOffsetX * sin + authoredOffsetZ * cos;
  return {
    modelRootX,
    modelRootZ,
    x: modelRootX + rotatedOffsetX,
    z: modelRootZ + rotatedOffsetZ,
  };
}

function buildShellTransforms(placement) {
  const centerY = Number(placement.rotundaY) || 4.1;
  const clearRotundaRadius = Number(placement.staticAuthoredRotundaRadiusMeters);
  const terminalWallOverlapMeters = Number(placement.staticTerminalWallOverlapMeters) || 0;
  const registeredWallX = Number(placement.staticFacadeWallX);
  const registeredWallZ = Number(placement.staticFacadeWallZ);
  if (![centerY, clearRotundaRadius, terminalWallOverlapMeters, registeredWallX, registeredWallZ].every(Number.isFinite)) {
    throw new Error(`Static ${placement.gate} vestibule placement is incomplete`);
  }
  if (!(clearRotundaRadius > 0.7 && clearRotundaRadius < 3.5)) {
    throw new Error(`Static ${placement.gate} authored Rotunda radius is invalid: ${clearRotundaRadius}`);
  }
  if (!(terminalWallOverlapMeters >= 0 && terminalWallOverlapMeters < clearRotundaRadius)) {
    throw new Error(`Static ${placement.gate} terminal wall/Rotunda overlap is invalid: ${terminalWallOverlapMeters}`);
  }

  const sourceDirection = normalizedTerminalDirection(placement);
  const physicalRotunda = physicalRotundaFromAuthoredOffset(placement);
  const wallX = registeredWallX;
  const wallZ = registeredWallZ;
  const wallDx = wallX - physicalRotunda.x;
  const wallDz = wallZ - physicalRotunda.z;
  const physicalCenterToWallMeters = Math.hypot(wallDx, wallDz);
  if (!(physicalCenterToWallMeters > clearRotundaRadius)) {
    throw new Error(`Static ${placement.gate} physical Rotunda center does not resolve outside the terminal wall: ${physicalCenterToWallMeters}`);
  }

  const visibleTerminalLegMeters = physicalCenterToWallMeters - clearRotundaRadius + terminalWallOverlapMeters;
  if (!(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS)) {
    throw new Error(`Static ${placement.gate} physical visible terminal vestibule is invalid: ${visibleTerminalLegMeters}`);
  }

  const direction = {
    x: wallDx / physicalCenterToWallMeters,
    z: wallDz / physicalCenterToWallMeters,
  };
  const directionDot = Math.max(-1, Math.min(1, direction.x * sourceDirection.x + direction.z * sourceDirection.z));
  const directionSkewRadians = Math.acos(directionDot);
  if (directionSkewRadians > MAXIMUM_TERMINAL_DIRECTION_SKEW_RADIANS) {
    throw new Error(`Static ${placement.gate} registered facade would create a sideways terminal vestibule: ${(directionSkewRadians * 180 / Math.PI).toFixed(2)}deg`);
  }

  // The exact GLB model root remains locked to the decoded BGL pose. The
  // registration pass owns the facade endpoint; rendering consumes that exact
  // endpoint rather than independently manufacturing a second wall solution.
  placement.staticPhysicalRotundaX = physicalRotunda.x;
  placement.staticPhysicalRotundaZ = physicalRotunda.z;
  placement.staticResolvedRotundaCenterToWallMeters = physicalCenterToWallMeters;
  placement.staticVisibleTerminalLegMeters = visibleTerminalLegMeters;
  placement.staticPhysicalRotundaRegistrationErrorMeters = Math.hypot(
    Number(placement.staticPhysicalRotundaX) - physicalRotunda.x,
    Number(placement.staticPhysicalRotundaZ) - physicalRotunda.z,
  );
  placement.staticTerminalDirectionSkewRadians = directionSkewRadians;

  const yaw = Math.atan2(direction.x, direction.z);
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  const shellStartDistance = clearRotundaRadius - ROTUNDA_SHELL_OVERLAP_METERS;
  const shellLength = visibleTerminalLegMeters + TERMINAL_HIDDEN_OVERLAP_METERS + ROTUNDA_SHELL_OVERLAP_METERS;
  if (shellLength > MAXIMUM_VISIBLE_TERMINAL_LEG_METERS + TERMINAL_HIDDEN_OVERLAP_METERS + ROTUNDA_SHELL_OVERLAP_METERS + 1e-6) {
    throw new Error(`Static ${placement.gate} attempted to fabricate a long terminal corridor: ${shellLength}`);
  }
  const shellCenterDistance = shellStartDistance + shellLength * 0.5;
  const centerX = physicalRotunda.x + direction.x * shellCenterDistance;
  const centerZ = physicalRotunda.z + direction.z * shellCenterDistance;
  const halfWidth = WIDTH_METERS * 0.5;

  const transforms = [];
  const push = (position, scale) => transforms.push({ position, yaw, scale });
  push([centerX, centerY + HEIGHT_METERS * 0.5, centerZ], [WIDTH_METERS, 0.16, shellLength]);
  push([centerX, centerY - HEIGHT_METERS * 0.5, centerZ], [WIDTH_METERS, 0.14, shellLength]);
  for (const side of [-1, 1]) {
    push(
      [centerX + sideX * side * halfWidth, centerY, centerZ + sideZ * side * halfWidth],
      [0.13, HEIGHT_METERS, shellLength],
    );
  }
  return {
    transforms,
    visibleTerminalLegMeters,
    terminalWallOverlapMeters,
    wallDistance: physicalCenterToWallMeters,
    directionSkewRadians,
    physicalRotundaX: physicalRotunda.x,
    physicalRotundaZ: physicalRotunda.z,
  };
}

function buildInstancedShellBatch(THREE, material, transforms) {
  const geometry = new THREE.BoxGeometry(1, 1, 1);
  const batch = new THREE.InstancedMesh(geometry, material, transforms.length);
  batch.name = "UploadedAirportJetwayStaticSolidVestibuleShells";
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

export function addStaticSolidTerminalVestibules(THREE, fleet, placements) {
  const staticPlacements = placements.filter((placement) => placement.gate !== "A1");
  if (staticPlacements.length !== 57) {
    throw new Error(`Static solid vestibules expected 57 gates, received ${staticPlacements.length}`);
  }

  const measured = staticPlacements.map(buildShellTransforms);
  const transforms = measured.flatMap((entry) => entry.transforms);
  const visibleLengths = measured.map((entry) => entry.visibleTerminalLegMeters);
  const wallOverlaps = measured.map((entry) => entry.terminalWallOverlapMeters);
  const wallDistances = measured.map((entry) => entry.wallDistance);
  const directionSkews = measured.map((entry) => entry.directionSkewRadians);
  const material = new THREE.MeshStandardMaterial({
    name: "Terminal 4 measured compact solid white jetway vestibule shell",
    color: 0xe1e2df,
    roughness: 0.78,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const group = new THREE.Group();
  group.name = "UploadedAirportJetwayStaticTerminalConnectorBatches";
  group.userData.connectorAuthority = STATIC_SOLID_VESTIBULE_AUTHORITY;
  group.userData.batchAuthority = STATIC_SOLID_VESTIBULE_AUTHORITY;
  group.userData.staticGateCount = 57;
  group.userData.minimumVisibleTerminalLegMeters = Math.min(...visibleLengths);
  group.userData.maximumVisibleTerminalLegMeters = Math.max(...visibleLengths);
  group.userData.minimumTerminalWallRotundaOverlapMeters = Math.min(...wallOverlaps);
  group.userData.maximumTerminalWallRotundaOverlapMeters = Math.max(...wallOverlaps);
  group.userData.minimumRotundaCenterToWallMeters = Math.min(...wallDistances);
  group.userData.maximumRotundaCenterToWallMeters = Math.max(...wallDistances);
  group.userData.maximumTerminalDirectionSkewRadians = Math.max(...directionSkews);
  group.userData.terminalHiddenOverlapMeters = TERMINAL_HIDDEN_OVERLAP_METERS;
  group.userData.rotundaShellOverlapMeters = ROTUNDA_SHELL_OVERLAP_METERS;
  group.userData.perGateMeasuredTerminalVestibules = true;
  group.userData.physicalRotundaFromExactGlbOffset = true;
  group.userData.physicalRotundaMeasurementsAuthoritative = true;
  group.userData.registeredFacadeEndpointAuthoritative = true;
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
    minimumVisibleTerminalLegMeters: group.userData.minimumVisibleTerminalLegMeters,
    maximumVisibleTerminalLegMeters: group.userData.maximumVisibleTerminalLegMeters,
    maximumTerminalWallRotundaOverlapMeters: group.userData.maximumTerminalWallRotundaOverlapMeters,
    maximumTerminalDirectionSkewRadians: group.userData.maximumTerminalDirectionSkewRadians,
  };
}

export { STATIC_SOLID_VESTIBULE_AUTHORITY };