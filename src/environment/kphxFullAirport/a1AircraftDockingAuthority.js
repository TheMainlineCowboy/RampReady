import { getRampReadyAircraftDoorProfile } from "./aircraftDoorAuthority.js";
import {
  KPHX_FULL_AIRPORT_SOURCE,
  kphxWedToRampReadyPosition,
} from "./sourceAuthority.js";
import { getKphxTerminal4GatePoseByRampWedObjectId } from "./terminal4GatePoseAuthority.js";

export const KPHX_A1_AIRCRAFT_DOCKING_SOURCE = Object.freeze({
  gate: "A1",
  rampWedObjectId: "27855",
  jetwayFacadeWedObjectId: 104804,
  aircraftSideCabinEndWedNodeId: 104811,
  aircraftSideCabinEndLatitude: 33.436517699,
  aircraftSideCabinEndLongitude: -111.998897851,
  wedSha256: "59d9676dbccdaed24f2308e0597aacf846c8244cbadaefd8558af1e5c0dda498",
  authority:
    "KPHX 1.75.1 WED A1 stock-facade cabin endpoint + RobertSV X-Plane 11 CRJ ACF dock-port",
});

function rotateAircraftHorizontalOffset(yaw, lateralMeters, axialMeters) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return Object.freeze({
    x: lateralMeters * c + axialMeters * s,
    z: -lateralMeters * s + axialMeters * c,
  });
}

export function createA1AircraftDockingScenarioPose(
  aircraftType,
  { equipmentApproachOffsetMeters = 6.2 } = {},
) {
  const profile = getRampReadyAircraftDoorProfile(aircraftType);
  if (!profile) throw new Error(`Unsupported A1 aircraft docking type: ${aircraftType}`);
  if (!Number.isFinite(equipmentApproachOffsetMeters) || equipmentApproachOffsetMeters < 0) {
    throw new Error(`Invalid A1 equipment approach offset: ${equipmentApproachOffsetMeters}`);
  }

  const gatePose = getKphxTerminal4GatePoseByRampWedObjectId(
    KPHX_A1_AIRCRAFT_DOCKING_SOURCE.rampWedObjectId,
  );
  if (!gatePose || gatePose.gate !== "A1") {
    throw new Error("Exact KPHX A1 WED ramp-position pose is missing");
  }

  const doorTarget = kphxWedToRampReadyPosition(
    KPHX_A1_AIRCRAFT_DOCKING_SOURCE.aircraftSideCabinEndLatitude,
    KPHX_A1_AIRCRAFT_DOCKING_SOURCE.aircraftSideCabinEndLongitude,
    profile.doorHeightMeters,
  );
  const doorOffset = profile.doorFromNoseGearMeters;
  const worldDoorOffset = rotateAircraftHorizontalOffset(
    gatePose.runtimeYawRadians,
    doorOffset.lateral,
    doorOffset.axial,
  );

  const aircraftX = doorTarget[0] - worldDoorOffset.x;
  const aircraftZ = doorTarget[2] - worldDoorOffset.z;
  const equipmentX =
    aircraftX - Math.sin(gatePose.runtimeYawRadians) * equipmentApproachOffsetMeters;
  const equipmentZ =
    aircraftZ - Math.cos(gatePose.runtimeYawRadians) * equipmentApproachOffsetMeters;
  const rampX = gatePose.runtimePosition[0];
  const rampZ = gatePose.runtimePosition[2];
  const rampDeltaX = aircraftX - rampX;
  const rampDeltaZ = aircraftZ - rampZ;

  return Object.freeze({
    authority:
      "a1-wed-104804-node-104811-plus-xplane-crj-acf-autogate-door-v1",
    gate: gatePose.gate,
    aircraftType: profile.aircraftType,
    rampWedObjectId: gatePose.rampWedObjectId,
    jetwayFacadeWedObjectId: KPHX_A1_AIRCRAFT_DOCKING_SOURCE.jetwayFacadeWedObjectId,
    aircraftSideCabinEndWedNodeId:
      KPHX_A1_AIRCRAFT_DOCKING_SOURCE.aircraftSideCabinEndWedNodeId,
    sourceHeadingDegrees: gatePose.sourceHeadingDegrees,
    runtimeYawRadians: gatePose.runtimeYawRadians,
    equipmentApproachOffsetMeters,
    sourceAcf: profile.sourceAcf,
    autoGateLatMeters: profile.autoGateLatMeters,
    autoGateVertMeters: profile.autoGateVertMeters,
    doorTarget: Object.freeze({
      x: doorTarget[0],
      y: doorTarget[1],
      z: doorTarget[2],
    }),
    sourceRamp: Object.freeze({
      x: rampX,
      y: gatePose.runtimePosition[1],
      z: rampZ,
    }),
    sourceRampToDockedShift: Object.freeze({
      x: rampDeltaX,
      z: rampDeltaZ,
      distance: Math.hypot(rampDeltaX, rampDeltaZ),
    }),
    aircraft: Object.freeze({
      x: aircraftX,
      y: gatePose.runtimePosition[1],
      z: aircraftZ,
      yaw: gatePose.runtimeYawRadians,
    }),
    equipment: Object.freeze({
      x: equipmentX,
      y: gatePose.runtimePosition[1],
      z: equipmentZ,
      yaw: gatePose.runtimeYawRadians,
    }),
  });
}

// Source sanity lock: the CRJ900 ACF relationship should reproduce the authored
// A1 ramp start to within a small tolerance. This cross-check is intentionally
// independent of the current RampReady CRJ700 scenario.
const crj900Sanity = createA1AircraftDockingScenarioPose("CRJ900");
if (crj900Sanity.sourceRampToDockedShift.distance > 0.2) {
  throw new Error(
    `A1 CRJ900 ACF/WED docking sanity drifted by ${crj900Sanity.sourceRampToDockedShift.distance.toFixed(3)} m`,
  );
}

export const KPHX_A1_CRJ900_DOCKING_SANITY = Object.freeze({
  toleranceMeters: 0.2,
  actualMeters: crj900Sanity.sourceRampToDockedShift.distance,
  passed: true,
});

export const KPHX_A1_DEFAULT_DOCKING_POSE = Object.freeze(
  createA1AircraftDockingScenarioPose("CRJ700"),
);

export const KPHX_A1_RAMP_SOURCE = KPHX_FULL_AIRPORT_SOURCE.anchor;
