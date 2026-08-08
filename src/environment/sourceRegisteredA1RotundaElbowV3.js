const SOURCE_REGISTERED_A1_ELBOW_AUTHORITY = "photo-registered-a1-fixed-wall-rotunda-source-door-target-elbow-v3";
const TARGET_DIRECTION_AUTHORITY = "source-a1-door-target-owns-aircraft-side-bridge-heading-v1";
const CONNECTOR_AUTHORITY = "real-terminal-fixed-rotunda-independent-aircraft-side-elbow-v3";
const CONNECTOR_STYLE_AUTHORITY = "same-day-a1-photo-compact-solid-terminal-leg-fixed-wall-v4-authored-rotunda-surface";
const TERMINAL_HIDDEN_OVERLAP_METERS = 0.18;
const ROTUNDA_SHELL_OVERLAP_METERS = 0.10;
const MINIMUM_CORNER_ANGLE_DEGREES = 45;
const MAXIMUM_CORNER_ANGLE_DEGREES = 150;
const MINIMUM_VISIBLE_TERMINAL_LEG_METERS = 1.2;
const MAXIMUM_VISIBLE_TERMINAL_LEG_METERS = 3.6;

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
  if (vertices.length < 100) throw new Error(`A1 ${object?.name || "object"} exposes too few exact vertices: ${vertices.length}`);
  return vertices;
}

function endpointBandCenter(THREE, vertices, origin, direction, bandMeters = 0.16) {
  let maximumProjection = Number.NEGATIVE_INFINITY;
  for (const vertex of vertices) maximumProjection = Math.max(maximumProjection, vertex.clone().sub(origin).dot(direction));
  const selected = vertices.filter((vertex) => maximumProjection - vertex.clone().sub(origin).dot(direction) <= bandMeters);
  if (selected.length < 3) throw new Error("A1 Cab endpoint band is empty");
  const center = new THREE.Vector3();
  for (const vertex of selected) center.add(vertex);
  return center.multiplyScalar(1 / selected.length);
}

function projectedSurfaceDistance(vertices, origin, direction) {
  let maximumProjection = Number.NEGATIVE_INFINITY;
  for (const vertex of vertices) {
    maximumProjection = Math.max(maximumProjection, vertex.clone().sub(origin).dot(direction));
  }
  return maximumProjection;
}

function createMaterials(THREE) {
  return {
    shell: new THREE.MeshStandardMaterial({
      name: "A1 fixed-wall compact terminal-side shell",
      color: 0xe1e2df,
      roughness: 0.78,
      metalness: 0.08,
      side: THREE.DoubleSide,
    }),
    rib: new THREE.MeshStandardMaterial({
      name: "A1 fixed-wall terminal-side panel seams",
      color: 0xd9dbd8,
      roughness: 0.84,
      metalness: 0.06,
      side: THREE.DoubleSide,
    }),
    bellows: new THREE.MeshStandardMaterial({
      name: "A1 fixed-wall Rotunda collar bellows",
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
  addBox(THREE, parent, materials.shell, "UploadedAirportJetwayA1TerminalElbowRoof", [width, 0.14, length], center.clone().add(new THREE.Vector3(0, height * 0.5, 0)), yaw);
  addBox(THREE, parent, materials.shell, "UploadedAirportJetwayA1TerminalElbowFloor", [width, 0.12, length], center.clone().add(new THREE.Vector3(0, -height * 0.5, 0)), yaw);
  for (const sign of [-1, 1]) {
    addBox(
      THREE,
      parent,
      materials.shell,
      `UploadedAirportJetwayA1TerminalElbowWall_${sign}`,
      [0.10, height, length],
      center.clone().addScaledVector(side, sign * halfWidth),
      yaw,
    );
  }
  let ribCount = 0;
  for (let distance = 0.36; distance < length - 0.2; distance += 0.52) {
    const ribCenter = start.clone().addScaledVector(direction, distance);
    ribCenter.y = centerY;
    for (const sign of [-1, 1]) {
      addBox(
        THREE,
        parent,
        materials.rib,
        `UploadedAirportJetwayA1TerminalElbowRib_${ribCount}_${sign}`,
        [0.035, height * 0.92, 0.04],
        ribCenter.clone().addScaledVector(side, sign * (halfWidth + 0.018)),
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
  const depth = 0.14;
  addBox(THREE, parent, materials.bellows, "UploadedAirportJetwayA1TerminalElbowBellowsHeader", [width + 0.04, 0.16, depth], center.clone().add(new THREE.Vector3(0, height * 0.5, 0)), yaw);
  addBox(THREE, parent, materials.bellows, "UploadedAirportJetwayA1TerminalElbowBellowsThreshold", [width + 0.04, 0.14, depth], center.clone().add(new THREE.Vector3(0, -height * 0.5, 0)), yaw);
  for (const sign of [-1, 1]) {
    addBox(
      THREE,
      parent,
      materials.bellows,
      `UploadedAirportJetwayA1TerminalElbowBellowsJamb_${sign}`,
      [0.11, height, depth],
      center.clone().addScaledVector(side, sign * (halfWidth + 0.008)),
      yaw,
    );
  }
}

function wrappedAngle(THREE, radians) {
  return THREE.MathUtils.euclideanModulo(radians + Math.PI, Math.PI * 2) - Math.PI;
}

export function enforceSourceRegisteredA1RotundaElbow(THREE, group, fleet, placements) {
  if (!group?.isGroup || !fleet?.isGroup || !Array.isArray(placements)) {
    throw new Error("A1 fixed-wall Rotunda elbow requires Terminal 4 group, exact fleet and placements");
  }
  const placement = placements.find((entry) => entry.gate === "A1");
  const anchor = fleet.getObjectByName("UploadedAirportJetway_A1");
  const model = anchor?.getObjectByName("UploadedAirportJetwayModel_A1");
  const rotunda = model?.getObjectByName("Rotunda") || model?.getObjectByName("Rotunda_Jetway_0");
  const tunnelA = model?.getObjectByName("Tunnel_A") || model?.getObjectByName("Tunnel_A_Jetway_0");
  const cab = model?.getObjectByName("Cab") || model?.getObjectByName("Cab_Jetway_0");
  if (!placement || !anchor || !model || !rotunda || !tunnelA || !cab) {
    throw new Error("A1 fixed-wall Rotunda elbow could not resolve placement/anchor/Rotunda/Tunnel A/Cab");
  }

  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  const fixedRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  const terminalDirectionRaw = group.userData.uploadedJetwayA1TerminalConnectionDirection || [];
  const terminalDirection = new THREE.Vector3(Number(terminalDirectionRaw[0]), 0, Number(terminalDirectionRaw[1]));
  const terminalWallDistance = Number(group.userData.uploadedJetwayA1TerminalWallDistanceMeters);
  if (terminalDirection.lengthSq() < 0.5 || !(terminalWallDistance >= 2.9 && terminalWallDistance <= 5.8)) {
    throw new Error(`A1 fixed-wall evidence is invalid: direction=${terminalDirectionRaw.join(",")}, distance=${terminalWallDistance}`);
  }
  terminalDirection.normalize();
  const fixedWallPoint = fixedRotundaCenter.clone().addScaledVector(terminalDirection, terminalWallDistance);
  fixedWallPoint.y = fixedRotundaCenter.y;

  const targetPoint = new THREE.Vector3(Number(placement.targetX), fixedRotundaCenter.y, Number(placement.targetZ));
  if (![targetPoint.x, targetPoint.z].every(Number.isFinite)) throw new Error("A1 source parking door target is missing");
  const targetDirection = targetPoint.clone().sub(fixedRotundaCenter);
  targetDirection.y = 0;
  const targetDistance = targetDirection.length();
  if (!(targetDistance > 15 && targetDistance < 45)) throw new Error(`A1 source door target distance is invalid: ${targetDistance}`);
  targetDirection.normalize();

  const tunnelCenterBefore = objectCenterInFleet(THREE, fleet, tunnelA);
  const bridgeDirectionBefore = tunnelCenterBefore.clone().sub(fixedRotundaCenter);
  bridgeDirectionBefore.y = 0;
  if (bridgeDirectionBefore.lengthSq() < 0.25) throw new Error("A1 exact bridge axis is degenerate before source-target pivot");
  bridgeDirectionBefore.normalize();
  const currentHeading = Math.atan2(bridgeDirectionBefore.x, bridgeDirectionBefore.z);
  const targetHeading = Math.atan2(targetDirection.x, targetDirection.z);
  const yawDelta = wrappedAngle(THREE, targetHeading - currentHeading);
  anchor.rotation.y += yawDelta;
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  const rotatedRotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  anchor.position.x += fixedRotundaCenter.x - rotatedRotundaCenter.x;
  anchor.position.z += fixedRotundaCenter.z - rotatedRotundaCenter.z;
  anchor.updateMatrix();
  group.updateWorldMatrix(true, true);
  fleet.updateWorldMatrix(true, true);
  model.updateWorldMatrix(true, true);

  const rotundaCenter = objectCenterInFleet(THREE, fleet, rotunda);
  const rotundaPreservationErrorMeters = Math.hypot(rotundaCenter.x - fixedRotundaCenter.x, rotundaCenter.z - fixedRotundaCenter.z);
  if (rotundaPreservationErrorMeters > 1e-6) throw new Error(`A1 real-wall Rotunda moved during aircraft-side pivot: ${rotundaPreservationErrorMeters}`);

  const tunnelCenterAfter = objectCenterInFleet(THREE, fleet, tunnelA);
  const bridgeDirection = tunnelCenterAfter.clone().sub(rotundaCenter);
  bridgeDirection.y = 0;
  bridgeDirection.normalize();
  const targetAlignmentCosine = bridgeDirection.dot(targetDirection);
  if (targetAlignmentCosine < 0.99999) throw new Error(`A1 supplied bridge does not point at the source A1 door target: ${targetAlignmentCosine}`);

  const cornerDot = THREE.MathUtils.clamp(terminalDirection.dot(bridgeDirection), -1, 1);
  const cornerAngleDegrees = THREE.MathUtils.radToDeg(Math.acos(cornerDot));
  if (!(cornerAngleDegrees >= MINIMUM_CORNER_ANGLE_DEGREES && cornerAngleDegrees <= MAXIMUM_CORNER_ANGLE_DEGREES)) {
    throw new Error(`A1 fixed-wall Rotunda did not produce the required visible elbow: ${cornerAngleDegrees.toFixed(3)} degrees`);
  }

  // Derive the terminal-side interface from the transformed authored Rotunda
  // itself. The generated vestibule is allowed to overlap the real Rotunda only
  // by a shallow seal; it must never invent a collar radius from wall distance.
  const rotundaVertices = collectObjectVerticesInFleet(THREE, fleet, rotunda);
  const rotundaTerminalSurfaceMeters = projectedSurfaceDistance(rotundaVertices, rotundaCenter, terminalDirection);
  if (!(rotundaTerminalSurfaceMeters > 0.7 && rotundaTerminalSurfaceMeters < 3.4)) {
    throw new Error(`A1 authored Rotunda terminal-facing radius is invalid: ${rotundaTerminalSurfaceMeters}`);
  }
  const rotundaSurfacePoint = rotundaCenter.clone().addScaledVector(terminalDirection, rotundaTerminalSurfaceMeters);
  rotundaSurfacePoint.y = rotundaCenter.y;
  const visibleTerminalLegMeters = fixedWallPoint.distanceTo(rotundaSurfacePoint);
  if (!(visibleTerminalLegMeters >= MINIMUM_VISIBLE_TERMINAL_LEG_METERS && visibleTerminalLegMeters <= MAXIMUM_VISIBLE_TERMINAL_LEG_METERS)) {
    throw new Error(`A1 authored wall-to-Rotunda visible vestibule is not compact: ${visibleTerminalLegMeters}`);
  }

  const terminalToRotunda = terminalDirection.clone().multiplyScalar(-1);
  const shellStart = fixedWallPoint.clone().addScaledVector(terminalDirection, TERMINAL_HIDDEN_OVERLAP_METERS);
  const shellEnd = rotundaSurfacePoint.clone().addScaledVector(terminalToRotunda, ROTUNDA_SHELL_OVERLAP_METERS);
  const shellVector = shellEnd.clone().sub(shellStart);
  shellVector.y = 0;
  const shellLength = shellVector.length();
  shellVector.normalize();

  const removedGeneratedTerminalObjects = removeGeneratedA1TerminalGeometry(fleet);
  const connector = new THREE.Group();
  connector.name = "UploadedAirportJetwayTerminalConnector_A1";
  const materials = createMaterials(THREE);
  const width = 2.58;
  const height = 2.44;
  const frame = addContinuousShell(THREE, connector, materials, shellStart, shellVector, shellLength, rotundaCenter.y, width, height);
  addCompactRotundaBellows(THREE, connector, materials, rotundaSurfacePoint.clone().addScaledVector(terminalToRotunda, 0.03), terminalToRotunda, width, height);
  connector.userData.authority = CONNECTOR_AUTHORITY;
  connector.userData.connectorStyleAuthority = CONNECTOR_STYLE_AUTHORITY;
  connector.userData.fixedRealTerminalWall = true;
  connector.userData.terminalSideIndependentFromTunnelAxis = true;
  connector.userData.visibleLengthMeters = visibleTerminalLegMeters;
  connector.userData.rotundaTerminalSurfaceMeters = rotundaTerminalSurfaceMeters;
  connector.userData.terminalCornerAngleDegrees = cornerAngleDegrees;
  connector.userData.corrugationRibCount = frame.ribCount;
  connector.userData.passengerPassageCrossSectionBlocked = false;
  connector.userData.apronFacingOpenAreaMeters = 0;
  fleet.add(connector);

  const cabVertices = collectObjectVerticesInFleet(THREE, fleet, cab);
  const cabContact = endpointBandCenter(THREE, cabVertices, rotundaCenter, bridgeDirection);
  const cabTargetHorizontalErrorMeters = Math.hypot(cabContact.x - targetPoint.x, cabContact.z - targetPoint.z);
  const cabDirection = cabContact.clone().sub(rotundaCenter);
  cabDirection.y = 0;
  const rotundaToCabMeters = cabDirection.length();
  cabDirection.normalize();

  group.userData.uploadedJetwayA1SourceLockedElbowAuthority = SOURCE_REGISTERED_A1_ELBOW_AUTHORITY;
  group.userData.uploadedJetwayA1TargetDirectionAuthority = TARGET_DIRECTION_AUTHORITY;
  group.userData.uploadedJetwayA1TargetAlignmentCosine = targetAlignmentCosine;
  group.userData.uploadedJetwayA1SourceDoorTargetX = targetPoint.x;
  group.userData.uploadedJetwayA1SourceDoorTargetZ = targetPoint.z;
  group.userData.uploadedJetwayA1SourceDoorTargetDistanceMeters = targetDistance;
  group.userData.uploadedJetwayA1RotundaPreservationErrorMeters = rotundaPreservationErrorMeters;
  group.userData.uploadedJetwayA1TerminalCornerAngleDegrees = cornerAngleDegrees;
  group.userData.uploadedJetwayA1VisibleVestibuleLengthMeters = visibleTerminalLegMeters;
  group.userData.uploadedJetwayA1TerminalWallDistanceMeters = terminalWallDistance;
  group.userData.uploadedJetwayA1TerminalConnectionDirection = [terminalDirection.x, terminalDirection.z];
  group.userData.uploadedJetwayA1SourceLockedRotunda = true;
  group.userData.uploadedJetwayA1TerminalSideIndependentFromTunnelAxis = true;
  group.userData.uploadedJetwayA1PassengerPassageCrossSectionBlocked = false;
  group.userData.uploadedJetwayA1ApronFacingOpenAreaMeters = 0;
  group.userData.uploadedJetwayA1CabTargetHorizontalErrorMeters = cabTargetHorizontalErrorMeters;
  group.userData.uploadedJetwayA1CabContactWorldX = cabContact.x;
  group.userData.uploadedJetwayA1CabContactWorldZ = cabContact.z;
  group.userData.uploadedJetwayA1CabDirectionWorldX = cabDirection.x;
  group.userData.uploadedJetwayA1CabDirectionWorldZ = cabDirection.z;
  group.userData.uploadedJetwayA1RotundaToCabWorldMeters = rotundaToCabMeters;
  group.userData.uploadedJetwayA1ExactRotundaWorldX = rotundaCenter.x;
  group.userData.uploadedJetwayA1ExactRotundaWorldY = rotundaCenter.y;
  group.userData.uploadedJetwayA1ExactRotundaWorldZ = rotundaCenter.z;
  group.userData.uploadedJetwayA1ExactMeasuredWallWorldX = fixedWallPoint.x;
  group.userData.uploadedJetwayA1ExactMeasuredWallWorldY = fixedWallPoint.y;
  group.userData.uploadedJetwayA1ExactMeasuredWallWorldZ = fixedWallPoint.z;
  group.userData.uploadedJetwayA1AuthoredRotundaTerminalSurfaceMeters = rotundaTerminalSurfaceMeters;

  return Object.freeze({
    authority: SOURCE_REGISTERED_A1_ELBOW_AUTHORITY,
    targetDirectionAuthority: TARGET_DIRECTION_AUTHORITY,
    connectorAuthority: CONNECTOR_AUTHORITY,
    connectorStyleAuthority: CONNECTOR_STYLE_AUTHORITY,
    removedGeneratedTerminalObjects,
    yawDeltaRadians: yawDelta,
    targetAlignmentCosine,
    targetDistanceMeters: targetDistance,
    rotundaPreservationErrorMeters,
    terminalWallDistanceMeters: terminalWallDistance,
    visibleTerminalLegMeters,
    rotundaTerminalSurfaceMeters,
    terminalCornerAngleDegrees: cornerAngleDegrees,
    cabTargetHorizontalErrorMeters,
    rotundaToCabMeters,
    corrugationRibCount: frame.ribCount,
  });
}

export {
  SOURCE_REGISTERED_A1_ELBOW_AUTHORITY,
  TARGET_DIRECTION_AUTHORITY as SOURCE_REGISTERED_A1_TARGET_DIRECTION_AUTHORITY,
};
