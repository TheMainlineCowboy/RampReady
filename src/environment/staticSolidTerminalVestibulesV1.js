const STATIC_SOLID_VESTIBULE_AUTHORITY = "57-static-short-solid-white-terminal-vestibules-v1";
const VISIBLE_TERMINAL_LEG_METERS = 2.4;
const TERMINAL_HIDDEN_OVERLAP_METERS = 0.70;
const ROTUNDA_SHELL_OVERLAP_METERS = 0.12;
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

function buildShellTransforms(placement) {
  const rotundaX = Number(placement.x);
  const rotundaZ = Number(placement.z);
  const centerY = Number(placement.rotundaY) || 4.1;
  const wallDistance = Number(placement.wallConnectorLength);
  if (![rotundaX, rotundaZ, centerY, wallDistance].every(Number.isFinite)) {
    throw new Error(`Static ${placement.gate} vestibule placement is incomplete`);
  }
  if (Math.abs(wallDistance - 3.98) > 0.01) {
    throw new Error(`Static ${placement.gate} wall distance must remain 3.98 m, received ${wallDistance}`);
  }

  const direction = normalizedTerminalDirection(placement);
  const yaw = Math.atan2(direction.x, direction.z);
  const sideX = Math.cos(yaw);
  const sideZ = -Math.sin(yaw);
  const clearRotundaRadius = wallDistance - VISIBLE_TERMINAL_LEG_METERS;
  const shellStartDistance = clearRotundaRadius - ROTUNDA_SHELL_OVERLAP_METERS;
  const shellLength = VISIBLE_TERMINAL_LEG_METERS + TERMINAL_HIDDEN_OVERLAP_METERS + ROTUNDA_SHELL_OVERLAP_METERS;
  const shellCenterDistance = shellStartDistance + shellLength * 0.5;
  const centerX = rotundaX + direction.x * shellCenterDistance;
  const centerZ = rotundaZ + direction.z * shellCenterDistance;
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
  return transforms;
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
  const transforms = staticPlacements.flatMap(buildShellTransforms);
  const material = new THREE.MeshStandardMaterial({
    name: "Terminal 4 short solid white jetway vestibule shell",
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
  group.userData.visibleTerminalLegMeters = VISIBLE_TERMINAL_LEG_METERS;
  group.userData.terminalHiddenOverlapMeters = TERMINAL_HIDDEN_OVERLAP_METERS;
  group.userData.rotundaShellOverlapMeters = ROTUNDA_SHELL_OVERLAP_METERS;
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
  };
}

export { STATIC_SOLID_VESTIBULE_AUTHORITY };
