const AUTHORITY = "supplied-a1-full-3d-crj-door-fit-v11";
const SOURCE_PART_NAMES = Object.freeze(["Rotunda", "Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"]);
const MOVABLE_PART_WEIGHTS = Object.freeze({
  Tunnel_A: 0,
  Tunnel_B: 1 / 3,
  Tunnel_C: 2 / 3,
  Cab: 1,
});

// Source parking coordinates are the nose-gear stop. The decoded KPHX A1
// placement already establishes the CRJ forward-left door 6.25 m aft of that
// stop and 1.35 m left of centerline. Keep those airport-scale meters here;
// the prior procedural-door coordinate incorrectly targeted the cockpit/nose.
const CRJ_FORWARD_LEFT_DOOR = Object.freeze({
  x: -1.35,
  centerY: 2.58 * 0.82 * 1.35,
  sillY: (2.58 - 0.92 / 2) * 0.82 * 1.35,
  z: 6.25,
});
const CONTACT_BAND_METERS = 0.22;
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

function measureCabContact(THREE, model, rotundaCenter) {
  const cab = findSourcePartRoot(model, "Cab");
  if (!cab) throw new Error("Supplied A1 jetway is missing Cab");
  const { vertices, box } = measureBounds(THREE, model, cab);
  const cabCenter = box.getCenter(new THREE.Vector3());
  const bridgeDirection = new THREE.Vector3(
    cabCenter.x - rotundaCenter.x,
    0,
    cabCenter.z - rotundaCenter.z,
  );
  if (bridgeDirection.lengthSq() < 0.01) {
    throw new Error("Supplied A1 cab cannot define an aircraft-facing direction from the Rotunda");
  }
  bridgeDirection.normalize();

  // The uploaded Cab keeps its authored node transforms. Its aircraft-facing
  // hood is therefore not guaranteed to be model-local +Z. Select the real
  // outer face by projection away from the measured Rotunda instead of using
  // an arbitrary bounding-box axis that can align an interior/side surface.
  let maximumProjection = Number.NEGATIVE_INFINITY;
  for (const vertex of vertices) {
    maximumProjection = Math.max(
      maximumProjection,
      (vertex.x - rotundaCenter.x) * bridgeDirection.x
        + (vertex.z - rotundaCenter.z) * bridgeDirection.z,
    );
  }
  const contact = vertices.filter((vertex) => {
    const projection = (vertex.x - rotundaCenter.x) * bridgeDirection.x
      + (vertex.z - rotundaCenter.z) * bridgeDirection.z;
    return projection >= maximumProjection - CONTACT_BAND_METERS;
  });
  if (contact.length < 4) throw new Error(`Supplied A1 cab contact plane has only ${contact.length} vertices`);

  const contactBox = new THREE.Box3();
  const point = new THREE.Vector3();
  for (const vertex of contact) {
    contactBox.expandByPoint(vertex);
    point.x += vertex.x;
    point.z += vertex.z;
  }
  point.x /= contact.length;
  point.z /= contact.length;
  point.y = contactBox.min.y;

  const perpendicular = new THREE.Vector3(-bridgeDirection.z, 0, bridgeDirection.x);
  let minimumAcross = Number.POSITIVE_INFINITY;
  let maximumAcross = Number.NEGATIVE_INFINITY;
  for (const vertex of contact) {
    const across = vertex.x * perpendicular.x + vertex.z * perpendicular.z;
    minimumAcross = Math.min(minimumAcross, across);
    maximumAcross = Math.max(maximumAcross, across);
  }
  return {
    cab,
    point,
    centerY: (contactBox.min.y + contactBox.max.y) / 2,
    floorY: contactBox.min.y,
    topY: contactBox.max.y,
    width: maximumAcross - minimumAcross,
    contactBox,
    bridgeDirection,
    maximumProjection,
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
  // not independent authored articulation nodes. Scaling or rotating either
  // subset tears the original assembly apart. A small rigid vertical adjustment
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

function applyPitchToBridge(THREE, model, radians, pivotY, pivotZ) {
  const correction = pitchAround(THREE, pivotY, pivotZ, radians);
  for (const name of ["Tunnel_A", "Tunnel_B", "Tunnel_C", "Cab"]) {
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

  const sourceContact = measureCabContact(THREE, model, rotundaCenter);
  const desiredX = CRJ_FORWARD_LEFT_DOOR.x - placement.x;
  const desiredZ = CRJ_FORWARD_LEFT_DOOR.z - placement.z;
  const desiredRadius = Math.hypot(desiredX, desiredZ);
  const sourceContactOffsetX = sourceContact.point.x - rotundaCenter.x;
  const sourceContactOffsetZ = sourceContact.point.z - rotundaCenter.z;
  const desiredContactOffsetZ = Math.sqrt(Math.max(0.01, desiredRadius ** 2 - sourceContactOffsetX ** 2));
  const extension = desiredContactOffsetZ - sourceContactOffsetZ;
  if (!(extension > -8 && extension < 8)) {
    throw new Error(
      `Supplied A1 corrected extension is outside the physical range: ${extension}; `
      + `targetRadius=${desiredRadius}; sourceOffset=${sourceContactOffsetX},${sourceContactOffsetZ}`,
    );
  }
  applyWeightedLongitudinalExtension(THREE, model, extension);

  let contact = measureCabContact(THREE, model, rotundaCenter);
  const pitchRadians = solvePitchRadians({
    floorY: contact.floorY,
    floorZ: contact.point.z,
    pivotY: placement.rotundaY,
    pivotZ: rotundaCenter.z,
    targetY: CRJ_FORWARD_LEFT_DOOR.sillY,
  });
  if (!(pitchRadians > 0.02 && pitchRadians < 0.14)) {
    throw new Error(`Supplied A1 corrected pitch is outside the physical range: ${pitchRadians}`);
  }
  applyPitchToBridge(THREE, model, pitchRadians, placement.rotundaY, rotundaCenter.z);

  const stair = model.getObjectByName("Tunnel_C_GalvanizedServiceStair_SourceTriangles");
  const mechanical = model.getObjectByName("Tunnel_C_DarkBogieLift_SourceTriangles");
  const stairGrounding = correctGroundedDetail(THREE, model, stair);
  const mechanicalGrounding = correctGroundedDetail(THREE, model, mechanical);

  contact = measureCabContact(THREE, model, rotundaCenter);
  const correctedContactOffsetX = contact.point.x - rotundaCenter.x;
  const correctedContactOffsetZ = Math.sqrt(Math.max(0.01, desiredRadius ** 2 - correctedContactOffsetX ** 2));
  const residualLongitudinal = correctedContactOffsetZ - (contact.point.z - rotundaCenter.z);
  if (Math.abs(residualLongitudinal) > 0.001) {
    const residualCorrection = translationMatrix(THREE, 0, 0, residualLongitudinal);
    for (const name of ["Tunnel_B", "Tunnel_C", "Cab"]) {
      const part = findSourcePartRoot(model, name);
      applyModelSpaceMatrix(THREE, model, part, residualCorrection);
    }
    contact = measureCabContact(THREE, model, rotundaCenter);
  }

  const localDirection = Math.atan2(
    contact.point.x - rotundaCenter.x,
    contact.point.z - rotundaCenter.z,
  );
  const targetDirection = Math.atan2(desiredX, desiredZ);
  anchor.rotation.y = targetDirection - localDirection;
  anchor.updateMatrixWorld(true);
  model.updateMatrixWorld(true);

  contact = measureCabContact(THREE, model, rotundaCenter);
  const targetWorld = toWorldTarget(THREE, group);
  let actualWorld = model.localToWorld(contact.point.clone());
  let postFitYawCorrection = 0;
  // Resolve the final azimuth from what Three.js actually placed in the anchor's
  // parent frame. This accounts for every retained source-node transform and
  // keeps the rotunda fixed at the package-authored terminal pivot.
  for (let iteration = 0; iteration < 2; iteration += 1) {
    const targetInParent = anchor.parent.worldToLocal(targetWorld.clone());
    const actualInParent = anchor.parent.worldToLocal(actualWorld.clone());
    const targetVectorX = targetInParent.x - anchor.position.x;
    const targetVectorZ = targetInParent.z - anchor.position.z;
    const actualVectorX = actualInParent.x - anchor.position.x;
    const actualVectorZ = actualInParent.z - anchor.position.z;
    const yawCorrection = Math.atan2(targetVectorX, targetVectorZ)
      - Math.atan2(actualVectorX, actualVectorZ);
    postFitYawCorrection += yawCorrection;
    anchor.rotation.y += yawCorrection;
    anchor.updateMatrixWorld(true);
    model.updateMatrixWorld(true);
    actualWorld = model.localToWorld(contact.point.clone());
  }

  const vectorGap = actualWorld.distanceTo(targetWorld);
  const horizontalGap = Math.hypot(actualWorld.x - targetWorld.x, actualWorld.z - targetWorld.z);
  const verticalGap = Math.abs(actualWorld.y - targetWorld.y);
  if (vectorGap > 0.12 || horizontalGap > 0.08 || verticalGap > 0.08) {
    throw new Error(
      `Supplied A1 full-3D door fit failed: vector=${vectorGap}, horizontal=${horizontalGap}, vertical=${verticalGap}; `
      + `target=${targetWorld.toArray().join(",")}; actual=${actualWorld.toArray().join(",")}; `
      + `anchor=${anchor.position.toArray().join(",")}; yaw=${anchor.rotation.y}; correction=${postFitYawCorrection}`,
    );
  }

  const result = Object.freeze({
    authority: AUTHORITY,
    targetDoorLocal: Object.freeze([
      CRJ_FORWARD_LEFT_DOOR.x,
      CRJ_FORWARD_LEFT_DOOR.sillY,
      CRJ_FORWARD_LEFT_DOOR.z,
    ]),
    targetDoorWorld: Object.freeze([targetWorld.x, targetWorld.y, targetWorld.z]),
    actualContactWorld: Object.freeze([actualWorld.x, actualWorld.y, actualWorld.z]),
    vectorGapMeters: vectorGap,
    horizontalGapMeters: horizontalGap,
    verticalGapMeters: verticalGap,
    correctedExtensionMeters: extension + residualLongitudinal,
    pitchRadians,
    pitchDegrees: THREE.MathUtils.radToDeg(pitchRadians),
    correctedYawRadians: anchor.rotation.y,
    postFitYawCorrectionRadians: postFitYawCorrection,
    cabContactWidthMeters: contact.width,
    stairGrounding,
    mechanicalGrounding,
  });

  anchor.userData.uploadedJetwayFull3dDoorFit = result;
  group.userData.uploadedJetwayA1Full3dDoorFitAuthority = AUTHORITY;
  group.userData.uploadedJetwayA1DoorTargetWorld = result.targetDoorWorld.join(",");
  group.userData.uploadedJetwayA1ActualContactWorld = result.actualContactWorld.join(",");
  group.userData.uploadedJetwayA1VectorDoorGapMeters = result.vectorGapMeters;
  group.userData.uploadedJetwayA1HorizontalDoorGapMeters = result.horizontalGapMeters;
  group.userData.uploadedJetwayA1VerticalDoorGapMeters = result.verticalGapMeters;
  group.userData.uploadedJetwayA1CorrectedPitchDegrees = result.pitchDegrees;
  group.userData.uploadedJetwayA1CorrectedYawRadians = result.correctedYawRadians;
  group.userData.uploadedJetwayA1CorrectedExtensionMeters = result.correctedExtensionMeters;
  group.userData.uploadedJetwayA1StairMinimumHeightMeters = result.stairGrounding.minimumY;
  group.userData.uploadedJetwayA1MechanicalMinimumHeightMeters = result.mechanicalGrounding.minimumY;
  return result;
}

export { AUTHORITY as UPLOADED_A1_FULL_3D_DOOR_FIT_AUTHORITY };
