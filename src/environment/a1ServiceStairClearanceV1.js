const AUTHORITY = "exact-supplied-tunnel-c-service-stair-aircraft-envelope-clearance-v2";
const MAX_SWING_DEGREES = 88;
const FUSELAGE_OUTBOARD_CLEARANCE_METERS = 0.15;
const UPPER_ATTACHMENT_EXEMPT_HEIGHT_METERS = 0.7;
const UPPER_ATTACHMENT_EXEMPT_RADIUS_METERS = 0.9;

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

function objectBoundsInAircraftLocal(THREE, aircraftGroup, object, aircraftWorldInverse) {
  const geometry = object.geometry;
  if (!geometry?.getAttribute?.("position")) return null;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const source = geometry.boundingBox;
  if (!source || source.isEmpty()) return null;

  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  for (const x of [source.min.x, source.max.x]) {
    for (const y of [source.min.y, source.max.y]) {
      for (const z of [source.min.z, source.max.z]) {
        corner.set(x, y, z).applyMatrix4(object.matrixWorld).applyMatrix4(aircraftWorldInverse);
        box.expandByPoint(corner);
      }
    }
  }
  return box;
}

function findRenderedCrjFuselageBounds(THREE, aircraftGroup) {
  aircraftGroup.updateWorldMatrix(true, true);
  const aircraftWorldInverse = new THREE.Matrix4().copy(aircraftGroup.matrixWorld).invert();
  const size = new THREE.Vector3();
  let best = null;

  aircraftGroup.traverse((entry) => {
    if (!entry.isMesh || entry.visible === false) return;
    const box = objectBoundsInAircraftLocal(THREE, aircraftGroup, entry, aircraftWorldInverse);
    if (!box) return;
    box.getSize(size);

    // The authored CRJ fuselage primitive is the only rendered aircraft mesh with
    // roughly 3-5 m width, 2-5 m height and more than 20 m longitudinal extent.
    // Derive this at runtime instead of trusting a guessed collision cylinder.
    if (!(size.x >= 2.5 && size.x <= 5.2)) return;
    if (!(size.y >= 2.0 && size.y <= 5.2)) return;
    if (!(size.z >= 20 && size.z <= 32)) return;
    const score = size.z - Math.abs(size.x - 3.9) * 0.4 - Math.abs(size.y - 3.3) * 0.4;
    if (!best || score > best.score) {
      best = { box: box.clone(), score, meshName: entry.name || "unnamed", size: size.clone() };
    }
  });

  if (!best) {
    throw new Error("A1 service-stair clearance cannot resolve the rendered CRJ fuselage envelope");
  }
  return { ...best, aircraftWorldInverse };
}

export function articulateA1ServiceStairClearOfAircraft(
  THREE,
  aircraftGroup,
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
  aircraftGroup.updateWorldMatrix(true, true);
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

  const fuselage = findRenderedCrjFuselageBounds(THREE, aircraftGroup);
  const modelToWorld = model.matrixWorld.clone();
  const preferredSign = Math.sign(cabRelativeYawRadians || 1) || 1;

  function measureCandidate(angleRadians) {
    const correction = yawAround(THREE, pivot.x, pivot.z, angleRadians);
    let maximumFuselageEnvelopePenetrationMeters = Number.NEGATIVE_INFINITY;
    let measuredFuselageBandPointCount = 0;
    let minimumOutboardClearanceMeters = Number.POSITIVE_INFINITY;
    const candidate = new THREE.Vector3();
    const world = new THREE.Vector3();
    const aircraftLocal = new THREE.Vector3();

    for (const basePoint of baseModelPoints) {
      const horizontalFromPivot = Math.hypot(basePoint.x - pivot.x, basePoint.z - pivot.z);
      if (
        basePoint.y >= maximumStairY - UPPER_ATTACHMENT_EXEMPT_HEIGHT_METERS
        || horizontalFromPivot <= UPPER_ATTACHMENT_EXEMPT_RADIUS_METERS
      ) continue;

      candidate.copy(basePoint).applyMatrix4(correction);
      world.copy(candidate).applyMatrix4(modelToWorld);
      aircraftLocal.copy(world).applyMatrix4(fuselage.aircraftWorldInverse);

      const insideVerticalBand = aircraftLocal.y >= fuselage.box.min.y - 0.05
        && aircraftLocal.y <= fuselage.box.max.y + 0.05;
      const insideLongitudinalBand = aircraftLocal.z >= fuselage.box.min.z - 0.15
        && aircraftLocal.z <= fuselage.box.max.z + 0.15;
      if (!insideVerticalBand || !insideLongitudinalBand) continue;

      // A1 serves the CRJ's left side. The rendered fuselage's minimum local X is
      // therefore the actual outboard skin plane. Everything below the small upper
      // hinge/landing exemption must remain at least 15 cm farther outboard than
      // that skin. This catches the prior false-green pose where the long stair ran
      // visibly through the nose even though a Cab-normal sign test said it was clear.
      const requiredMaximumX = fuselage.box.min.x - FUSELAGE_OUTBOARD_CLEARANCE_METERS;
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
      `A1 exact service stair cannot clear rendered CRJ fuselage within ${MAX_SWING_DEGREES} degrees: `
      + `beforePenetration=${before.maximumFuselageEnvelopePenetrationMeters}; `
      + `fuselage=${fuselage.meshName} size=${fuselage.size.toArray().join(",")}`,
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
    fuselageMeshName: fuselage.meshName,
    fuselageBoundsMin: fuselage.box.min.toArray(),
    fuselageBoundsMax: fuselage.box.max.toArray(),
    pivotModel: pivot.toArray(),
  });
}

export { AUTHORITY as A1_SERVICE_STAIR_CLEARANCE_AUTHORITY };
