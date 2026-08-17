const AUTHORITY = "supplied-a1-full-3d-crj-door-fit-v11";
const SOURCE_PART_NAMES = Object.freeze(["Rotunda", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"]);
const MOVABLE_PART_WEIGHTS = Object.freeze({
  Tunnel_A: 0,
  Tunnel_B: 1 / 3,
  Tunnel_C: 2 / 3,
  Cab: 1,
});

// Measured directly from the exact authored CRJ. The visible forward entry
// door extends down as an integrated airstair, but the passenger-cabin threshold
// where a jetway hood meets the fuselage is approximately 2.52 m above grade.
const CRJ_FORWARD_LEFT_DOOR = Object.freeze({
  x: -1.35,
  centerY: 3.10,
  sillY: 2.52,
  z: 2.22,
});
const CONTACT_BAND_METERS = 0.22;
const CAB_HINGE_BAND_METERS = 0.35;
const MAX_CAB_NORMAL_ERROR_DEGREES = 2;
const MAX_CAB_FUSELAGE_PENETRATION_METERS = 0.3;
const GROUND_CLEARANCE_METERS = 0.06;

function clamp(value, minimum, maximum) {
  return Math.max(minimum, Math.min(maximum, Number(value) || 0));
}

function findSourceRootNode(model) {
  return model?.getObjectByName?.("RootNode") || null;
}

function findSourcePartRoot(model, name) {
  const root = findSourceRootNode(model);
  return root?.children?.find((entry) => entry.name === name) || null;
}

function collectModelLocalVertices(THREE, model, object) {
  // Freeze one coherent world-matrix snapshot. Calling localToWorld per vertex
  // updates ancestors lazily and can mix a stale model inverse with a fresh
  // anchor transform, injecting the gate position into model-local measurements.
  model.updateWorldMatrix(true, true);
  const modelInverse = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const vertex = new THREE.Vector3();
  const values = [];
  object.traverse((entry) => {
    if (!entry.isMesh || entry.visible === false) return;
    const position = entry.geometry?.getAttribute?.("position");
    if (!position) return;
    for (let index = 0; index < position.count; index += 1) {
      vertex.fromBufferAttribute(position, index);
      vertex.applyMatrix4(entry.matrixWorld);
      vertex.applyMatrix4(modelInverse);
      values.push(vertex.clone());
    }
  });
  if (!values.length) throw new Error(`Supplied jetway object ${object.name || "unnamed"} has no measurable vertices`);
  return values;
}

function measureBounds(THREE, model, object) {
  const vertices = collectModelLocalVertices(THREE, model, object);
  const box = new THREE.Box3();
  for (const vertex of vertices) box.expandByPoint(vertex);
  return { vertices, box };
}

function measureCabFace(THREE, model, cab, facingDirection, front, bandMeters) {
  const vertices = collectModelLocalVertices(THREE, model, cab);
  const direction = facingDirection.clone().normalize();
  let extreme = front ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY;
  for (const vertex of vertices) {
    const projection = vertex.dot(direction);
    extreme = front ? Math.max(extreme, projection) : Math.min(extreme, projection);
  }
  const selected = vertices.filter((vertex) => {
    const projection = vertex.dot(direction);
    return front
      ? projection >= extreme - bandMeters
      : projection <= extreme + bandMeters;
  });
  if (selected.length < 4) {
    throw new Error(`Supplied A1 cab ${front ? "contact" : "hinge"} plane has only ${selected.length} vertices`);
  }

  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const vertex of selected) {
    box.expandByPoint(vertex);
    point.x += vertex.x;
    point.z += vertex.z;
  }
  point.x /= selected.length;
  point.z /= selected.length;
  point.y = box.min.y;

  // The selected band exists only to make the face measurement robust against
  // sparse/rounded hood topology. Its centroid can sit well behind the actual
  // contact plane (about 0.16 m on the supplied Cab), which falsely reports a
  // horizontal door gap even when the outer hood face is already at the door.
  // Preserve the stable lateral centroid/floor height but project the reported
  // point onto the measured extreme face plane itself. This changes no geometry.
  const centroidProjection = point.dot(direction);
  point.addScaledVector(direction, extreme - centroidProjection);

  return {
    point,
    centerY: (box.min.y + box.max.y) / 2,
    floorY: box.min.y,
    topY: box.max.y,
    box,
    vertices: selected,
    extremeProjection: extreme,
  };
}

function measureCabAssembly(THREE, model, facingDirection) {
  const cab = findSourcePartRoot(model, "Cab");
  if (!cab) throw new Error("Supplied A1 jetway is missing Cab");
  const direction = facingDirection.clone().setY(0).normalize();
  const front = measureCabFace(THREE, model, cab, direction, true, CONTACT_BAND_METERS);
  const rear = measureCabFace(THREE, model, cab, direction, false, CAB_HINGE_BAND_METERS);
  const frontOffset = front.point.clone().sub(rear.point);
  const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
  let minimumAcross = Number.POSITIVE_INFINITY;
  let maximumAcross = Number.NEGATIVE_INFINITY;
  for (const vertex of front.vertices) {
    const across = vertex.dot(perpendicular);
    minimumAcross = Math.min(minimumAcross, across);
    maximumAcross = Math.max(maximumAcross, across);
  }
  return {
    cab,
    direction,
    front,
    rear,
    frontOffset,
    contactWidth: maximumAcross - minimumAcross,
  };
}

function applyModelSpaceMatrix(THREE, model, object, correction) {
  model.updateWorldMatrix(true, true);
  const modelInverse = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const objectInModel = new THREE.Matrix4().multiplyMatrices(modelInverse, object.matrixWorld);
  const parentInModel = new THREE.Matrix4().multiplyMatrices(modelInverse, object.parent.matrixWorld);
  const correctedInModel = new THREE.Matrix4().multiplyMatrices(correction, objectInModel);
  const local = new THREE.Matrix4().multiplyMatrices(parentInModel.clone().invert(), correctedInModel);
  local.decompose(object.position, object.quaternion, object.scale);
  object.updateMatrix();
  model.updateWorldMatrix(true, true);
}

function translationMatrix(THREE, x, y, z) {
  return new THREE.Matrix4().makeTranslation(x, y, z);
}

function pitchAround(THREE, pivotY, pivotZ, radians) {
  const toPivot = new THREE.Matrix4().makeTranslation(0, pivotY, pivotZ);
  const pitch = new THREE.Matrix4().makeRotationX(radians);
  const fromPivot = new THREE.Matrix4().makeTranslation(0, -pivotY, -pivotZ);
  return new THREE.Matrix4().multiplyMatrices(toPivot, pitch).multiply(fromPivot);
}

function yawAround(THREE, pivotX, pivotZ, radians) {
  const toPivot = new THREE.Matrix4().makeTranslation(pivotX, 0, pivotZ);
  const yaw = new THREE.Matrix4().makeRotationY(radians);
  const fromPivot = new THREE.Matrix4().makeTranslation(-pivotX, 0, -pivotZ);
  return new THREE.Matrix4().multiplyMatrices(toPivot, yaw).multiply(fromPivot);
}

function solvePitchRadians({ floorY, floorZ, pivotY, pivotZ, targetY }) {
  let low = 0;
  let high = Math.PI / 10;
  for (let iteration = 0; iteration < 48; iteration += 1) {
    const angle = (low + high) / 2;
    const projectedY = pivotY
      + (floorY - pivotY) * Math.cos(angle)
      - (floorZ - pivotZ) * Math.sin(angle);
    if (projectedY > targetY) low = angle;
    else high = angle;
  }
  return (low + high) / 2;
}

function correctGroundedDetail(THREE, model, object) {
  if (!object) return { corrected: false, minimumY: NaN, maximumY: NaN };
  const before = measureBounds(THREE, model, object).box;
  if (before.min.y >= GROUND_CLEARANCE_METERS) {
    return { corrected: false, minimumY: before.min.y, maximumY: before.max.y };
  }

  // Tunnel C's stair and bogie are exact triangle subsets of the supplied mesh,
  // not independent authored articulation nodes. A small rigid vertical adjustment
  // preserves every supplied vertex, material split and silhouette while placing
  // the lowest source triangle at the pavement clearance plane.
  const rigidVerticalAdjustmentMeters = GROUND_CLEARANCE_METERS - before.min.y;
  applyModelSpaceMatrix(
    THREE,
    model,
    object,
    translationMatrix(THREE, 0, rigidVerticalAdjustmentMeters, 0),
  );
  const after = measureBounds(THREE, model, object).box;
  return {
    corrected: true,
    minimumY: after.min.y,
    maximumY: after.max.y,
    rigidVerticalAdjustmentMeters,
  };
}

function restoreUnarticulatedSource(model) {
  for (const name of SOURCE_PART_NAMES) {
    const part = findSourcePartRoot(model, name);
    if (!part) throw new Error(`Supplied A1 jetway is missing ${name}`);
    const priorOffset = Number(part.userData.uploadedJetwayArticulationOffsetMeters || 0);
    if (priorOffset) part.position.z -= priorOffset;
    part.userData.uploadedJetwayArticulationOffsetMeters = 0;
  }
  model.updateMatrixWorld(true);
}

function measureRotundaCenter(THREE, model) {
  const rotunda = findSourcePartRoot(model, "Rotunda");
  if (!rotunda) throw new Error("Supplied A1 jetway is missing Rotunda");
  return measureBounds(THREE, model, rotunda).box.getCenter(new THREE.Vector3());
}

function applyWeightedLongitudinalExtension(THREE, model, extension) {
  for (const [name, weight] of Object.entries(MOVABLE_PART_WEIGHTS)) {
    if (!weight) continue;
    const part = findSourcePartRoot(model, name);
    const offset = extension * weight;
    part.position.z += offset;
    part.userData.uploadedJetwayArticulationOffsetMeters = offset;
    part.userData.uploadedJetwayArticulationAuthority = AUTHORITY;
  }
  model.updateMatrixWorld(true);
}

function applyPitchToTunnels(THREE, model, radians, pivotY, pivotZ) {
  const correction = pitchAround(THREE, pivotY, pivotZ, radians);
  // The passenger cab remains level while the telescoping tunnels slope to it.
  // This matches real jetway articulation and avoids pitching the hood across the
  // aircraft roof.
  for (const name of ["Tunnel_A", "Tunnel_B", "Tunnel_C"]) {
    const part = findSourcePartRoot(model, name);
    applyModelSpaceMatrix(THREE, model, part, correction);
    part.userData.uploadedJetwayPitchRadians = radians;
  }
}

function toWorldTarget(THREE, group) {
  return group.localToWorld(new THREE.Vector3(
    CRJ_FORWARD_LEFT_DOOR.x,
    CRJ_FORWARD_LEFT_DOOR.sillY,
    CRJ_FORWARD_LEFT_DOOR.z,
  ));
}

function angleFromPositiveZ(vector) {
  return Math.atan2(vector.x, vector.z);
}

function transformDirectionToParent(THREE, sourceObject, localDirection, parent) {
  sourceObject.updateWorldMatrix(true, false);
  parent.updateWorldMatrix(true, false);
  const worldOrigin = sourceObject.localToWorld(new THREE.Vector3());
  const worldPoint = sourceObject.localToWorld(localDirection.clone());
  const parentOrigin = parent.worldToLocal(worldOrigin);
  const parentPoint = parent.worldToLocal(worldPoint);
  return parentPoint.sub(parentOrigin).setY(0).normalize();
}

export function fitUploadedA1JetwayToRenderedCrjDoor(THREE, group, fleet, placements) {
  const placement = placements.find((entry) => entry.gate === "A1");
  const anchor = fleet?.getObjectByName?.("UploadedAirportJetway_A1");
  const model = anchor?.getObjectByName?.("UploadedAirportJetwayModel_A1");
  if (!placement || !anchor || !model) throw new Error("Supplied A1 3D door fit is missing placement, anchor, or model");

  restoreUnarticulatedSource(model);
  const rotundaCenter = measureRotundaCenter(THREE, model);
  // Keep every authored RootNode transform untouched. The decoded prototype is
  // an aligned outer group, so center that direct anchor child on the measured
  // Rotunda instead of translating the archive hierarchy in the wrong frame.
  model.position.x -= rotundaCenter.x;
  model.position.z -= rotundaCenter.z;
  model.updateMatrix();
  model.updateMatrixWorld(true);

  const cabBounds = measureBounds(THREE, model, findSourcePartRoot(model, "Cab")).box;
  const cabCenter = cabBounds.getCenter(new THREE.Vector3());
  const sourceFacingDirection = new THREE.Vector3(
    cabCenter.x - rotundaCenter.x,
    0,
    cabCenter.z - rotundaCenter.z,
  ).normalize();
  const sourceCab = measureCabAssembly(THREE, model, sourceFacingDirection);

  const targetWorld = toWorldTarget(THREE, group);
  anchor.parent.updateWorldMatrix(true, false);
  const targetInParent = anchor.parent.worldToLocal(targetWorld.clone());
  const desiredFacingDirection = transformDirectionToParent(
    THREE,
    group,
    new THREE.Vector3(1, 0, 0),
    anchor.parent,
  );
  const sourceCabDirectionAngle = angleFromPositiveZ(sourceCab.frontOffset);
  const desiredCabDirectionAngle = angleFromPositiveZ(desiredFacingDirection);
  const absoluteCabRotation = desiredCabDirectionAngle - sourceCabDirectionAngle;
  const desiredFrontOffset = sourceCab.frontOffset.clone().setY(0)
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), absoluteCabRotation);
  const desiredHingeInParent = targetInParent.clone().sub(desiredFrontOffset);
  const desiredHingeFromAnchor = desiredHingeInParent.clone().sub(anchor.position).setY(0);

  const sourceHingeFromAnchor = new THREE.Vector3(
    sourceCab.rear.point.x - rotundaCenter.x,
    0,
    sourceCab.rear.point.z - rotundaCenter.z,
  );
  const targetHingeRadius = Math.hypot(desiredHingeFromAnchor.x, desiredHingeFromAnchor.z);
  const extensionRadicand = targetHingeRadius ** 2 - sourceHingeFromAnchor.x ** 2;
  if (!(extensionRadicand > 0.01)) {
    throw new Error(`Supplied A1 cab hinge cannot reach the aircraft door: radius=${targetHingeRadius}`);
  }
  const correctedHingeZ = Math.sign(sourceHingeFromAnchor.z || 1) * Math.sqrt(extensionRadicand);
  const extension = correctedHingeZ - sourceHingeFromAnchor.z;
  if (!(extension > -8 && extension < 8)) {
    throw new Error(`Supplied A1 corrected hinge extension is outside the physical range: ${extension}`);
  }
  applyWeightedLongitudinalExtension(THREE, model, extension);

  let cabAssembly = measureCabAssembly(THREE, model, sourceFacingDirection);
  const extendedHingeFromAnchor = new THREE.Vector3(
    cabAssembly.rear.point.x - rotundaCenter.x,
    0,
    cabAssembly.rear.point.z - rotundaCenter.z,
  );
  const correctedYawRadians = angleFromPositiveZ(desiredHingeFromAnchor)
    - angleFromPositiveZ(extendedHingeFromAnchor);
  const cabRelativeYawRadians = desiredCabDirectionAngle
    - correctedYawRadians
    - sourceCabDirectionAngle;
  applyModelSpaceMatrix(
    THREE,
    model,
    cabAssembly.cab,
    yawAround(
      THREE,
      cabAssembly.rear.point.x,
      cabAssembly.rear.point.z,
      cabRelativeYawRadians,
    ),
  );
  const cabFacingDirection = sourceFacingDirection.clone()
    .applyAxisAngle(new THREE.Vector3(0, 1, 0), cabRelativeYawRadians)
    .setY(0)
    .normalize();
  cabAssembly = measureCabAssembly(THREE, model, cabFacingDirection);

  const targetYInAnchor = targetInParent.y - anchor.position.y;
  const pitchRadians = solvePitchRadians({
    floorY: cabAssembly.front.floorY,
    floorZ: cabAssembly.front.point.z,
    pivotY: rotundaCenter.y,
    pivotZ: rotundaCenter.z,
    targetY: targetYInAnchor,
  });
  if (!(pitchRadians > 0.02 && pitchRadians < 0.14)) {
    throw new Error(`Supplied A1 corrected pitch is outside the physical range: ${pitchRadians}`);
  }
  applyPitchToTunnels(THREE, model, pitchRadians, rotundaCenter.y, rotundaCenter.z);

  // Keep the cab level and place its threshold exactly at the cabin sill. The
  // tunnel end slopes down to this level; the cab itself does not lean across the
  // fuselage like the previous one-point fit did.
  const cabVerticalAdjustment = targetYInAnchor - cabAssembly.front.floorY;
  applyModelSpaceMatrix(
    THREE,
    model,
    cabAssembly.cab,
    translationMatrix(THREE, 0, cabVerticalAdjustment, 0),
  );

  const stair = model.getObjectByName("Tunnel_C_GalvanizedServiceStair_SourceTriangles");
  const mechanical = model.getObjectByName("Tunnel_C_DarkBogieLift_SourceTriangles");
  const stairGrounding = correctGroundedDetail(THREE, model, stair);
  const mechanicalGrounding = correctGroundedDetail(THREE, model, mechanical);

  anchor.rotation.y = correctedYawRadians;
  anchor.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  cabAssembly = measureCabAssembly(THREE, model, cabFacingDirection);

  const actualWorld = model.localToWorld(cabAssembly.front.point.clone());
  const vectorGap = actualWorld.distanceTo(targetWorld);
  const horizontalGap = Math.hypot(actualWorld.x - targetWorld.x, actualWorld.z - targetWorld.z);
  const verticalGap = Math.abs(actualWorld.y - targetWorld.y);

  group.updateWorldMatrix(true, false);
  const desiredCabNormalWorld = new THREE.Vector3(1, 0, 0).transformDirection(group.matrixWorld);
  const actualCabNormalWorld = cabFacingDirection.clone().transformDirection(model.matrixWorld);
  const cabNormalErrorDegrees = THREE.MathUtils.radToDeg(actualCabNormalWorld.angleTo(desiredCabNormalWorld));
  const cabVertices = collectModelLocalVertices(THREE, model, cabAssembly.cab);
  let cabFuselagePenetrationMeters = Number.NEGATIVE_INFINITY;
  for (const vertex of cabVertices) {
    const worldVertex = model.localToWorld(vertex.clone());
    const penetration = worldVertex.sub(targetWorld).dot(desiredCabNormalWorld);
    cabFuselagePenetrationMeters = Math.max(cabFuselagePenetrationMeters, penetration);
  }

  if (
    vectorGap > 0.12
    || horizontalGap > 0.08
    || verticalGap > 0.08
    || cabNormalErrorDegrees > MAX_CAB_NORMAL_ERROR_DEGREES
    || cabFuselagePenetrationMeters > MAX_CAB_FUSELAGE_PENETRATION_METERS
  ) {
    throw new Error(
      `Supplied A1 full-cab door fit failed: vector=${vectorGap}, horizontal=${horizontalGap}, vertical=${verticalGap}; `
      + `normalError=${cabNormalErrorDegrees}; penetration=${cabFuselagePenetrationMeters}; `
      + `target=${targetWorld.toArray().join(",")}; actual=${actualWorld.toArray().join(",")}; `
      + `anchor=${anchor.position.toArray().join(",")}; yaw=${anchor.rotation.y}; cabYaw=${cabRelativeYawRadians}`,
    );
  }

  const result = Object.freeze({
    authority: AUTHORITY,
    targetWorld: targetWorld.toArray(),
    actualWorld: actualWorld.toArray(),
    extensionMeters: extension,
    parentYawDegrees: THREE.MathUtils.radToDeg(correctedYawRadians),
    cabRelativeYawDegrees: THREE.MathUtils.radToDeg(cabRelativeYawRadians),
    pitchDegrees: THREE.MathUtils.radToDeg(pitchRadians),
    cabVerticalAdjustmentMeters: cabVerticalAdjustment,
    vectorGapMeters: vectorGap,
    horizontalGapMeters: horizontalGap,
    verticalGapMeters: verticalGap,
    cabNormalErrorDegrees,
    cabFuselagePenetrationMeters,
    contactWidthMeters: cabAssembly.contactWidth,
    stairGrounding,
    mechanicalGrounding,
  });
  group.userData.uploadedJetwayA1DoorFitAuthority = AUTHORITY;
  group.userData.uploadedJetwayA1DoorFitVectorGapMeters = vectorGap;
  group.userData.uploadedJetwayA1DoorFitHorizontalGapMeters = horizontalGap;
  group.userData.uploadedJetwayA1DoorFitVerticalGapMeters = verticalGap;
  group.userData.uploadedJetwayA1DoorFitCabNormalErrorDegrees = cabNormalErrorDegrees;
  group.userData.uploadedJetwayA1DoorFitCabFuselagePenetrationMeters = cabFuselagePenetrationMeters;
  group.userData.uploadedJetwayA1DoorFitContactWidthMeters = cabAssembly.contactWidth;
  return result;
}
