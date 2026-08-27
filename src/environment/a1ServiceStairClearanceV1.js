const AUTHORITY = "exact-supplied-tunnel-c-service-stair-live-rendered-crj-clearance-v4";
const MAX_SWING_DEGREES = 88;
const FUSELAGE_OUTBOARD_CLEARANCE_METERS = 0.15;
const UPPER_ATTACHMENT_EXEMPT_HEIGHT_METERS = 0.7;
const UPPER_ATTACHMENT_EXEMPT_RADIUS_METERS = 0.9;
const EXPECTED_SERVICE_STAIR_TRIANGLE_COUNT = 2352;

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

  // Exact supplied Tunnel_C_Jetway_0 primitive-local region measured from the
  // immutable Airport_Jetway.glb. This is the galvanized diagonal service stair
  // and rails; no procedural replacement geometry is introduced.
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
  if (triangleCount !== EXPECTED_SERVICE_STAIR_TRIANGLE_COUNT) {
    throw new Error(
      `A1 exact service-stair triangle selection changed: ${triangleCount} != ${EXPECTED_SERVICE_STAIR_TRIANGLE_COUNT}`,
    );
  }
  return { selected, triangleCount };
}

function objectBoundsInAircraftLocal(THREE, aircraftRoot, object, worldToAircraft) {
  const geometry = object.geometry;
  if (!geometry?.getAttribute?.("position")) return null;
  if (!geometry.boundingBox) geometry.computeBoundingBox();
  const source = geometry.boundingBox;
  if (!source || source.isEmpty()) return null;

  object.updateWorldMatrix(true, false);
  const box = new THREE.Box3();
  const corner = new THREE.Vector3();
  for (const x of [source.min.x, source.max.x]) {
    for (const y of [source.min.y, source.max.y]) {
      for (const z of [source.min.z, source.max.z]) {
        corner.set(x, y, z).applyMatrix4(object.matrixWorld).applyMatrix4(worldToAircraft);
        box.expandByPoint(corner);
      }
    }
  }
  return box;
}

function findLiveRenderedCrjFuselageBounds(THREE, aircraftRoot) {
  if (!aircraftRoot?.isObject3D) {
    throw new Error("A1 service-stair clearance is missing the live rendered aircraft root");
  }
  aircraftRoot.updateWorldMatrix(true, true);
  const worldToAircraft = new THREE.Matrix4().copy(aircraftRoot.matrixWorld).invert();
  const size = new THREE.Vector3();
  let best = null;

  aircraftRoot.traverse((entry) => {
    if (!entry.isMesh || entry.visible === false) return;
    const box = objectBoundsInAircraftLocal(THREE, aircraftRoot, entry, worldToAircraft);
    if (!box) return;
    box.getSize(size);

    // The authored CRJ fuselage primitive is uniquely long and narrow in the
    // actual aircraft-root frame. Wings, tail, gear and retained training markers
    // fail these bounds. This runs only after the real GLB and final A1 pose exist.
    if (!(size.x >= 2.5 && size.x <= 5.5)) return;
    if (!(size.y >= 2.0 && size.y <= 5.5)) return;
    if (!(size.z >= 20 && size.z <= 32)) return;
    const score = size.z - Math.abs(size.x - 3.9) * 0.5 - Math.abs(size.y - 3.3) * 0.5;
    if (!best || score > best.score) {
      best = {
        box: box.clone(),
        size: size.clone(),
        score,
        meshName: entry.name || entry.parent?.name || "unnamed-crj-fuselage-primitive",
      };
    }
  });

  if (!best) {
    const diagnostic = [];
    aircraftRoot.traverse((entry) => {
      if (!entry.isMesh || entry.visible === false || diagnostic.length >= 20) return;
      const box = objectBoundsInAircraftLocal(THREE, aircraftRoot, entry, worldToAircraft);
      if (!box) return;
      const meshSize = box.getSize(new THREE.Vector3());
      diagnostic.push({
        name: entry.name || entry.parent?.name || "unnamed",
        size: meshSize.toArray().map((value) => Number(value.toFixed(3))),
      });
    });
    throw new Error(`A1 service-stair clearance cannot resolve live CRJ fuselage: ${JSON.stringify(diagnostic)}`);
  }
  return { ...best, worldToAircraft };
}

function distanceToBox(point, box) {
  const dx = Math.max(box.min.x - point.x, 0, point.x - box.max.x);
  const dy = Math.max(box.min.y - point.y, 0, point.y - box.max.y);
  const dz = Math.max(box.min.z - point.z, 0, point.z - box.max.z);
  return Math.hypot(dx, dy, dz);
}

export function articulateA1ServiceStairClearOfAircraft(THREE, aircraftRoot, model) {
  const tunnelCMesh = model?.getObjectByName?.("Tunnel_C_Jetway_0");
  if (!tunnelCMesh?.isMesh || !tunnelCMesh.geometry?.getAttribute?.("position")) {
    throw new Error("A1 service-stair clearance cannot resolve exact Tunnel_C_Jetway_0 geometry");
  }

  // Keep a pristine A1-only non-indexed copy so the solve is deterministic even
  // if browser calibration runs more than once. The shared source GLB and 57
  // static instances are never mutated.
  if (!tunnelCMesh.userData.a1ServiceStairSourceGeometryV4) {
    tunnelCMesh.userData.a1ServiceStairSourceGeometryV4 = tunnelCMesh.geometry.index
      ? tunnelCMesh.geometry.toNonIndexed()
      : tunnelCMesh.geometry.clone();
  }
  const geometry = tunnelCMesh.userData.a1ServiceStairSourceGeometryV4.clone();
  tunnelCMesh.geometry = geometry;
  const position = geometry.getAttribute("position");
  const normal = geometry.getAttribute("normal");
  const { selected: stairVertexIndices, triangleCount: stairTriangleCount } =
    selectExactServiceStairVertices(THREE, geometry);

  model.updateWorldMatrix(true, true);
  tunnelCMesh.updateWorldMatrix(true, false);
  aircraftRoot.updateWorldMatrix(true, true);
  const fuselage = findLiveRenderedCrjFuselageBounds(THREE, aircraftRoot);
  const modelInverse = new THREE.Matrix4().copy(model.matrixWorld).invert();
  const meshToModel = new THREE.Matrix4().multiplyMatrices(modelInverse, tunnelCMesh.matrixWorld);
  const modelToMesh = meshToModel.clone().invert();
  const modelToWorld = model.matrixWorld.clone();
  const baseModelPoints = stairVertexIndices.map((vertexIndex) =>
    new THREE.Vector3().fromBufferAttribute(position, vertexIndex).applyMatrix4(meshToModel));

  let maximumStairY = Number.NEGATIVE_INFINITY;
  for (const point of baseModelPoints) maximumStairY = Math.max(maximumStairY, point.y);
  let upperAttachmentBand = baseModelPoints.filter((point) => point.y >= maximumStairY - 0.24);
  if (upperAttachmentBand.length < 3) {
    // A lower real CRJ sill changes the final Tunnel-C pitch enough that the exact
    // stair can expose only two vertices inside the old 24 cm cap. Preserve the
    // exact supplied triangles and derive the same upper hinge from the highest
    // available source vertices instead of failing before visual clearance can run.
    upperAttachmentBand = [...baseModelPoints]
      .sort((a, b) => b.y - a.y)
      .slice(0, Math.min(12, baseModelPoints.length));
  }
  if (upperAttachmentBand.length < 3) {
    throw new Error(`A1 exact service stair has no measurable upper attachment band: ${upperAttachmentBand.length}`);
  }
  const pivot = new THREE.Vector3();
  for (const point of upperAttachmentBand) pivot.add(point);
  pivot.multiplyScalar(1 / upperAttachmentBand.length);

  const cabObject = model.getObjectByName("Cab") || model.getObjectByName("Cab_Jetway_0");
  if (!cabObject) throw new Error("A1 service-stair clearance cannot resolve the live Cab side");
  const cabWorld = new THREE.Box3().setFromObject(cabObject).getCenter(new THREE.Vector3());
  const cabAircraftLocal = cabWorld.clone().applyMatrix4(fuselage.worldToAircraft);
  const fuselageCenterX = (fuselage.box.min.x + fuselage.box.max.x) / 2;
  const serviceSideSign = cabAircraftLocal.x <= fuselageCenterX ? -1 : 1;

  function measureCandidate(angleRadians) {
    const correction = yawAround(THREE, pivot.x, pivot.z, angleRadians);
    let maximumFuselageEnvelopePenetrationMeters = Number.NEGATIVE_INFINITY;
    let measuredFuselageBandPointCount = 0;
    let minimumOutboardClearanceMeters = Number.POSITIVE_INFINITY;
    let minimumFuselageBoxSeparationMeters = Number.POSITIVE_INFINITY;
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
        .applyMatrix4(fuselage.worldToAircraft);
      aircraftLocal.copy(candidate);
      minimumFuselageBoxSeparationMeters = Math.min(
        minimumFuselageBoxSeparationMeters,
        distanceToBox(aircraftLocal, fuselage.box),
      );

      const insideVerticalBand = aircraftLocal.y >= fuselage.box.min.y - 0.05
        && aircraftLocal.y <= fuselage.box.max.y + 0.05;
      const insideLongitudinalBand = aircraftLocal.z >= fuselage.box.min.z - 0.15
        && aircraftLocal.z <= fuselage.box.max.z + 0.15;
      if (!insideVerticalBand || !insideLongitudinalBand) continue;

      let penetration;
      let outboardClearance;
      if (serviceSideSign < 0) {
        const requiredMaximumX = fuselage.box.min.x - FUSELAGE_OUTBOARD_CLEARANCE_METERS;
        penetration = aircraftLocal.x - requiredMaximumX;
        outboardClearance = requiredMaximumX - aircraftLocal.x;
      } else {
        const requiredMinimumX = fuselage.box.max.x + FUSELAGE_OUTBOARD_CLEARANCE_METERS;
        penetration = requiredMinimumX - aircraftLocal.x;
        outboardClearance = aircraftLocal.x - requiredMinimumX;
      }
      maximumFuselageEnvelopePenetrationMeters = Math.max(
        maximumFuselageEnvelopePenetrationMeters,
        penetration,
      );
      minimumOutboardClearanceMeters = Math.min(minimumOutboardClearanceMeters, outboardClearance);
      measuredFuselageBandPointCount += 1;
    }

    // No point entering the fuselage's vertical/longitudinal slab is a legitimate
    // clear condition, but publish a finite negative margin so acceptance cannot
    // accidentally serialize Infinity/-Infinity as a false pass.
    if (!measuredFuselageBandPointCount) {
      const separation = Number.isFinite(minimumFuselageBoxSeparationMeters)
        ? minimumFuselageBoxSeparationMeters
        : 0;
      maximumFuselageEnvelopePenetrationMeters = -Math.max(separation, FUSELAGE_OUTBOARD_CLEARANCE_METERS);
      minimumOutboardClearanceMeters = Math.max(separation, FUSELAGE_OUTBOARD_CLEARANCE_METERS);
    }
    return {
      angleRadians,
      maximumFuselageEnvelopePenetrationMeters,
      minimumOutboardClearanceMeters,
      minimumFuselageBoxSeparationMeters,
      measuredFuselageBandPointCount,
    };
  }

  const before = measureCandidate(0);
  let selected = before.maximumFuselageEnvelopePenetrationMeters <= 0 ? before : null;
  if (!selected) {
    for (let degrees = 2; degrees <= MAX_SWING_DEGREES && !selected; degrees += 2) {
      const candidates = [1, -1]
        .map((sign) => measureCandidate(THREE.MathUtils.degToRad(degrees * sign)))
        .sort((a, b) => a.maximumFuselageEnvelopePenetrationMeters - b.maximumFuselageEnvelopePenetrationMeters);
      selected = candidates.find((candidate) => candidate.maximumFuselageEnvelopePenetrationMeters <= 0) || null;
    }
  }
  if (!selected) {
    throw new Error(
      `A1 exact service stair cannot clear the live rendered CRJ within ${MAX_SWING_DEGREES} degrees: `
      + `before=${before.maximumFuselageEnvelopePenetrationMeters}; `
      + `fuselage=${fuselage.meshName}/${fuselage.size.toArray().join(",")}; side=${serviceSideSign}`,
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

  const result = Object.freeze({
    authority: AUTHORITY,
    stairTriangleCount,
    upperAttachmentPointCount: upperAttachmentBand.length,
    swingDegrees: THREE.MathUtils.radToDeg(selected.angleRadians),
    beforeFuselageEnvelopePenetrationMeters: before.maximumFuselageEnvelopePenetrationMeters,
    afterFuselageEnvelopePenetrationMeters: selected.maximumFuselageEnvelopePenetrationMeters,
    minimumOutboardClearanceMeters: selected.minimumOutboardClearanceMeters,
    minimumFuselageBoxSeparationMeters: selected.minimumFuselageBoxSeparationMeters,
    measuredFuselageBandPointCount: selected.measuredFuselageBandPointCount,
    fuselageMeshName: fuselage.meshName,
    fuselageBoundsMin: fuselage.box.min.toArray(),
    fuselageBoundsMax: fuselage.box.max.toArray(),
    fuselageSize: fuselage.size.toArray(),
    serviceSideSign,
    cabAircraftLocal: cabAircraftLocal.toArray(),
    pivotModel: pivot.toArray(),
  });
  tunnelCMesh.userData.a1ServiceStairClearance = result;
  return result;
}

export { AUTHORITY as A1_SERVICE_STAIR_CLEARANCE_AUTHORITY };
