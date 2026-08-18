const AUTHORITY = "exact-supplied-tunnel-c-service-stair-rigid-swing-clearance-v1";
const SAFE_CONTACT_PLANE_METERS = 0.05;
const MAX_SWING_DEGREES = 82;

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

  // These primitive-local centroid bounds were measured from the exact supplied
  // Tunnel_C_Jetway_0 geometry in the earlier source decoder. They isolate the
  // authored diagonal service stair/rails, not the tunnel shell or bogie/lift.
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
  group,
  model,
  targetWorld,
  cabRelativeYawRadians,
) {
  const tunnelCMesh = model?.getObjectByName?.("Tunnel_C_Jetway_0");
  if (!tunnelCMesh?.isMesh || !tunnelCMesh.geometry?.getAttribute?.("position")) {
    throw new Error("A1 service-stair clearance cannot resolve exact Tunnel_C_Jetway_0 geometry");
  }

  // The exact GLB prototype feeds all 58 gates. Clone geometry only on A1 before
  // articulating the measured stair subset so static instances and the committed
  // source asset remain byte/vertex identical. No triangle is added or deleted.
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
  group.updateWorldMatrix(true, false);
  const modelInverse = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const meshToModel = new THREE.Matrix4().multiplyMatrices(modelInverse, tunnelCMesh.matrixWorld);
  const modelToMesh = meshToModel.clone().invert();
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

  const desiredCabNormalWorld = new THREE.Vector3(1, 0, 0)
    .transformDirection(group.matrixWorld).setY(0).normalize();
  const aircraftLongitudinalWorld = new THREE.Vector3(
    -desiredCabNormalWorld.z,
    0,
    desiredCabNormalWorld.x,
  ).normalize();
  const modelToWorld = model.matrixWorld.clone();

  function measureCandidate(angleRadians) {
    const correction = yawAround(THREE, pivot.x, pivot.z, angleRadians);
    let maximumFuselagePlanePenetrationMeters = Number.NEGATIVE_INFINITY;
    let measuredFuselageBandPointCount = 0;
    const candidate = new THREE.Vector3();
    const world = new THREE.Vector3();
    const fromDoor = new THREE.Vector3();
    for (const basePoint of baseModelPoints) {
      candidate.copy(basePoint).applyMatrix4(correction);
      world.copy(candidate).applyMatrix4(modelToWorld);
      fromDoor.copy(world).sub(targetWorld);
      const verticalFromDoor = world.y - targetWorld.y;
      const longitudinalFromDoor = fromDoor.dot(aircraftLongitudinalWorld);
      if (verticalFromDoor < -1.45 || verticalFromDoor > 1.35 || Math.abs(longitudinalFromDoor) > 5.2) continue;
      maximumFuselagePlanePenetrationMeters = Math.max(
        maximumFuselagePlanePenetrationMeters,
        fromDoor.dot(desiredCabNormalWorld),
      );
      measuredFuselageBandPointCount += 1;
    }
    if (!measuredFuselageBandPointCount) {
      maximumFuselagePlanePenetrationMeters = Number.NEGATIVE_INFINITY;
    }
    return { angleRadians, maximumFuselagePlanePenetrationMeters, measuredFuselageBandPointCount };
  }

  const before = measureCandidate(0);
  const preferredSign = Math.sign(cabRelativeYawRadians || 1) || 1;
  let selected = before.maximumFuselagePlanePenetrationMeters <= SAFE_CONTACT_PLANE_METERS
    ? before
    : null;
  if (!selected) {
    for (let degrees = 2; degrees <= MAX_SWING_DEGREES && !selected; degrees += 2) {
      for (const sign of [preferredSign, -preferredSign]) {
        const candidate = measureCandidate(THREE.MathUtils.degToRad(degrees * sign));
        if (candidate.maximumFuselagePlanePenetrationMeters <= SAFE_CONTACT_PLANE_METERS) {
          selected = candidate;
          break;
        }
      }
    }
  }
  if (!selected) {
    throw new Error(
      `A1 exact service stair cannot clear the CRJ fuselage within ${MAX_SWING_DEGREES} degrees: `
      + `before=${before.maximumFuselagePlanePenetrationMeters} points=${before.measuredFuselageBandPointCount}`,
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
    beforeFuselagePlanePenetrationMeters: before.maximumFuselagePlanePenetrationMeters,
    afterFuselagePlanePenetrationMeters: selected.maximumFuselagePlanePenetrationMeters,
    measuredFuselageBandPointCount: selected.measuredFuselageBandPointCount,
    pivotModel: pivot.toArray(),
  });
}

export { AUTHORITY as A1_SERVICE_STAIR_CLEARANCE_AUTHORITY };
