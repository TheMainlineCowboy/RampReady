const AUTHORITY = "exact-supplied-tunnel-c-service-stair-exact-crj-envelope-clearance-v3";
const MAX_SWING_DEGREES = 88;
const FUSELAGE_OUTBOARD_CLEARANCE_METERS = 0.15;
const UPPER_ATTACHMENT_EXEMPT_HEIGHT_METERS = 0.7;
const UPPER_ATTACHMENT_EXEMPT_RADIUS_METERS = 0.9;

// Measured from primitive 0 of the exact authored CRJ GLB that RampReady verifies
// at 32.50 m length / 23.64 m span. The A1 fitter already expresses its rendered
// door target in this same CRJ-local coordinate frame, so these are source bounds,
// not a guessed world-space collision proxy.
const EXACT_CRJ_FUSELAGE_MIN = Object.freeze([-1.9402, 1.10, -1.981]);
const EXACT_CRJ_FUSELAGE_MAX = Object.freeze([1.9402, 4.36, 27.36]);

function yawAround(THREE, pivotX, pivotZ, radians) {
  const toPivot = new THREE.Matrix4().makeTranslation(pivotX, 0, pivotZ);
  const yaw = new THREE.Matrix4().makeRotationY(radians);
  const fromPivot = new THREE.Matrix4().makeTranslation(-pivotX, 0, -pivotZ);
  return new THREE.Matrix4().multiplyMatrices(toPivot, yaw).multiply(fromPivot);
}

function selectExactServiceStairVertices(THREE, geometry) {
  const position = geometry.getAttribute("position");
  if (!position || position.count % 3 !== 0) {
    throw new Error(`A1 exact Tunnel-C geometry is not triangle-addressable: vertices=${position?.count}`);
  }

  const selected = [];
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  for (let index = 0; index < position.count; index += 3) {
    a.fromBufferAttribute(position, index);
    b.fromBufferAttribute(position, index + 1);
    c.fromBufferAttribute(position, index + 2);
    const centerX = (a.x + b.x + c.x) / 3;
    const centerY = (a.y + b.y + c.y) / 3;
    const centerZ = (a.z + b.z + c.z) / 3;
    // Exact supplied Tunnel_C_Jetway_0 primitive-local stair/rail region measured
    // by the earlier source decoder. No procedural replacement triangles are used.
    if (centerX > 16.4 && centerY < -1.55 && centerZ < 4.8) {
      selected.push(index, index + 1, index + 2);
    }
  }
  const triangleCount = selected.length / 3;
  if (!(triangleCount >= 40 && triangleCount <= 6000)) {
    throw new Error(`A1 exact service-stair triangle selection is invalid: ${triangleCount}`);
  }
  return { selected, triangleCount };
}

export function articulateA1ServiceStairClearOfAircraft(
  THREE,
  aircraftFrame,
  model,
  targetWorld,
  cabRelativeYawRadians,
) {
  const tunnelCMesh = model?.getObjectByName?.("Tunnel_C_Jetway_0");
  if (!tunnelCMesh?.isMesh || !tunnelCMesh.geometry?.getAttribute?.("position")) {
    throw new Error("A1 service-stair clearance cannot resolve exact Tunnel_C_Jetway_0 geometry");
  }
  if (!aircraftFrame?.matrixWorld) {
    throw new Error("A1 service-stair clearance is missing the CRJ-local aircraft frame");
  }

  if (!tunnelCMesh.userData.a1ServiceStairSourceGeometry) {
    tunnelCMesh.userData.a1ServiceStairSourceGeometry = tunnelCMesh.geometry.index
      ? tunnelCMesh.geometry.toNonIndexed()
      : tunnelCMesh.geometry.clone();
  }
  const geometry = tunnelCMesh.userData.a1ServiceStairSourceGeometry.clone();
  tunnelCMesh.geometry = geometry;
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const { selected: stairVertexIndices, triangleCount: stairTriangleCount } =
    selectExactServiceStairVertices(THREE, geometry);

  model.updateWorldMatrix(true, true);
  tunnelCMesh.updateWorldMatrix(true, false);
  aircraftFrame.updateWorldMatrix(true, false);
  const modelInverse = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const meshToModel = new THREE.Matrix4().multiplyMatrices(modelInverse, tunnelCMesh.matrixWorld);
  const modelToMesh = meshToModel.clone().invert();
  const modelToWorld = model.matrixWorld.clone();
  const worldToAircraft = new THREE.Matrix4().copy(aircraftFrame.matrixWorld).invert();
  const fuselageBox = new THREE.Box3(
    new THREE.Vector3(...EXACT_CRJ_FUSELAGE_MIN),
    new THREE.Vector3(...EXACT_CRJ_FUSELAGE_MAX),
  );
  const baseModelPoints = stairVertexIndices.map((vertexIndex) =>
    new THREE.Vector3().fromBufferAttribute(position, vertexIndex).applyMatrix4(meshToModel));

  let maximumStairY = Number.NEGATIVE_INFINITY;
  for (const point of baseModelPoints) maximumStairY = Math.max(maximumStairY, point.y);
  const upperAttachmentBand = baseModelPoints.filter((point) => point.y >= maximumStairY - 0.24);
  if (upperAttachmentBand.length < 3) {
    throw new Error(`A1 exact service stair has no measurable upper attachment band: ${upperAttachmentBand.length}`);
  }
  const pivot = new THREE.Vector3();
  for (const point of upperAttachmentBand) pivot.add(point);
  pivot.multiplyScalar(1 / upperAttachmentBand.length);

  // Fail closed if the fitter's target is not actually expressed in the same CRJ
  // frame as the verified authored fuselage bounds. The target should sit on the
  // left forward fuselage, near the known A1 door coordinates.
  const targetAircraftLocal = targetWorld.clone().applyMatrix4(worldToAircraft);
  if (
    !(targetAircraftLocal.x < 0 && targetAircraftLocal.x > -2.5)
    || !(targetAircraftLocal.y > 1.8 && targetAircraftLocal.y < 3.8)
    || !(targetAircraftLocal.z > 0 && targetAircraftLocal.z < 8)
  ) {
    throw new Error(`A1 service-stair CRJ frame mismatch at target ${targetAircraftLocal.toArray().join(",")}`);
  }

  const preferredSign = Math.sign(cabRelativeYawRadians || 1) || 1;

  function measureCandidate(angleRadians) {
    const correction = yawAround(THREE, pivot.x, pivot.z, angleRadians);
    let maximumFuselageEnvelopePenetrationMeters = Number.NEGATIVE_INFINITY;
    let measuredFuselageBandPointCount = 0;
    let minimumOutboardClearanceMeters = Number.POSITIVE_INFINITY;
    const candidate = new THREE.Vector3();
    const aircraftLocal = new THREE.Vector3();

    for (const basePoint of baseModelPoints) {
      const horizontalFromPivot = Math.hypot(basePoint.x - pivot.x, basePoint.z - pivot.z);
      if (
        basePoint.y >= maximumStairY - UPPER_ATTACHMENT_EXEMPT_HEIGHT_METERS
        || horizontalFromPivot <= UPPER_ATTACHMENT_EXEMPT_RADIUS_METERS
      ) continue;

      candidate.copy(basePoint)
        .applyMatrix4(correction)
        .applyMatrix4(modelToWorld)
        .applyMatrix4(worldToAircraft);
      aircraftLocal.copy(candidate);

      const insideVerticalBand = aircraftLocal.y >= fuselageBox.min.y - 0.05
        && aircraftLocal.y <= fuselageBox.max.y + 0.05;
      const insideLongitudinalBand = aircraftLocal.z >= fuselageBox.min.z - 0.15
        && aircraftLocal.z <= fuselageBox.max.z + 0.15;
      if (!insideVerticalBand || !insideLongitudinalBand) continue;

      // A1 serves the aircraft's left side: negative CRJ-local X is outboard.
      // Below the small top landing/hinge exemption, every stair/rail vertex must
      // remain beyond the exact fuselage's left skin plus 15 cm clearance.
      const requiredMaximumX = fuselageBox.min.x - FUSELAGE_OUTBOARD_CLEARANCE_METERS;
      const penetration = aircraftLocal.x - requiredMaximumX;
      maximumFuselageEnvelopePenetrationMeters = Math.max(
        maximumFuselageEnvelopePenetrationMeters,
        penetration,
      );
      minimumOutboardClearanceMeters = Math.min(
        minimumOutboardClearanceMeters,
        requiredMaximumX - aircraftLocal.x,
      );
      measuredFuselageBandPointCount += 1;
    }

    if (!measuredFuselageBandPointCount) {
      maximumFuselageEnvelopePenetrationMeters = Number.NEGATIVE_INFINITY;
      minimumOutboardClearanceMeters = Number.POSITIVE_INFINITY;
    }
    return {
      angleRadians,
      maximumFuselageEnvelopePenetrationMeters,
      minimumOutboardClearanceMeters,
      measuredFuselageBandPointCount,
    };
  }

  const before = measureCandidate(0);
  let selected = before.maximumFuselageEnvelopePenetrationMeters <= 0 ? before : null;
  if (!selected) {
    for (let degrees = 2; degrees <= MAX_SWING_DEGREES && !selected; degrees += 2) {
      const candidates = [preferredSign, -preferredSign]
        .map((sign) => measureCandidate(THREE.MathUtils.degToRad(degrees * sign)))
        .sort((a, b) => a.maximumFuselageEnvelopePenetrationMeters - b.maximumFuselageEnvelopePenetrationMeters);
      selected = candidates.find((candidate) => candidate.maximumFuselageEnvelopePenetrationMeters <= 0) || null;
    }
  }
  if (!selected) {
    throw new Error(
      `A1 exact service stair cannot clear exact CRJ fuselage within ${MAX_SWING_DEGREES} degrees: `
      + `beforePenetration=${before.maximumFuselageEnvelopePenetrationMeters}; `
      + `targetLocal=${targetAircraftLocal.toArray().join(",")}`,
    );
  }

  const correctionModel = yawAround(THREE, pivot.x, pivot.z, selected.angleRadians);
  const correctionMesh = new THREE.Matrix4()
    .multiplyMatrices(modelToMesh, correctionModel)
    .multiply(meshToModel);
  const normalMatrix = new THREE.Matrix3().getNormalMatrix(correctionMesh);
  const vertex = new THREE.Vector3();
  for (const vertexIndex of stairVertexIndices) {
    vertex.fromBufferAttribute(position, vertexIndex).applyMatrix4(correctionMesh);
    position.setXYZ(vertexIndex, vertex.x, vertex.y, vertex.z);
    if (normal) {
      vertex.fromBufferAttribute(normal, vertexIndex).applyMatrix3(normalMatrix).normalize();
      normal.setXYZ(vertexIndex, vertex.x, vertex.y, vertex.z);
    }
  }
  position.needsUpdate = true;
  if (normal) normal.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  tunnelCMesh.updateMatrixWorld(true);

  return Object.freeze({
    authority: AUTHORITY,
    stairTriangleCount,
    upperAttachmentPointCount: upperAttachmentBand.length,
    swingDegrees: THREE.MathUtils.radToDeg(selected.angleRadians),
    beforeFuselageEnvelopePenetrationMeters: before.maximumFuselageEnvelopePenetrationMeters,
    afterFuselageEnvelopePenetrationMeters: selected.maximumFuselageEnvelopePenetrationMeters,
    minimumOutboardClearanceMeters: selected.minimumOutboardClearanceMeters,
    measuredFuselageBandPointCount: selected.measuredFuselageBandPointCount,
    fuselageMeshName: "exact-authored-crj-primitive-0-envelope",
    fuselageBoundsMin: fuselageBox.min.toArray(),
    fuselageBoundsMax: fuselageBox.max.toArray(),
    targetAircraftLocal: targetAircraftLocal.toArray(),
    pivotModel: pivot.toArray(),
  });
}

export { AUTHORITY as A1_SERVICE_STAIR_CLEARANCE_AUTHORITY };
