export const AUTOGATE_REFERENCE = Object.freeze({
  source: "Marginal AutoGate controller + user-supplied MisterX AutoGate OBJ8 animation definitions",
  restEntranceLateralMeters: -7.5,
  restEntranceHeightMeters: 4.0,
  engageWaitSeconds: 1,
  motionDurationSeconds: 15,
  horizontalDataref: "marginal.org.uk/autogate/lat",
  verticalDataref: "marginal.org.uk/autogate/vert",
});

const FEET_TO_METERS = 0.3048;
const SOURCE_ARCHIVE = "20200329_CRJSeries_Xplane11_v1.zip";

function createXPlaneCrjDoorProfile({
  aircraftType,
  acfPath,
  boardingDoorFeet,
  cgFeet,
  noseGearFeet,
  equilibriumHeightFeet,
}) {
  const doorLateralFromCgMeters = boardingDoorFeet[0] * FEET_TO_METERS;
  const doorVerticalFromCgMeters = (boardingDoorFeet[1] - cgFeet.y) * FEET_TO_METERS;
  const doorAxialFromCgMeters = (boardingDoorFeet[2] - cgFeet.z) * FEET_TO_METERS;
  const doorFromNoseGearMeters = Object.freeze({
    lateral: (boardingDoorFeet[0] - noseGearFeet.x) * FEET_TO_METERS,
    axial: (boardingDoorFeet[2] - noseGearFeet.z) * FEET_TO_METERS,
  });
  const equilibriumCgHeightMeters = equilibriumHeightFeet * FEET_TO_METERS;
  const doorHeightMeters = equilibriumCgHeightMeters + doorVerticalFromCgMeters;
  const autoGateLatMeters =
    doorLateralFromCgMeters - AUTOGATE_REFERENCE.restEntranceLateralMeters;
  const autoGateVertMeters =
    doorHeightMeters - AUTOGATE_REFERENCE.restEntranceHeightMeters;

  return Object.freeze({
    aircraftType,
    doorId: "L1-forward-passenger",
    modelForwardAxis: "-Z",
    sourceArchive: SOURCE_ARCHIVE,
    sourceAcf: acfPath,
    sourceAuthority:
      "RobertSV X-Plane 11 ACF boarding-door + gear/equilibrium metadata interpreted with Marginal AutoGate semantics",
    rawAcf: Object.freeze({
      boardingDoorFeet: Object.freeze([...boardingDoorFeet]),
      cgFeet: Object.freeze({ ...cgFeet }),
      noseGearFeet: Object.freeze({ ...noseGearFeet }),
      equilibriumHeightFeet,
    }),
    doorOffsetFromCgMeters: Object.freeze({
      lateral: doorLateralFromCgMeters,
      vertical: doorVerticalFromCgMeters,
      axial: doorAxialFromCgMeters,
    }),
    doorFromNoseGearMeters,
    equilibriumCgHeightMeters,
    doorHeightMeters,
    autoGateLatMeters,
    autoGateVertMeters,
    renderedDoorMarkerAuthority:
      "X-Plane ACF L1 dock-port transformed from RampReady nose-gear ground origin; no visible-mesh guess",
  });
}

export const RAMPREADY_AIRCRAFT_DOOR_PROFILES = Object.freeze({
  CRJ700: createXPlaneCrjDoorProfile({
    aircraftType: "CRJ700",
    acfPath: "CRJ7NG/crj700NG.acf",
    boardingDoorFeet: [-4.5, -2.200000048, 16.299999237],
    cgFeet: { y: -2.0, z: 60.0 },
    noseGearFeet: { x: 0.0, y: -2.650000095, z: 16.899999619 },
    equilibriumHeightFeet: 7.027759075,
  }),
  CRJ900: createXPlaneCrjDoorProfile({
    aircraftType: "CRJ900",
    acfPath: "CRJ9NG/crj900NG.acf",
    boardingDoorFeet: [-4.5, -2.200000048, 16.299999237],
    cgFeet: { y: -2.0, z: 60.0 },
    noseGearFeet: { x: 0.0, y: -2.650000095, z: 8.899999619 },
    equilibriumHeightFeet: 7.037753105,
  }),
});

export function getRampReadyAircraftDoorProfile(aircraftType) {
  return RAMPREADY_AIRCRAFT_DOOR_PROFILES[String(aircraftType || "").toUpperCase()] || null;
}

export function getAutoGateDoorTargets(
  profile,
  { doorHeightMeters = profile?.doorHeightMeters } = {},
) {
  if (!profile) throw new Error("Aircraft door profile is required");
  const lateralDoorMeters = Number(profile.doorOffsetFromCgMeters?.lateral);
  if (!Number.isFinite(lateralDoorMeters)) {
    throw new Error(`Aircraft door profile ${profile.aircraftType} has no finite ACF lateral door station`);
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
    sourceAcf: profile.sourceAcf,
    authority: "xplane-acf-autogate-meter-space-aircraft-door-target-v1",
  });
}

export function measureRenderedAircraftDoorWorld(THREE, aircraft, profile) {
  if (!THREE || !aircraft || !profile) {
    throw new Error("THREE, aircraft, and aircraft ACF door profile are required");
  }
  const offset = profile.doorFromNoseGearMeters;
  if (!offset || ![offset.lateral, offset.axial, profile.doorHeightMeters].every(Number.isFinite)) {
    throw new Error(`Aircraft door profile ${profile.aircraftType} has incomplete nose-gear-relative ACF geometry`);
  }

  aircraft.updateMatrixWorld(true);
  const rootWorld = aircraft.getWorldPosition(new THREE.Vector3());
  const aircraftWorldQuaternion = aircraft.getWorldQuaternion(new THREE.Quaternion());

  // RampReady's aircraft simulation origin is the nose-gear ground/tow point.
  // X-Plane ACF coordinates are real-world feet; convert to real-world meters
  // and rotate without applying the display-model scale.
  const physicalDoorOffset = new THREE.Vector3(
    offset.lateral,
    profile.doorHeightMeters,
    offset.axial,
  ).applyQuaternion(aircraftWorldQuaternion);

  const point = rootWorld.clone().add(physicalDoorOffset);
  const forwardAxis = new THREE.Vector3(0, 0, -1)
    .applyQuaternion(aircraftWorldQuaternion)
    .setY(0)
    .normalize();
  const leftAxis = new THREE.Vector3(-1, 0, 0)
    .applyQuaternion(aircraftWorldQuaternion)
    .setY(0)
    .normalize();

  return Object.freeze({
    point,
    forwardAxis,
    leftAxis,
    sourceAcf: profile.sourceAcf,
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
