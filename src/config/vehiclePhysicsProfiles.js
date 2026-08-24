const MPH_TO_MPS = 0.44704;
const IN_TO_M = 0.0254;
const LB_TO_KG = 0.45359237;

function steerAngleForRadius(wheelbaseMeters, turningRadiusMeters) {
  return Math.atan(wheelbaseMeters / turningRadiusMeters);
}

const lektro88Wheelbase = 92.2 * IN_TO_M;
const lektro88TurnRadius = 180 * IN_TO_M;
const standupWheelbase = 62.25 * IN_TO_M;
const standupTurnRadius = 106 * IN_TO_M;
const kubotaWheelbase = 80.5 * IN_TO_M;
const kubotaTurnRadius = 4.0;

export const VEHICLE_PHYSICS_PROFILES = Object.freeze({
  "lektro-88": Object.freeze({
    id: "lektro-88",
    role: "towbarless-pushback",
    referenceModel: "LEKTRO AP8850SDA / LEKTRO 88 class",
    steeringMode: "rear",
    wheelbase: lektro88Wheelbase,
    trackWidth: 2.051,
    bodyBounds: Object.freeze([2.051, 1.03, 5.282]),
    cradleOffset: 3.45,
    captureAnchor: Object.freeze([0, 0.34, 3.45]),
    liftTravel: 0.23,
    freeMaxSpeed: 9 * MPH_TO_MPS,
    towMaxSpeed: 4 * MPH_TO_MPS,
    freeAcceleration: 1.35,
    towAcceleration: 0.58,
    serviceBrakeDeceleration: 2.7,
    coastDeceleration: 0.42,
    maxSteerAngle: steerAngleForRadius(lektro88Wheelbase, lektro88TurnRadius),
    maxSteerRate: 0.82,
    massKg: 9300 * LB_TO_KG,
    collisionRadius: 1.12,
    collisionHeights: Object.freeze([0.42, 0.92, 1.45]),
    operatorEye: Object.freeze([-0.43, 1.28, -1.82]),
    operatorLook: Object.freeze([-0.20, 1.12, 6.8]),
    sourceFacts: Object.freeze({
      emptySpeedMph: 9,
      loadedSpeedMph: 4,
      wheelbaseInches: 92.2,
      turningRadiusInches: 180,
      lengthInches: 207.9,
      widthInches: 80.7,
      liftInches: 9,
      cradleCapacityLb: 12000,
      powertrain: "electric towbarless cradle/strap tractor",
    }),
  }),

  "standup-tug": Object.freeze({
    id: "standup-tug",
    role: "towbarless-pushback",
    referenceModel: "User revised V3 visual; LEKTRO AP8360-class handling reference",
    steeringMode: "rear",
    wheelbase: standupWheelbase,
    trackWidth: 0.82,
    bodyBounds: Object.freeze([0.978, 1.152, 3.159]),
    cradleOffset: 2.48,
    captureAnchor: Object.freeze([0, 0.34, 2.48]),
    liftTravel: 0.229,
    freeMaxSpeed: 5 * MPH_TO_MPS,
    towMaxSpeed: 3 * MPH_TO_MPS,
    freeAcceleration: 1.25,
    towAcceleration: 0.55,
    serviceBrakeDeceleration: 2.45,
    coastDeceleration: 0.40,
    maxSteerAngle: steerAngleForRadius(standupWheelbase, standupTurnRadius),
    maxSteerRate: 1.05,
    massKg: 1485 * LB_TO_KG,
    collisionRadius: 0.60,
    collisionHeights: Object.freeze([0.30, 0.78, 1.25]),
    operatorEye: Object.freeze([0.28, 1.62, -0.62]),
    operatorLook: Object.freeze([0.0, 1.57, 4.8]),
    sourceFacts: Object.freeze({
      emptySpeedMph: 5,
      loadedSpeedMph: 3,
      wheelbaseInches: 62.25,
      turningRadiusInches: 106,
      lengthInches: 132.5,
      widthInches: 32.5,
      cradleCapacityLb: 1500,
      operation: "stand-up",
    }),
  }),

  "manager-kubota": Object.freeze({
    id: "manager-kubota",
    role: "airport-inspection",
    referenceModel: "User manager RTV visual; Kubota RTV-X900-class handling reference",
    steeringMode: "front",
    wheelbase: kubotaWheelbase,
    trackWidth: 1.240,
    bodyBounds: Object.freeze([1.605, 2.020, 3.055]),
    cradleOffset: 1.52,
    captureAnchor: Object.freeze([0, 0.34, 1.52]),
    liftTravel: 0,
    freeMaxSpeed: 25 * MPH_TO_MPS,
    towMaxSpeed: 0,
    freeAcceleration: 2.05,
    towAcceleration: 0,
    serviceBrakeDeceleration: 4.0,
    coastDeceleration: 0.62,
    maxSteerAngle: steerAngleForRadius(kubotaWheelbase, kubotaTurnRadius),
    maxSteerRate: 0.92,
    massKg: 865,
    collisionRadius: 0.88,
    collisionHeights: Object.freeze([0.42, 1.12, 1.92]),
    operatorEye: Object.freeze([-0.32, 1.50, -0.30]),
    operatorLook: Object.freeze([-0.20, 1.38, 5.2]),
    sourceFacts: Object.freeze({
      maxSpeedMph: 25,
      wheelbaseInches: 80.5,
      turningRadiusMeters: 4.0,
      lengthInches: 120.3,
      widthInches: 63.2,
      heightInches: 79.5,
      massKg: 865,
      steering: "hydrostatic power steering",
      brakes: "wet-disc",
      transmission: "VHT-X variable hydrostatic",
    }),
  }),
});

export function getVehiclePhysicsProfile(id) {
  return VEHICLE_PHYSICS_PROFILES[id] || VEHICLE_PHYSICS_PROFILES["lektro-88"];
}
