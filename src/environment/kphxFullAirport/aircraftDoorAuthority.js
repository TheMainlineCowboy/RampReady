export const AUTOGATE_REFERENCE = Object.freeze({
  source: "Marginal AutoGate controller + user-supplied MisterX AutoGate OBJ8 animation definitions",
  restEntranceLateralMeters: -7.5,
  restEntranceHeightMeters: 4.0,
  engageWaitSeconds: 1,
  motionDurationSeconds: 15,
  horizontalDataref: "marginal.org.uk/autogate/lat",
  verticalDataref: "marginal.org.uk/autogate/vert",
});

export const RAMPREADY_AIRCRAFT_DOOR_PROFILES = Object.freeze({
  CRJ700: Object.freeze({
    aircraftType: "CRJ700",
    doorId: "L1-forward-passenger",
    modelForwardAxis: "-Z",
    noseGearReference: true,
    aftOfVisibleNoseMeters: 7.32,
    leftOfVisibleCenterlineMeters: 1.34,
    authoredDoorHeightLocalPointMeters: Object.freeze([-1.262, 3.0, 3.90]),
    horizontalAuthority: "visible-rendered-airframe-bounds-7p32m-aft-1p34m-left-v1",
    verticalAuthority: "grounded-authored-forward-left-door-y-v1",
    renderedDoorMarkerAuthority:
      "historical-final-A1-visible-mesh-door-method; commits 2cc9fe3/eaa5983/e54b273; current user-authored CRJ GLB at authored world dimensions",
  }),
});

export function getRampReadyAircraftDoorProfile(aircraftType) {
  return RAMPREADY_AIRCRAFT_DOOR_PROFILES[String(aircraftType || "").toUpperCase()] || null;
}

export function getAutoGateDoorTargets(profile, { doorHeightMeters = null } = {}) {
  if (!profile) throw new Error("Aircraft door profile is required");
  const lateralDoorMeters = -Number(profile.leftOfVisibleCenterlineMeters);
  if (!Number.isFinite(lateralDoorMeters)) {
    throw new Error(`Aircraft door profile ${profile.aircraftType} has no finite lateral door station`);
  }

  const latMeters = lateralDoorMeters - AUTOGATE_REFERENCE.restEntranceLateralMeters;
  const hasVertical = Number.isFinite(doorHeightMeters);
  const vertMeters = hasVertical
    ? Number(doorHeightMeters) - AUTOGATE_REFERENCE.restEntranceHeightMeters
    : null;

  return Object.freeze({
    aircraftType: profile.aircraftType,
    doorId: profile.doorId,
    latMeters,
    vertMeters,
    verticalResolved: hasVertical,
    authority: "autogate-meter-space-aircraft-door-target-v1",
  });
}

export function measureRenderedAircraftDoorWorld(THREE, aircraft, profile) {
  if (!THREE || !aircraft || !profile) {
    throw new Error("THREE, aircraft, and door profile are required");
  }
  const realModel = aircraft.userData?.realAircraftObject;
  if (!realModel?.isObject3D) return null;

  aircraft.updateMatrixWorld(true);
  realModel.updateMatrixWorld(true);

  const aircraftWorldQuaternion = aircraft.getWorldQuaternion(new THREE.Quaternion());
  const forwardAxis = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(aircraftWorldQuaternion)
    .setY(0)
    .normalize();
  const leftAxis = new THREE.Vector3(-1, 0, 0)
    .applyQuaternion(aircraftWorldQuaternion)
    .setY(0)
    .normalize();

  let maximumForwardProjection = Number.NEGATIVE_INFINITY;
  let minimumLeftProjection = Number.POSITIVE_INFINITY;
  let maximumLeftProjection = Number.NEGATIVE_INFINITY;
  let sampleCount = 0;
  const samplePoint = new THREE.Vector3();

  realModel.traverse((child) => {
    if (!child?.isMesh || child.visible === false || !child.geometry) return;
    if (!child.geometry.boundingBox) child.geometry.computeBoundingBox();
    const box = child.geometry.boundingBox;
    if (!box || box.isEmpty()) return;
    child.updateWorldMatrix(true, false);
    for (const x of [box.min.x, box.max.x]) {
      for (const y of [box.min.y, box.max.y]) {
        for (const z of [box.min.z, box.max.z]) {
          samplePoint.set(x, y, z).applyMatrix4(child.matrixWorld);
          const forwardProjection =
            samplePoint.x * forwardAxis.x + samplePoint.z * forwardAxis.z;
          const leftProjection =
            samplePoint.x * leftAxis.x + samplePoint.z * leftAxis.z;
          maximumForwardProjection = Math.max(maximumForwardProjection, forwardProjection);
          minimumLeftProjection = Math.min(minimumLeftProjection, leftProjection);
          maximumLeftProjection = Math.max(maximumLeftProjection, leftProjection);
          sampleCount += 1;
        }
      }
    }
  });

  if (sampleCount < 8 || ![
    maximumForwardProjection,
    minimumLeftProjection,
    maximumLeftProjection,
  ].every(Number.isFinite)) {
    throw new Error("A1 visible-airframe door registration could not measure the rendered CRJ mesh");
  }

  const centerlineLeftProjection = (minimumLeftProjection + maximumLeftProjection) * 0.5;
  const doorForwardProjection =
    maximumForwardProjection - Number(profile.aftOfVisibleNoseMeters);
  const doorLeftProjection =
    centerlineLeftProjection + Number(profile.leftOfVisibleCenterlineMeters);

  const localHeight = profile.authoredDoorHeightLocalPointMeters;
  if (!Array.isArray(localHeight) || localHeight.length !== 3 || !localHeight.every(Number.isFinite)) {
    throw new Error(`Aircraft door profile ${profile.aircraftType} has no grounded authored door-height point`);
  }
  const doorY = realModel.localToWorld(
    new THREE.Vector3(localHeight[0], localHeight[1], localHeight[2]),
  ).y;

  return Object.freeze({
    point: new THREE.Vector3(
      forwardAxis.x * doorForwardProjection + leftAxis.x * doorLeftProjection,
      doorY,
      forwardAxis.z * doorForwardProjection + leftAxis.z * doorLeftProjection,
    ),
    forwardAxis,
    leftAxis,
    sampleCount,
    maximumForwardProjection,
    centerlineLeftProjection,
    authority: profile.renderedDoorMarkerAuthority,
  });
}

export function getRenderedAircraftDoorWorldMarker(THREE, aircraft, profile) {
  return measureRenderedAircraftDoorWorld(THREE, aircraft, profile)?.point || null;
}

export function getRenderedAircraftDoorOutwardWorldDirection(THREE, aircraft) {
  if (!THREE || !aircraft) throw new Error("THREE and aircraft are required");
  aircraft.updateMatrixWorld(true);
  return new THREE.Vector3(-1, 0, 0)
    .applyQuaternion(aircraft.getWorldQuaternion(new THREE.Quaternion()))
    .setY(0)
    .normalize();
}

export function getAircraftDoorWorldHorizontalPoint(THREE, aircraft, profile) {
  return getRenderedAircraftDoorWorldMarker(THREE, aircraft, profile);
}
