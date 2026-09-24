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
    aftOfNoseGearMeters: 7.32,
    leftOfCenterlineMeters: 1.34,
    doorHeightMeters: null,
    horizontalAuthority: "measured-rendered-CRJ-forward-door-v5-7.32m-aft-1.34m-left",
    verticalAuthority: "unresolved-do-not-invent-measure-live-rendered-door",
  }),
});

export function getRampReadyAircraftDoorProfile(aircraftType) {
  return RAMPREADY_AIRCRAFT_DOOR_PROFILES[String(aircraftType || "").toUpperCase()] || null;
}

export function getAutoGateDoorTargets(profile, { doorHeightMeters = profile?.doorHeightMeters } = {}) {
  if (!profile) throw new Error("Aircraft door profile is required");
  const lateralDoorMeters = -Number(profile.leftOfCenterlineMeters);
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

export function getAircraftDoorWorldHorizontalPoint(THREE, aircraft, profile) {
  if (!THREE || !aircraft || !profile) throw new Error("THREE, aircraft, and door profile are required");
  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(aircraft.quaternion).normalize();
  const left = new THREE.Vector3(-1, 0, 0).applyQuaternion(aircraft.quaternion).normalize();
  return aircraft.position.clone()
    .addScaledVector(forward, -Number(profile.aftOfNoseGearMeters))
    .addScaledVector(left, Number(profile.leftOfCenterlineMeters));
}
